/**
 * Agent 循环。
 *
 * 一次运行 = 同一套工具 + 一份脚手架配置 + 一个模型，跑同一道任务。
 * 本项目要验证的主张是"差异主要来自脚手架"，所以这个循环里**所有**
 * 会改变行为的点都必须来自 config，不能有写死的分支。
 *
 * 循环形态：
 *   思考 → 决定调用工具 → 检查（拦截 / 审批）→ 执行 → 观察 → 再思考
 *   直到模型不再调用工具、或撞上步数 / 时长 / 成本上限。
 *
 * 事件流是前端轨迹时间线的唯一数据源。UI 不按厂商硬编码，
 * 按事件类型渲染 —— 配置变了，事件流就变了，界面自己跟着变。
 */
import { TOOL_SCHEMAS, executeTool } from './tools.js'
import { inspectWrite } from './sandbox.js'
import { consumeChatStream, parseToolArgs } from './upstream.js'

/** 滑动窗口保留的尾部消息条数 */
const SLIDING_KEEP = 8

// ------------------------------------------------------------------ 提示词

/**
 * 由配置生成系统提示词。
 *
 * 提示词是脚手架里影响最大的一块，所以它必须由 config 推导，
 * 而不是写一段通用的。
 */
function buildSystemPrompt(config, attachments) {
  const names = attachments.map((a) => a.name)
  const lines = [
    '你是一个可以调用工具的智能体，需要替用户完成一项任务。',
    names.length
      ? `用户提供的附件：${names.join('、')}。需要内容时用 read_file 读取，不要凭空猜测。`
      : '这次任务没有附件。',
    '完成任务后，用一段话向用户说明你做了什么、产出在哪里。',
  ]

  lines.push(
    config.planning === 'plan-first'
      ? '在调用任何工具之前，先用一小段话说明你的目标和计划。'
      : '直接开始执行，不需要先给计划。',
  )

  if (config.verify === 'self-check') {
    lines.push('所有写操作完成后，必须重新读取你写出的文件并核对内容，然后再给出最终答复。')
  }

  return lines.join('\n')
}

// ------------------------------------------------------------------ 指标

/**
 * 累计用量与成本。
 *
 * 成本口径与对比测试页保持一致：
 * 有缓存明细时按"命中 / 未命中"分别计价（命中价可比未命中低数十倍），
 * 没有就退回按输入 token 统一计价。
 */
function accumulateUsage(out, acc, price) {
  const u = out.usage
  if (!u) return

  acc.promptTokens += u.prompt_tokens ?? 0
  acc.outputTokens += u.completion_tokens ?? 0
  acc.reasoningTokens += u.completion_tokens_details?.reasoning_tokens ?? 0

  if (!price) return

  const hit = u.prompt_cache_hit_tokens ?? null
  const miss = u.prompt_cache_miss_tokens ?? null

  if (hit !== null || miss !== null) {
    acc.costUsd += ((hit ?? 0) * (price.cacheReadUsd ?? price.inputUsd ?? 0)) / 1e6
    acc.costUsd += ((miss ?? 0) * (price.inputUsd ?? 0)) / 1e6
  } else if (u.prompt_tokens != null && price.inputUsd != null) {
    acc.costUsd += (u.prompt_tokens * price.inputUsd) / 1e6
  }

  if (u.completion_tokens != null && price.outputUsd != null) {
    acc.costUsd += (u.completion_tokens * price.outputUsd) / 1e6
  }
}

// ------------------------------------------------------------------ 判定

/** 这次工具调用要不要先问用户 */
function needsApproval(config, toolName, inspected) {
  if (config.approval === 'always') return true
  if (toolName !== 'write_file') return false

  if (config.approval === 'on-write') return true
  if (config.approval === 'on-destructive') return Boolean(inspected?.destructive)
  return false
}

/**
 * 滑动窗口裁剪。
 *
 * ⚠️ 不能直接从中间砍：tool 消息必须紧跟着它对应的 assistant(tool_calls)，
 * 配对断了上游会直接报错。所以裁完要保证尾部不以 tool 开头。
 */
