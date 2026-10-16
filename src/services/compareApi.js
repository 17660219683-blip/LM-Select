/**
 * 对比测试接口（对应 server/routes/compare.js）。
 *
 * 上游是各厂商的 OpenAI 兼容接口，返回 SSE，所以这里复用
 * services/sse.js 的解析器 —— 那个函数有现成的边界测试
 * （半截载荷跨 chunk、CRLF、[DONE] 等），不用再写一遍。
 */
import { API_BASE } from '@/config'
import { takeSsePayloads } from '@/services/sse'

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error(
      '连不上后端服务。请确认它已启动（npm run server，或 npm run dev:all 一起起前后端）。',
    )
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      /* 后端没返回 JSON，就用状态文本 */
    }
    throw new Error(detail)
  }

  return res.json()
}

/** 哪些厂商已经配好了 key */
export function fetchProviders() {
  return request('/compare/providers')
}

/**
 * 调用库里的某个模型，流式返回。
 *
 * @param {object} options
 * @param {number} options.modelId 数据库 model_version.id
 * @param {string} options.text    题目正文（已把文本类附件拼进来）
 * @param {string[]} [options.images] 图片的 data URL 数组
 * @param {AbortSignal} options.signal
 * @param {(delta: string, full: string) => void} [options.onDelta]      正文增量
 * @param {(delta: string, full: string) => void} [options.onReasoning]  思考过程增量
 * @param {(final: object) => void} [options.onDone]                     收尾（含 usage）
 * @returns {Promise<string>} 完整正文
 */
export async function runComparison({
  modelId,
  text,
  images,
  signal,
  onDelta,
  onReasoning,
  onDone,
}) {
  let res
  try {
    res = await fetch(`${API_BASE}/compare/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ modelId, text, images }),
    })
  } catch (err) {
    // 用户点了停止：这是预期路径，让调用方按 AbortError 处理
    if (err?.name === 'AbortError') throw err
    throw new Error('连不上后端服务，请确认它正在运行。', { cause: err })
  }

  if (!res.ok || !res.body) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      /* 非 JSON 响应 */
    }
    throw new Error(detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let full = ''
  let reasoning = ''
  let usage = null
  let finishReason = null

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

      const choice = chunk.choices?.[0]

      /*
        收尾原因必须记下来：如果是 length，说明输出被长度上限截断了。
        被截断的模型输出更短、速度看起来更快、成本看起来更低，
        不标注出来整个对比就是错的。
      */
      if (choice?.finish_reason) finishReason = choice.finish_reason

      const delta = choice?.delta

      if (delta) {
        /*
          推理模型会把思考过程单独放在 reasoning_content（DeepSeek 用这个）
          或 reasoning 里，正文仍在 content。两个都读，
          否则模型长时间思考期间界面上是空白的。
        */
        const think = delta.reasoning_content ?? delta.reasoning
        if (think) {
          reasoning += think
          onReasoning?.(think, reasoning)
        }

        if (delta.content) {
          full += delta.content
          onDelta?.(delta.content, full)
        }
      }

      // usage 通常在最后一帧（那一帧的 choices 是空数组）
      if (chunk.usage) usage = chunk.usage
    }
  }

  onDone?.({ text: full, reasoning, usage, finishReason })
  return full
}
