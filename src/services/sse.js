/**
 * SSE 解析。
 *
 * 单独抽成无依赖的纯函数，有两个原因：
 *   1. 一个 JSON 载荷可能被切成两半、跨 chunk 到达，这是最容易写错的地方，
 *      抽出来才能直接用 Node 喂边界数据验证；
 *   2. 解析逻辑和网络传输解耦。
 */

/**
 * 从累积缓冲区里切出**完整**的 data: 载荷。
 * @param {string} buffer 到目前为止累积的所有文本
 * @returns {{ payloads: string[], rest: string }} rest 是尾部那段不完整的，留给下一轮
 */
export function takeSsePayloads(buffer) {
  const payloads = []
  const lines = buffer.split('\n')
  // 最后一行可能是半截的，不能当成完整事件处理
  const rest = lines.pop() ?? ''

  for (const raw of lines) {
    const line = raw.trim()
    if (!line.startsWith('data:')) continue

    const payload = line.slice(5).trim()
    // 空载荷和 [DONE] 结束标记都不产出内容
    if (!payload || payload === '[DONE]') continue

    payloads.push(payload)
  }

  return { payloads, rest }
}
