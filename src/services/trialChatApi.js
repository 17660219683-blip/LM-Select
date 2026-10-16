/**
 * 试用对话接口（对应 server/routes/agent.js 的 POST /api/agent/chat）。
 *
 * 与对比测试接口的区别：那边发"一道题"，这边发**完整消息历史** ——
 * 试用是多轮对话，第二句必须带着第一句的上下文，否则模型接不上。
 *
 * 顺带把 usage 也解析出来。底部那排统计原先写的是截图里的假数字，
 * 一旦这页真的能对话，假数字就成了谎言 —— 能算的全都换成真实值。
 */
import { API_BASE } from '@/config'
import { takeSsePayloads } from '@/services/sse'

/**
 * @param {object} p
 * @param {Array<{role:string,content:string}>} p.messages
 * @param {AbortSignal} [p.signal]
 * @param {(delta: string, full: string) => void} [p.onDelta]
 * @param {() => void} [p.onFirstFrame] 首个流式帧（正文**或思考**）到达时触发一次
 * @param {(usage: object) => void} [p.onUsage]
 * @returns {Promise<{text: string, usage: object|null, finishReason: string|null}>}
 */
export async function sendTrialChat({ messages, signal, onDelta, onFirstFrame, onUsage }) {
  let res
  try {
    res = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ messages }),
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new Error('连不上后端服务，请确认它已启动。', { cause: err })
  }

  /*
    失败时后端回的是 JSON 而不是事件流。
    必须先判掉，否则下面会拿一个 JSON 当 SSE 解析，
    结果一条事件都收不到，还看不出为什么。
  */
  if (!res.ok || !res.body) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      /* 后端没回 JSON，就用状态码 */
    }
    throw new Error(detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let usage = null
  let finishReason = null
  let sawFirstFrame = false

  for (;;) {
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
        // 半截或非法载荷：跳过，不让它把整轮跑挂掉
        continue
      }

      // 有的厂商把错误塞在流里返回
      if (chunk.error) throw new Error(chunk.error.message || '上游返回了错误')

      const choice = chunk.choices?.[0]
      const delta = choice?.delta

      /*
        ⚠️ 生成窗口必须从**首个流式帧**起算，正文或思考都算。

        DeepSeek 这类推理模型会先流式吐几分钟 reasoning_content，正文才出来。
        只拿"首个正文"当起点，等于把整段思考时间从分母里扣掉，
        算出来的 tok/s 会虚高到几千 —— 之前就是这么算出 3529 tok/s 的。
      */
      if (!sawFirstFrame && (delta?.content || delta?.reasoning_content)) {
        sawFirstFrame = true
        onFirstFrame?.()
      }

      if (delta?.content) {
        text += delta.content
        onDelta?.(delta.content, text)
      }

      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (chunk.usage) {
        usage = chunk.usage
        onUsage?.(usage)
      }
    }
  }

  return { text, usage, finishReason }
}