function applySlidingWindow(messages) {
  if (messages.length <= SLIDING_KEEP + 2) return messages

  const head = messages.slice(0, 2)
  let tail = messages.slice(-SLIDING_KEEP)
  while (tail.length && tail[0].role === 'tool') tail = tail.slice(1)

  return [...head, { role: 'user', content: '（中间的部分历史已省略）' }, ...tail]
}

// ------------------------------------------------------------------ 主循环

/**
 * @param {object} p
 * @param {string} p.runId
 * @param {object} p.adapter        厂商适配器
 * @param {string} p.apiModelId     上游真实模型名
 * @param {object} p.config         已归一化的脚手架配置
 * @param {string} p.task           用户任务描述
 * @param {Array}  p.attachments    [{name, text}]，已在前端解析好
 * @param {object} p.price          {inputUsd, outputUsd, cacheReadUsd}
 * @param {(ev: object) => void} p.emit
 * @param {(callId: string, info: object) => Promise<{approved: boolean, note?: string}>} p.waitApproval
 * @param {AbortSignal} p.signal
 */
export async function runAgent({
  runId,
  adapter,
  apiModelId,
  config,
  task,
  attachments,
  price,
  emit,
  waitApproval,
  signal,
}) {
  const t0 = Date.now()
  let seq = 0

  const send = (type, payload = {}) => {
    const ev = { seq: ++seq, t: Date.now() - t0, type, ...payload }
    emit(ev)
    return ev
  }

  const acc = {
    promptTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    steps: 0,
    toolCalls: 0,
    approvals: 0,
    blocked: 0,
    retries: 0,
    trimmed: 0,
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(config, attachments) },
    /*
      附件正文不直接塞进任务里，而是让模型自己用 read_file 去取。
      理由：这样"读文件"才是轨迹里可见的一步；直接塞进去的话，
      read_file 这个工具永远不会被调用，也就看不出脚手架差异了。
    */
    { role: 'user', content: task },
  ]

  const toolCtx = { runId, attachments }

  const finish = (reason, extra = {}) => {
    const summary = {
      status: reason === 'final' ? 'done' : reason === 'aborted' ? 'stopped' : 'stopped',
      stopReason: reason,
      steps: acc.steps,
      toolCalls: acc.toolCalls,
      approvals: acc.approvals,
      blocked: acc.blocked,
      retries: acc.retries,
      trimmed: acc.trimmed,
      promptTokens: acc.promptTokens,
      outputTokens: acc.outputTokens,
      reasoningTokens: acc.reasoningTokens,
      costUsd: Number(acc.costUsd.toFixed(6)),
      wallMs: Date.now() - t0,
      ...extra,
    }
    send('stop', summary)
    return summary
  }

  send('run_start', {
    runId,
    apiModelId,
    config,
    task,
    attachments: attachments.map((a) => ({ name: a.name, chars: a.text.length })),
  })

  for (let step = 1; step <= config.maxSteps; step += 1) {
    // ---- 预算检查（放在每步开头，保证一定能收敛）
    const elapsed = Date.now() - t0
    if (signal?.aborted) return finish('aborted')
    if (elapsed > config.maxSeconds * 1000) {
      send('note', { level: 'warn', message: `已超过时长上限 ${config.maxSeconds}s，中止` })
      return finish('timeout')
    }
    if (acc.costUsd > config.maxCostUsd) {
      send('note', { level: 'warn', message: `已超过成本上限 $${config.maxCostUsd}，中止` })
      return finish('cost')
    }

    acc.steps = step
    send('step_start', { step })

    // ---- 调模型
    let res
    try {
      res = await adapter.chat({
        apiModelId,
        messages,
        tools: TOOL_SCHEMAS,
        signal,
      })
    } catch (err) {
      send('error', { message: `请求上游失败：${err.message}` })
      return finish('error')
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      send('error', { message: `上游返回 ${res.status}：${detail.slice(0, 300)}` })
      return finish('error')
    }

    let out
    try {
      out = await consumeChatStream(res, {
        onDelta: (d) => send('assistant_delta', { step, delta: d }),
        onReasoning: (d) => send('reasoning_delta', { step, delta: d }),
      })
    } catch (err) {
      send('error', { message: `解析上游流失败：${err.message}` })
      return finish('error')
    }

    accumulateUsage(out, acc, price)
    if (out.reasoning) send('reasoning_done', { step, chars: out.reasoning.length })

    // ---- 模型不再调工具 = 任务结束
    if (!out.toolCalls.length) {
      send('assistant_text', { step, text: out.content })
      send('final', { text: out.content, finishReason: out.finishReason })
      return finish('final')
    }

    /*
      关键协议细节：带 tool_calls 的 assistant 消息必须原样回填到历史里，
      后面每条 tool 消息都要带 tool_call_id 与之对应。
      少一个字段，下一轮上游就会报错。
    */
    messages.push({
      role: 'assistant',
      content: out.content || '',
      tool_calls: out.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.args },
      })),
    })

    for (const call of out.toolCalls) {
      acc.toolCalls += 1
      const args = parseToolArgs(call.args)

      send('tool_call', {
        step,
        callId: call.id,
        name: call.name,
        args: args ?? {},
        argsRaw: call.args,
      })

      const pushToolResult = (content) => {
        messages.push({ role: 'tool', tool_call_id: call.id, content })
      }

      // ---- 参数解析失败
      if (args === null) {
        send('tool_result', {
          step,
          callId: call.id,
          name: call.name,
          ok: false,
          summary: '参数不是合法 JSON',
        })
        pushToolResult(`你的工具参数不是合法的 JSON，请重新生成。原始内容：${call.args}`)
        continue
      }

      // ---- 危险拦截（不问人，直接拒）
      let inspected = null
      if (call.name === 'write_file') {
        inspected = await inspectWrite(runId, args.filename)

        if (config.guard === 'block-destructive' && inspected.blocked) {
          acc.blocked += 1
          send('guard_blocked', {
            step,
            callId: call.id,
            name: call.name,
            args,
            reason: inspected.reason,
          })
          pushToolResult(`该操作已被安全策略拒绝：${inspected.reason}。请更换文件名或改用其他做法。`)
          continue
        }
      }

      // ---- 人工确认
      if (needsApproval(config, call.name, inspected)) {
        acc.approvals += 1
        const reason = inspected?.destructive
          ? `将覆盖已存在的文件 ${inspected.name}（当前 ${inspected.existsSize} 字节）`
          : '按当前配置，写入前需要你确认'

        send('approval_required', {
          step,
          callId: call.id,
          name: call.name,
          args,
          reason,
          destructive: Boolean(inspected?.destructive),
        })

        const decision = await waitApproval(call.id, { name: call.name, args, reason })

        send('approval_result', {
          step,
          callId: call.id,
          approved: decision.approved,
          note: decision.note ?? '',
        })

        if (!decision.approved) {
          pushToolResult('用户拒绝了这次操作。请不要重试同样的写入，改用其他方式或直接说明原因。')
          continue
        }
      }

      // ---- 执行（含按配置重试）
      let result
      let attempt = 0
      for (;;) {
        result = await executeTool(call.name, args, toolCtx)
        if (result.ok) break

        const canRetry =
          config.onToolError === 'retry' && attempt < config.maxRetries && !result.content.includes('已被安全策略拒绝')

        if (!canRetry) break

        attempt += 1
        acc.retries += 1
        send('tool_retry', {
          step,
          callId: call.id,
          name: call.name,
          attempt,
          max: config.maxRetries,
          reason: result.content,
        })
      }

      const summary = result.ok
        ? result.content
        : config.onToolError === 'continue'
          ? `${result.content}（按当前配置忽略此错误，继续执行）`
          : result.content

      send('tool_result', {
        step,
        callId: call.id,
        name: call.name,
        ok: result.ok,
        summary,
        meta: result.meta ?? null,
      })
      pushToolResult(summary)
    }

    // ---- 上下文裁剪
    if (config.contextStrategy === 'sliding') {
      const before = messages.length
      const trimmed = applySlidingWindow(messages)
      if (trimmed.length !== before) {
        acc.trimmed += before - trimmed.length
        messages.length = 0
        messages.push(...trimmed)
      }
    }

    send('step_end', { step, finishReason: out.finishReason })
  }

  send('note', { level: 'warn', message: `已达到步数上限 ${config.maxSteps}，中止` })
  return finish('max-steps')
}
