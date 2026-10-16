import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchProviders, runComparison } from '@/services/compareApi'
import { fetchModelFilters, fetchModels } from '@/services/modelLibraryApi'
import {
  MAX_ATTACHMENTS,
  parseAttachment,
  readAttachment,
  releaseAttachment,
  toSendableImage,
} from '@/utils/attachments'

/** 正在进行的流式请求。AbortController 不适合放进响应式 state，所以放模块作用域 */
let controllers = []

/** 单次对比中，一个模型的全部状态与指标 */
function emptyRun(model) {
  return {
    modelId: model.id,
    model,
    status: 'idle', // idle | running | done | stopped | error
    text: '',
    reasoning: '',
    error: '',

    /**
     * 首个有内容的流式帧（思考或正文都算）。
     * 用它算生成窗口，而不是用首字 ——
     * 推理模型会先流式吐几秒思考过程，正文才出来，
     * 拿"首个正文"起算会把窗口压得极短，算出几百 tok/s 的荒谬速度。
     */
    firstTokenMs: null,
    /** 首字延迟：第一个**正文** token 的时间。对推理模型来说它含思考耗时 */
    ttftMs: null,
    /** 整段墙钟耗时 */
    wallMs: null,

    promptTokens: null,
    outputTokens: null,
    /** 其中用于思考的 token（DeepSeek 等推理模型会单独给） */
    reasoningTokens: null,
    /** 提示词命中 / 未命中缓存的 token 数，用于精确计价 */
    cacheHitTokens: null,
    cacheMissTokens: null,

    /** 输出速度 tokens/s。云端接口不给生成耗时，只能按生成窗口估算 */
    tokensPerSec: null,

    /**
     * 收尾原因。stop 是正常结束，length 表示撞上了长度上限被截断 ——
     * 截断的输出更短、看起来更快更便宜，不标注出来对比就是错的。
     */
    finishReason: null,

    /** 本次调用成本（美元），按模型库里标准档的单价算 */
    costUsd: null,
  }
}

/** 一次对比最多选几个模型 */
export const MAX_MODELS = 4

/**
 * 对比测试的状态。
 *
 * 模型来源是 MySQL 模型库（和「模型库」页同一个数据源），
 * 用厂商筛选来浏览、逐个勾选。
 *
 * 选择是**跨厂商累积**的 —— 切到别家不会清空已选，
 * 因为最常见的用法就是拿 OpenAI 和 Anthropic 的模型对着比。
 */
