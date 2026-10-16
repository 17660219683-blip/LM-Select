import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchModels } from '@/services/modelLibraryApi'
import { sendTrialChat } from '@/services/trialChatApi'

/**
 * 试用对话的状态。
 *
 * 设计上的两个取舍：
 *
 * 1. **不做历史会话持久化。** 这页是为了"试试这个 agent 用起来什么感觉"，
 *    不是正式对话工具。刷新即清空，只有当前这一轮会话留在内存里。
 *    没有历史就没有"恢复到哪一次"的问题，也就没有对应的坑。
 *
 * 2. **不做流式重放。** 中途停止后已收到的内容保留，不回滚 ——
 *    用户看到的就是他按停止时屏幕上已有的东西，符合直觉。
 */

/** 试用固定用的模型（与后端 TRIAL_API_MODEL_ID 保持一致） */
const TRIAL_API_MODEL_ID = 'deepseek-flash'

/** 正在进行的请求。AbortController 不适合放进响应式 state，放模块作用域 */
let controller = null

let seq = 0
function nextId() {
  seq += 1
  return `m${seq}`
}

export const useTrialChatStore = defineStore('trialChat', {
  state: () => ({
    /** 当前会话的消息。role: user | assistant */
    messages: [],
    input: '',
    /** 是否正在等上游 */
    sending: false,
    /** 会话级错误（连不上、模型报错等） */
    error: '',

    /** 试用用的模型信息，用来显示名字和算上下文占用 */
    model: null,

    /** 累计用量，用于底部统计 */
    totals: { prompt: 0, completion: 0, hit: 0, miss: 0 },
    /** 上一轮的输出速度（tok/s） */
    lastTps: null,
    /** 上一轮的输入 token，用来估上下文占用 */
    lastPromptTokens: null,
  }),

  getters: {
    canSend: (state) => Boolean(state.input.trim()) && !state.sending,
    hasMessages: (state) => state.messages.length > 0,

    /** 会话标题：取第一条用户消息，太长就截断 */
    title: (state) => {
      const first = state.messages.find((m) => m.role === 'user' && m.text.trim())
      if (!first) return '新会话'
      const t = first.text.trim().replace(/\s+/g, ' ')
      return t.length > 14 ? `${t.slice(0, 14)}…` : t
    },

    /** 轮数：一对问答算一轮，未答完的提问也算 */
    rounds: (state) => state.messages.filter((m) => m.role === 'user').length,

    totalTokens: (state) => state.totals.prompt + state.totals.completion,

    /** 缓存命中率。没有任何缓存明细时返回 null，界面显示「—」而不是假数字 */
    cacheHitRate: (state) => {
      const { hit, miss } = state.totals
      if (hit + miss === 0) return null
      return Math.round((hit / (hit + miss)) * 100)
    },

    /** 上下文占用：用上一轮的输入 token 除以模型窗口 */
    contextPercent: (state) => {
      const win = state.model?.contextWindow
      if (!win || !state.lastPromptTokens) return null
      return Math.min(100, Math.round((state.lastPromptTokens / win) * 100))
    },
  },

  actions: {
    /** 拉一次模型信息，用来显示名字与算上下文占用；失败不影响对话 */
    async loadModel() {
      try {
        const data = await fetchModels({ vendor: 'deepseek', status: 'ga' })
        this.model =
          data.items.find((m) => m.apiModelId === TRIAL_API_MODEL_ID) ?? data.items[0] ?? null
      } catch {
        // 拿不到就只是不显示模型信息，不该拦住试用
        this.model = null
      }
    },

    setInput(value) {
      this.input = value
    },

    /**
     * 发一条消息。
     *
     * 先把用户消息和一条空的助手消息同时推进列表，再开始收流 ——
     * 这样气泡立刻出现，用户能马上看到"发出去了"，
     * 而不是等首字到了才有反应。
     */
    async send() {
      if (!this.canSend) return

      const text = this.input.trim()
      this.input = ''
      this.error = ''

      // at 用于消息下方那行「10月2日 21:05」。存真实时间戳，不编时间
      this.messages.push({ id: nextId(), role: 'user', text, at: Date.now() })
      const reply = { id: nextId(), role: 'assistant', text: '', streaming: true, error: '' }
      this.messages.push(reply)

      // 发给上游的历史：不含刚插入的那条空助手消息
      const history = this.messages
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.text }))

      controller = new AbortController()
      this.sending = true

      const t0 = performance.now()
      let tFirst = null

      try {
        const result = await sendTrialChat({
          messages: history,
          signal: controller.signal,

          /*
            生成窗口从"首个流式帧"起算，正文或思考都算。
            只认正文的话，推理模型（先吐一分钟思考再出正文）会算出几千 tok/s 的假速度。
          */
          onFirstFrame: () => {
            if (tFirst === null) tFirst = performance.now()
          },

          onDelta: (_delta, full) => {
            reply.text = full
          },

          onUsage: (usage) => {
            this.totals.prompt += usage.prompt_tokens ?? 0
            this.totals.completion += usage.completion_tokens ?? 0
            this.totals.hit += usage.prompt_cache_hit_tokens ?? 0
            this.totals.miss += usage.prompt_cache_miss_tokens ?? 0
            this.lastPromptTokens = usage.prompt_tokens ?? this.lastPromptTokens
          },
        })

        reply.text = result.text

        /*
          速度从"首个流式帧"起算，而不是从请求发出起算 ——
          否则把网络的往返时间和模型的排队时间都算进生成耗时里，
          算出来的 tok/s 会明显偏低。
        */
        const genMs = performance.now() - (tFirst ?? t0)
        const out = result.usage?.completion_tokens
        this.lastTps = genMs > 0 && out ? Number(((out / genMs) * 1000).toFixed(0)) : null
      } catch (err) {
        if (err?.name === 'AbortError') {
          reply.stopped = true
        } else {
          reply.error = err.message
          // 一条都没收到时把空气泡撤掉，免得留一个空框让人以为还在跑
          if (!reply.text) {
            const i = this.messages.indexOf(reply)
            if (i >= 0) this.messages.splice(i, 1)
          }
        }
      } finally {
        reply.streaming = false
        // 耗时用于状态行的「已完成，用时 X 秒」
        reply.ms = Math.round(performance.now() - t0)
        controller = null
        this.sending = false
      }
    },

    stop() {
      controller?.abort()
      controller = null
      this.sending = false
    },

    /**
     * 新会话：直接清空，不保留。
     * 这页不做历史，所以"新会话"就是字面意义的丢掉当前这轮。
     */
    newSession() {
      this.stop()
      this.messages = []
      this.input = ''
      this.error = ''
      this.totals = { prompt: 0, completion: 0, hit: 0, miss: 0 }
      this.lastTps = null
      this.lastPromptTokens = null
    },
  },
})

/*
  让 store 支持热更新。
  没有这段时，改 actions 后浏览器里已创建的 store 实例仍用旧 actions，
  症状很迷惑（对比页踩过）。
*/
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTrialChatStore, import.meta.hot))
}
