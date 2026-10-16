/**
 * 模型调用：浏览器直连 Ollama 的 OpenAI 兼容接口，流式返回。
 * 对应原 Python 版本的 client.chat.completions.create(..., stream=True)。
 */
import { MODEL_BASE_URL, MODEL_NAME, buildSystemPrompt } from '@/config'
import { takeSsePayloads } from '@/services/sse'

/**
 * 发起一次流式对话。
 * @param {object} options
 * @param {Array<{role: string, content: string}>} options.messages 对话历史（不含 system）
 * @param {AbortSignal} [options.signal] 用于中途停止
 * @param {(delta: string, full: string) => void} [options.onDelta] 正文增量
 * @param {(delta: string, full: string) => void} [options.onReasoning] 思考过程增量
 * @returns {Promise<string>} 完整正文
 */
export async function streamChat({ messages, signal, onDelta, onReasoning }) {
  const res = await fetch(`${MODEL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: MODEL_NAME,
      stream: true,
      // system 提示词放在最前面，后面接完整对话历史，和原版一致
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...messages],
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`模型返回 ${res.status}${detail ? `：${detail.slice(0, 300)}` : ''}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  let fullReasoning = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const { payloads, rest } = takeSsePayloads(buffer)
    buffer = rest

    for (const payload of payloads) {
      let chunk
      try {
        chunk = JSON.parse(payload)
      } catch {
        continue
      }

      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      /*
        deepseek-r1 这类推理模型会把思考过程单独放在 reasoning 字段里（实测 Ollama 0.33.2 用的是
        reasoning，部分版本/网关用 reasoning_content），正文仍然在 content。
        只读 content 的话，模型长时间思考期间界面上会是完全空白的。
      */
      const thinking = delta.reasoning ?? delta.reasoning_content
      if (thinking) {
        fullReasoning += thinking
        onReasoning?.(thinking, fullReasoning)
      }

      if (delta.content) {
        full += delta.content
        onDelta?.(delta.content, full)
      }
    }
  }

  return full
}
