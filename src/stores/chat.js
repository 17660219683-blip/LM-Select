import { defineStore } from 'pinia'

import { CHARACTER, NICKNAME } from '@/config'
import {
  deleteSession,
  listSessions,
  loadSession,
  renameSession as renameSessionApi,
  saveSession,
} from '@/services/sessionApi'
import { streamChat } from '@/services/modelApi'

/** 正在进行的流式请求。AbortController 不适合放进响应式 state，所以放模块作用域 */
let controller = null
/** 正在进行的 sendMessage 的 Promise，用来在切换/新建会话前等它彻底收尾 */
let streamingPromise = null

/** 会话标识：与原始 Python 的 strftime("%Y-%m-%d_%H-%M-%S") 完全一致 */
export function createSessionId(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
  const t = `${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
  return `${d}_${t}`
}

function toMessage(err) {
  if (err instanceof TypeError) {
    return '连不上服务。请确认会话服务已启动（npm run server），并且 Ollama 正在运行。'
  }
  return err?.message || String(err)
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** 历史会话摘要列表 */
    sessions: [],
    /** 当前会话 ID */
    currentSessionId: '',
    /** 当前会话的消息，[{ role, content }] */
    messages: [],
    /** 流式输出中已经收到的正文（还没落成正式消息） */
    streamingText: '',
    /** 推理模型的思考过程，只用于实时展示，不写进会话文件 */
    streamingReasoning: '',
    isStreaming: false,
    isLoading: false,
    error: '',
  }),

  actions: {
    /** 进入页面时调用：拉会话列表 + 开一个新的空会话 */
    async bootstrap() {
      this.isLoading = true
      try {
        await this.refreshSessionList()
        this.currentSessionId = createSessionId()
        this.messages = []
      } catch (err) {
        this.error = toMessage(err)
      } finally {
        this.isLoading = false
      }
    },

    async refreshSessionList() {
      this.sessions = await listSessions()
    },

    /**
     * 服务恢复后重试：只重拉会话列表，不动当前正在编辑的会话。
     * 不能复用 bootstrap()，那会另起一个新会话，把用户正在看的对话顶掉。
     */
    async retryConnection() {
      this.error = ''
      try {
        await this.refreshSessionList()
      } catch (err) {
        this.error = toMessage(err)
      }
    },

    /**
     * 把当前会话写盘。
     * 空会话不保存 —— 原版点「新建会话」会生成空 JSON 文件，这里顺手修掉了。
     */
    async persistCurrent() {
      if (!this.messages.length) return
      await saveSession({
        id: this.currentSessionId,
        nickname: NICKNAME,
        character: CHARACTER,
        messages: this.messages,
      })
      await this.refreshSessionList()
    },

    /**
     * 中断流式输出，并等它自己的收尾逻辑（保留半截回复 + 写盘）跑完。
     * 不 await 的话，收尾可能发生在会话 ID 已经切换之后，把旧消息写进新会话。
     */
    async stopAndSettle() {
      if (!streamingPromise) return
      controller?.abort()
      try {
        await streamingPromise
      } catch {
        /* runStream 内部已经处理过错误 */
      }
    },

    resetStreaming() {
      this.streamingText = ''
      this.streamingReasoning = ''
    },

    /** 新建会话：先保存当前这条，再开一个全新的 */
    async newSession() {
      await this.stopAndSettle()
      try {
        await this.persistCurrent()
        this.currentSessionId = createSessionId()
        this.messages = []
        this.resetStreaming()
        this.error = ''
      } catch (err) {
        this.error = toMessage(err)
      }
    },

    /** 切换历史会话 */
    async switchSession(id) {
      if (id === this.currentSessionId) return
      await this.stopAndSettle()
      try {
        await this.persistCurrent()
        const data = await loadSession(id)
        this.currentSessionId = id
        this.messages = Array.isArray(data.messages) ? data.messages : []
        this.resetStreaming()
        this.error = ''
      } catch (err) {
        this.error = toMessage(err)
      }
    },

    /** 删除会话；若删的正是当前会话，则另起一个新的空会话 */
    async removeSession(id) {
      await this.stopAndSettle()
      try {
        await deleteSession(id)
        if (id === this.currentSessionId) {
          this.currentSessionId = createSessionId()
          this.messages = []
          this.resetStreaming()
        }
        await this.refreshSessionList()
      } catch (err) {
        this.error = toMessage(err)
      }
    },

    /** 重命名会话；清空标题则退回显示默认的时间戳 */
    async renameSession(id, title) {
      try {
        await renameSessionApi(id, String(title || '').trim())
        await this.refreshSessionList()
      } catch (err) {
        this.error = toMessage(err)
      }
    },

    /** 发消息：先落用户消息，再流式接模型回复，最后整体写盘 */
    async sendMessage(text) {
      const content = text.trim()
      if (!content || this.isStreaming) return

      const run = this.runStream(content)
      streamingPromise = run
      try {
        await run
      } finally {
        if (streamingPromise === run) streamingPromise = null
      }
    },

    /** sendMessage 的实际逻辑，单独拆出来是为了能被 stopAndSettle 精确 await */
    async runStream(content) {
      this.error = ''
      this.messages.push({ role: 'user', content })
      this.resetStreaming()
      this.isStreaming = true

      controller = new AbortController()

      try {
        const history = this.messages.map((m) => ({ role: m.role, content: m.content }))
        const reply = await streamChat({
          messages: history,
          signal: controller.signal,
          onDelta: (_delta, full) => {
            this.streamingText = full
          },
          onReasoning: (_delta, full) => {
            this.streamingReasoning = full
          },
        })

        const finalText = reply || this.streamingText
        if (finalText) this.messages.push({ role: 'assistant', content: finalText })
        this.resetStreaming()
        await this.persistCurrent()
      } catch (err) {
        if (err?.name === 'AbortError') {
          // 用户主动停止：把已经收到的半截回复保留下来
          if (this.streamingText) {
            this.messages.push({ role: 'assistant', content: this.streamingText })
          }
          this.resetStreaming()
          await this.persistCurrent().catch(() => {})
        } else {
          this.resetStreaming()
          this.error = toMessage(err)
        }
      } finally {
        controller = null
        this.isStreaming = false
      }
    },

    stopStreaming() {
      controller?.abort()
    },

    dismissError() {
      this.error = ''
    },
  },
})