export const useCompareStore = defineStore('compare', {
  state: () => ({
    /** 厂商筛选项（含 logo、模型数） */
    vendors: [],
    /** 当前浏览的厂商，'' 表示全部 */
    vendor: '',

    /** 当前厂商下的模型列表 */
    models: [],

    /** 已选中的模型（完整对象，切厂商时保留） */
    selected: [],

    prompt: '',

    /**
     * 挂在题目上的附件。图片会生成 blob URL 做缩略图；
     * 文本类文件当场读出内容，执行阶段可直接拼进题目。
     */
    attachments: [],
    /** 添加附件时的校验提示（超限、格式、读取失败等） */
    attachmentError: '',

    /** 已配好 key、可以真实调用的厂商 */
    providers: [],
    /**
     * 是否成功读到了厂商配置。
     *
     * 这个标志很关键：读不到配置（后端还是旧进程、服务没起）
     * 和「配置了但没配 key」是两回事。
     * 前者不该把界面标成"未配置 key"，那会把用户引到错误的方向。
     */
    providersLoaded: false,
    providersError: '',
    /** 本轮各模型的运行状态，key 是 model_version.id */
    runs: {},
    isRunning: false,

    isLoadingVendors: false,
    isLoadingModels: false,
    error: '',
  }),

  getters: {
    selectedIds: (state) => new Set(state.selected.map((m) => m.id)),

    canSelectMore: (state) => state.selected.length < MAX_MODELS,

    canAddAttachment: (state) => state.attachments.length < MAX_ATTACHMENTS,

    /** 还有附件的正文没读完（PDF/Word 解析要几秒），此时不能开跑 */
    isParsingAttachments: (state) =>
      state.attachments.some((a) => a.status === 'parsing'),

    /**
     * 读不出内容的附件。
     * 必须让用户先处理掉 —— 放着不管的话，请求里就没有这部分内容，
     * 模型会说"没收到文档"，而用户看不出是附件的问题。
     */
    brokenAttachments: (state) => state.attachments.filter((a) => a.status === 'error'),

    /** 题目 = 有文字，或有附件（纯传图也可以是一道题） */
    hasInput: (state) =>
      state.prompt.trim().length > 0 || state.attachments.length > 0,

    /** 已配好 key 的厂商 code 集合 */
    readyVendors: (state) =>
      new Set(state.providers.filter((p) => p.configured).map((p) => p.code)),

    /** 选中里能真实调用的数量 —— 没配 key 的厂商点了也是白点 */
    runnableCount: (state) => {
      const ready = new Set(state.providers.filter((p) => p.configured).map((p) => p.code))
      return state.selected.filter((m) => ready.has(m.vendor.code)).length
    },

    /** 结果列：按勾选顺序取，没跑过的模型不出现 */
    columns: (state) => state.selected.map((m) => state.runs[m.id]).filter(Boolean),

    hasResult: (state) => Object.keys(state.runs).length > 0,

    /** 同批里最快的输出速度，作为其它列速度条的基准 */
    fastestTps: (state) => {
      const values = Object.values(state.runs)
        .map((r) => r.tokensPerSec)
        .filter((v) => typeof v === 'number' && v > 0)
      return values.length ? Math.max(...values) : null
    },

    /**
     * 选够 2 个、题目有内容，且**每个**选中模型都可调用，才能开跑。
     * 要求全部可跑而不是"跳过没配 key 的"，是为了避免出现
     * "点了开始却只出来一列"这种让人困惑的结果。
     *
     * 配置读不到时不拦 —— 让请求真去打一次，
     * 后端会返回准确的错误，比前端猜要可靠。
     */
    canCompare: (state) => {
      if (state.selected.length < 2) return false
      if (!state.prompt.trim() && !state.attachments.length) return false

      /*
        附件必须**全部 ready**。
        解析中（PDF 要几秒）就点开始，会带着空内容发出去；
        解析失败的更不能放过 —— 那种情况下用户以为传了文档，模型却看不到。
      */
      if (state.attachments.some((a) => a.status !== 'ready')) return false

      if (!state.providersLoaded) return true

      const ready = new Set(state.providers.filter((p) => p.configured).map((p) => p.code))
      return state.selected.every((m) => ready.has(m.vendor.code))
    },

    /**
     * 选中里哪些厂商跑不了，以及**为什么**。
     *
     * 分两种，解决方式完全不同，提示必须分开，否则会把用户引向错误方向：
     *   no_adapter —— 后端根本没注册这个厂商的适配器
     *                 （最常见的原因是后端进程还是旧的，改动没加载）
     *   no_key     —— 适配器有了，但没配 API key
     *
     * 返回去重后的数组（选了两个同厂商模型不会重复提示）。
     * 配置读不到时返回空数组（未知不拦）。
     */
    blockedVendors: (state) => {
      if (!state.providersLoaded) return []

      const byCode = new Map(state.providers.map((p) => [p.code, p]))
      const out = new Map()

      for (const model of state.selected) {
        const code = model.vendor.code
        const provider = byCode.get(code)

        if (provider?.configured) continue
        if (out.has(code)) continue

        out.set(code, {
          code,
          name: model.vendor.nameZh || model.vendor.name,
          reason: provider ? 'no_key' : 'no_adapter',
        })
      }

      return [...out.values()]
    },

    /** 后端还没更新到带 /api/compare/* 的版本，或服务没起 */
    needsBackendRestart: (state) => !state.providersLoaded && Boolean(state.providersError),

    /** 按厂商分组展示已选模型，便于一眼看出是不是跨了家 */
    selectedByVendor: (state) => {
      const groups = new Map()
      for (const m of state.selected) {
        const key = m.vendor.nameZh || m.vendor.name
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(m)
      }
      return [...groups.entries()].map(([vendor, models]) => ({ vendor, models }))
    },
  },

  actions: {
    async loadVendors() {
      this.isLoadingVendors = true
      this.error = ''
      try {
        const data = await fetchModelFilters()
        this.vendors = data.vendors
      } catch (err) {
        this.error = err.message
        this.vendors = []
      } finally {
        this.isLoadingVendors = false
      }
    },

    /** 切厂商。只刷新列表，不动已选 */
    async selectVendor(code) {
      this.vendor = this.vendor === code ? '' : code
      await this.loadModels()
    },

    async loadModels() {
      this.isLoadingModels = true
      this.error = ''
      try {
        const data = await fetchModels({
          status: 'ga',
          vendor: this.vendor,
          sort: 'output_usd',
          order: 'asc',
        })
        this.models = data.items
      } catch (err) {
        this.error = err.message
        this.models = []
      } finally {
        this.isLoadingModels = false
      }
    },

    toggleModel(model) {
      const i = this.selected.findIndex((m) => m.id === model.id)
      if (i >= 0) {
        this.selected.splice(i, 1)
      } else if (this.selected.length < MAX_MODELS) {
        this.selected.push(model)
      }
    },

    removeModel(id) {
      const i = this.selected.findIndex((m) => m.id === id)
      if (i >= 0) this.selected.splice(i, 1)
    },

    clearSelected() {
      this.selected = []
    },

    setPrompt(value) {
      this.prompt = value
    },

    /**
     * 批量添加附件。
     *
     * 先把所有条目**同步**建出来推进数组，再并发解析内容。
     * 这样点了之后附件立刻出现并显示"解析中"，
     * 而不是等 PDF 解完（可能几秒）界面才有反应。
     *
     * 校验失败只收集成一条提示、不中断整批 ——
     * 拖进来 5 个文件只有 1 个超标时，另外 4 个应该照常加上。
     */
    async addAttachments(fileList) {
      const files = [...(fileList ?? [])]
      if (!files.length) return

      this.attachmentError = ''
      const problems = []
      const pending = []

      for (const file of files) {
        if (this.attachments.length >= MAX_ATTACHMENTS) {
          problems.push(`已达上限 ${MAX_ATTACHMENTS} 个，${file.name} 未添加`)
          continue
        }

        const result = readAttachment(file, this.attachments.length)
        if (!result.ok) {
          problems.push(result.reason)
          continue
        }

        this.attachments.push(result.item)

        /*
          ⚠️ 必须取回**响应式代理**再解析，不能直接用 result.item。

          result.item 是刚造出来的原始对象，直接改它的 status 会绕过
          Vue 的 Proxy set 拦截：值确实变了，但不会触发任何重渲染 ——
          界面永远停在"解析中…"，canCompare 也不会重算，「开始对比」
          一直是灰的。之前 docx"一直没解析完"就是这个原因。
        */
        pending.push(this.attachments[this.attachments.length - 1])
      }

      await Promise.all(pending.map((item) => parseAttachment(item)))

      const failed = pending.filter((a) => a.status !== 'ready')
      if (failed.length) {
        problems.push(`${failed.map((a) => a.name).join('、')} 的内容读不出来，见附件上的说明`)
      }

      if (problems.length) this.attachmentError = problems.join('；')
    },

    removeAttachment(id) {
      const i = this.attachments.findIndex((a) => a.id === id)
      if (i < 0) return
      // 顺手释放 blob URL，否则切来切去会一直占着内存
      releaseAttachment(this.attachments[i])
      this.attachments.splice(i, 1)
      this.attachmentError = ''
    },

    clearAttachments() {
      for (const a of this.attachments) releaseAttachment(a)
      this.attachments = []
      this.attachmentError = ''
    },

    async loadProviders() {
      try {
        const data = await fetchProviders()
        this.providers = data.providers
        this.providersLoaded = true
        this.providersError = ''
      } catch (err) {
        /*
          读不到厂商配置。最常见的原因是后端还是旧进程（没有 /api/compare/* 路由）。
          这里绝不能把结果当成"所有厂商都没配 key" —— 那会把用户引偏。
        */
        this.providers = []
        this.providersLoaded = false
        this.providersError = err.message
      }
    },

    /**
     * 把题目与附件拼成请求体。
     * 附件内容都已经被抽成文本，直接内联进正文；图片转成 data URL。
     *
     * ⚠️ 遇到内容没准备好的附件必须**报错**，不能静默跳过。
     * 正常路径下 canCompare 已经拦住了这种状态，这里是兜底 ——
     * 静默跳过的后果太迷惑：界面上明明挂着附件，模型却说没收到，
     * 用户只会以为是模型不行，而真正的原因是内容压根没发出去。
     */
    async buildPayload() {
      const parts = []
      const unsendable = []

      for (const a of this.attachments) {
        if (a.kind === 'image') continue

        if (a.text) parts.push(`【附件：${a.name}】\n${a.text}`)
        else unsendable.push(a)
      }

      if (unsendable.length) {
        const names = unsendable.map((a) => a.name).join('、')
        throw new Error(`附件「${names}」的内容还没准备好，等它解析完再试。`)
      }

      const typed = this.prompt.trim()
      if (typed) parts.push(typed)

      const images = []
      for (const a of this.attachments) {
        if (a.kind !== 'image') continue
        try {
          images.push(await toSendableImage(a.file))
        } catch (err) {
          throw new Error(`处理图片「${a.name}」失败：${err.message}`, { cause: err })
        }
      }

      return { text: parts.join('\n\n'), images }
    },

    /** 发起一轮对比：所有选中模型并发跑 */
    async start() {
      if (!this.canCompare) return

      this.stopRequests()
      this.error = ''

      const models = [...this.selected]
      this.runs = Object.fromEntries(models.map((m) => [m.id, emptyRun(m)]))
      this.isRunning = true

      /*
        附件拼装放在计时之外。
        图片要缩放到 data URL，这一步可能要几百毫秒，
        算进去会污染首字延迟，让所有模型一起变慢。
      */
      let payload
      try {
        payload = await this.buildPayload()
      } catch (err) {
        this.error = err.message
        this.isRunning = false
        return
      }

      controllers = models.map(() => new AbortController())

      try {
        // allSettled：一个模型失败不影响其它列继续跑完
        await Promise.allSettled(
          models.map((m, i) => this.runOne(m, payload, controllers[i].signal)),
        )
      } finally {
        controllers = []
        this.isRunning = false
      }
    },

    async runOne(model, payload, signal) {
      const run = this.runs[model.id]
      if (!run) return

      run.status = 'running'
      const t0 = performance.now()

      try {
        await runComparison({
          modelId: model.id,
          text: payload.text,
          images: payload.images,
          signal,

          onDelta: (_delta, full) => {
            const now = Math.round(performance.now() - t0)
            if (run.firstTokenMs === null) run.firstTokenMs = now
            if (run.ttftMs === null) run.ttftMs = now
            run.text = full
          },

          onReasoning: (_delta, full) => {
            // 思考内容先到，它才是生成真正开始的时刻
            if (run.firstTokenMs === null) {
              run.firstTokenMs = Math.round(performance.now() - t0)
            }
            run.reasoning = full
          },

          onDone: ({ usage, finishReason }) => {
            run.wallMs = Math.round(performance.now() - t0)
            run.finishReason = finishReason ?? null

            if (usage) {
              run.promptTokens = usage.prompt_tokens ?? null
              run.outputTokens = usage.completion_tokens ?? null
              run.reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? null
              run.cacheHitTokens = usage.prompt_cache_hit_tokens ?? null
              run.cacheMissTokens = usage.prompt_cache_miss_tokens ?? null
            }

            /*
              本次调用成本。
              有缓存明细时按「命中 / 未命中」分别计价 —— DeepSeek 的缓存命中价
              比未命中便宜约 50 倍，长提示词或重复跑同一道题时差距极大，
              统一按输入单价算会严重高估。
              单价取自模型库（标准档，已折算 USD）。
            */
            const price = model.price
            if (usage && price) {
              const hit = run.cacheHitTokens
              const miss = run.cacheMissTokens
              let cost = 0
              let priced = false

              if (hit !== null || miss !== null) {
                cost += ((hit ?? 0) * (price.cacheReadUsd ?? price.inputUsd ?? 0)) / 1e6
                cost += ((miss ?? 0) * (price.inputUsd ?? 0)) / 1e6
                priced = true
              } else if (run.promptTokens !== null && price.inputUsd !== null) {
                cost += (run.promptTokens * price.inputUsd) / 1e6
                priced = true
              }

              if (run.outputTokens !== null && price.outputUsd !== null) {
                cost += (run.outputTokens * price.outputUsd) / 1e6
                priced = true
              }

              run.costUsd = priced ? cost : null
            }

            /*
              速度 = 输出 token / 生成窗口。
              两点必须注意：
                1. 窗口从**首个流式帧**起算（含思考过程），不是从首字起算 ——
                   推理模型正文出来得很晚，从首字起算会得到几百 tok/s 的假值；
                2. completion_tokens 本身**包含思考 token**，分子分母口径一致才成立。
              即便如此，云端接口不返回真正的生成耗时，这仍是估算值。
            */
            const genMs = run.wallMs - (run.firstTokenMs ?? 0)
            run.tokensPerSec =
              genMs > 0 && run.outputTokens
                ? Number(((run.outputTokens / genMs) * 1000).toFixed(1))
                : null
          },
        })

        if (run.status === 'running') run.status = 'done'
      } catch (err) {
        if (err?.name === 'AbortError') {
          run.status = 'stopped'
          if (run.wallMs === null) run.wallMs = Math.round(performance.now() - t0)
        } else {
          run.status = 'error'
          run.error = err.message
        }
      }
    },

    stop() {
      this.stopRequests()
      for (const run of Object.values(this.runs)) {
        if (run.status === 'running') run.status = 'stopped'
      }
      this.isRunning = false
    },

    stopRequests() {
      for (const c of controllers) c.abort()
      controllers = []
    },

    clearRuns() {
      this.stopRequests()
      this.runs = {}
      this.isRunning = false
      this.error = ''
    },
  },
})

/*
  让 Pinia store 支持热更新。

  没有这段时，改 store 的 actions 后 Vite 只会更新组件，
  浏览器里**已经创建的那个 store 实例仍在使用旧 actions**。
  症状很迷惑：界面上出现了新指标，但值全是 —（因为计算逻辑根本没跑），
  很容易被误判成后端或数据的问题。

  加了 acceptHMRUpdate 之后，改 actions 会就地替换，不必手动刷新页面。
*/
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCompareStore, import.meta.hot))
}
