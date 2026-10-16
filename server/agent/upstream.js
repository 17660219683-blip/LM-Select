/**
 * 消费上游的 OpenAI 兼容流，把碎片拼成一次完整的模型输出。
 *
 * 与对比测试页的区别：
 *   对比页是「原样透传给浏览器」，由前端的 services/sse.js 解析；
 *   agent 循环则必须**在服务端拿到结果**，才能决定下一步调哪个工具。
 *   所以这里在服务端解析一次。两边解析的是同一套协议，但用途不同，
 *   不存在"两套实现要同步改"的问题 —— 前端那套服务于展示，
 *   这套服务于决策。
 */

/** SSE 里一行的前缀可能是 "data:" 或 "data: "，两种都见得到 */
function payloadOf(line) {
  if (!line.startsWith('data:')) return null
  return line.slice(5).trim()
}

/**
 * @param {Response} res 上游返回的流式响应
 * @param {object} [hooks]
 * @param {(delta: string) => void} [hooks.onDelta] 正文增量
 * @param {(delta: string) => void} [hooks.onReasoning] 思考过程增量
 * @returns {Promise<{content: string, reasoning: string, toolCalls: Array,
 *                    usage: object|null, finishReason: string|null}>}
 */
export async function consumeChatStream(res, { onDelta, onReasoning } = {}) {
  let content = ''
  let reasoning = ''
  let usage = null
  let finishReason = null

  /*
    tool_calls 是按 index 分片下发的：
    第一片带 id 和 name，后续片只带 arguments 的片段。
    所以必须按 index 归并，不能简单地 push。
  */
  const calls = []

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    /*
      按换行切，但最后一段可能是不完整的行，要留到下一轮。
      这是 SSE 解析最容易出错的地方：chunk 边界和行边界无关，
      一个 JSON 载荷很可能被劈成两次到达。
    */
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const payload = payloadOf(line)
      if (payload === null || payload === '' || payload === '[DONE]') continue

      let chunk
      try {
        chunk = JSON.parse(payload)
      } catch {
        // 解析不了就跳过：上游偶尔会插入非 JSON 的心跳行
        continue
      }

      // 有的厂商把错误塞在流里返回
      if (chunk.error) {
        throw new Error(chunk.error.message || '上游在流中返回了错误')
      }

      const choice = chunk.choices?.[0]
      const delta = choice?.delta

      if (delta?.content) {
        content += delta.content
        onDelta?.(delta.content)
      }

      /*
        DeepSeek 等推理模型会把思考过程单独放在 reasoning_content 里。
        不累积的话，轨迹里就看不到"它想了多久、想了什么"，
        而这恰好是 agent 类对比里有价值的信息。
      */
      if (delta?.reasoning_content) {
        reasoning += delta.reasoning_content
        onReasoning?.(delta.reasoning_content)
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const i = tc.index ?? 0
          calls[i] ??= { id: '', name: '', args: '' }
          if (tc.id) calls[i].id = tc.id
          if (tc.function?.name) calls[i].name += tc.function.name
          if (tc.function?.arguments) calls[i].args += tc.function.arguments
        }
      }

      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (chunk.usage) usage = chunk.usage
    }
  }

  return { content, reasoning, toolCalls: calls.filter(Boolean), usage, finishReason }
}

/**
 * 把模型给出的 arguments 字符串解析成对象。
 * 模型偶尔会给出不合法或为空的 JSON，这里不能让它把整轮跑挂掉。
 */
export function parseToolArgs(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return {}
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' ? v : {}
  } catch {
    return null // null 表示"解析失败"，交给调用方决定怎么处理
  }
}
