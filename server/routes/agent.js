/**
 * Agent 试跑接口（/api/agent/*）。
 *
 * ⚠️ 当前状态：**前端没有调用方**。
 *    /agent 页现在只做界面复刻展示，那套"脚手架试跑"的前端已经移除。
 *    这里整体保留，是因为它已经端到端验证过（循环、工具、沙箱、审批往返、
 *    产物下载都能跑），以后要在复刻弹窗里加真实功能时可以直接捡回来，
 *    不必重写。删掉它是不可逆的，留着不占运行时开销。
 *
 * 与对比测试页的分工：
 *   对比页跑的是"模型的回答"，一次请求一次响应，无中间状态；
 *   agent 跑的是"一个过程"，会调工具、可能中途要人确认，所以：
 *     - 用 SSE 把轨迹事件实时推给前端（前端据此画时间线）
 *     - 用 /agent/approve 做**反向**通信（前端把用户的决定送回循环里）
 *     - 产物落在按 run 隔离的工作目录，用 /agent/artifacts 下载
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import express from 'express'

import { runAgent } from '../agent/loop.js'
import { describeScaffold, normalizeConfig } from '../agent/presets.js'
import { artifactPath, ensureWorkspace, isValidRunId, listArtifacts } from '../agent/sandbox.js'
import { pool } from '../db.js'
import { getAdapter } from '../providers/index.js'
import { PRICE_SUBQUERY } from './models.js'

const router = express.Router()

/**
 * 等用户点授权卡片的最长时间。
 * 超时按"拒绝"处理而不是"同意" —— 拿不准的时候，安全的那一边是拒绝。
 */
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * 待确认的授权请求：callId -> { resolve, timer }。
 *
 * 这是本项目里唯一一处需要**双向**通信的地方：
 * SSE 只能服务端往客户端推，而"用户点同意"必须反向传回来，
 * 所以循环在这里挂起，等另一个 HTTP 请求把它唤醒。
 */
const pendingApprovals = new Map()

function waitApproval(callId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(callId)
      resolve({ approved: false, note: `超过 ${APPROVAL_TIMEOUT_MS / 1000} 秒未确认，已自动拒绝` })
    }, APPROVAL_TIMEOUT_MS)

    pendingApprovals.set(callId, { resolve, timer })
  })
}

/** 上一次运行挂起时把定时器清掉，避免泄漏 */
function dropPending(callIds) {
  for (const id of callIds) {
    const p = pendingApprovals.get(id)
    if (p) {
      clearTimeout(p.timer)
      pendingApprovals.delete(id)
    }
  }
}

// ------------------------------------------------------------------ 配置

router.get('/agent/presets', (_req, res) => {
  res.json(describeScaffold())
})

// ------------------------------------------------------------------ 试用对话

/**
 * 试用对话用的模型。
 *
 * 写死是刻意的：试用页要的是"界面像不像、用起来顺不顺"，
 * 模型固定成同一个，换一个复刻件时体验才有可比性。
 */
const TRIAL_API_MODEL_ID = 'deepseek-flash'

/**
 * POST /api/agent/chat —— 多轮试用对话。
 *
 * 与 /compare/run 的唯一区别：**它接受完整的消息历史**。
 * compare 是"一道题问一次"，只拼一条 user 消息；
 * 试用对话是多轮的，必须把之前的往来一起发上去，否则模型没有上下文，
 * 第二句就接不上了。
 */
router.post('/agent/chat', async (req, res, next) => {
  const { messages: rawMessages, modelId } = req.body ?? {}

  /*
    只放行 user / assistant 两种角色，并且再过一遍长度。
    前端理论上不会发别的，但这里是信任边界 —— 服务端不该假设前端是对的。
  */
  const messages = (Array.isArray(rawMessages) ? rawMessages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .filter((m) => typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
    // 只留最近若干条：试用对话不做持久化，但单轮上下文仍要有上限
    .slice(-40)

  if (!messages.length) {
    return res.status(400).json({ error: '没有可发送的消息' })
  }
  if (!messages.some((m) => m.role === 'user')) {
    return res.status(400).json({ error: '缺少用户消息' })
  }

  let model
  try {
    const byId = Number.isInteger(Number(modelId)) && Number(modelId) > 0
    const [rows] = await pool.query(
      `SELECT mv.id, mv.api_model_id, mv.display_name,
              v.code AS vendor_code, v.name AS vendor_name, v.name_zh AS vendor_name_zh
         FROM model_version mv
         JOIN model_family mf ON mf.id = mv.family_id
         JOIN vendor       v  ON v.id  = mf.vendor_id
        WHERE ${byId ? 'mv.id = ?' : 'mv.api_model_id = ?'}
        LIMIT 1`,
      [byId ? Number(modelId) : TRIAL_API_MODEL_ID],
    )
    if (!rows.length) {
      return res.status(404).json({
        error: byId ? '模型不存在' : `模型库里找不到 ${TRIAL_API_MODEL_ID}`,
      })
    }
    model = rows[0]
  } catch (err) {
    return next(err)
  }

  const vendorLabel = model.vendor_name_zh || model.vendor_name
  const adapter = getAdapter(model.vendor_code)

  if (!adapter) {
    return res.status(400).json({ error: `暂不支持调用 ${vendorLabel} —— 还没有对应的适配器。` })
  }
  if (!adapter.isConfigured()) {
    return res.status(400).json({ error: adapter.missingKeyHint() })
  }

  /*
    客户端断开时掐掉上游，别让云端继续计费。
    必须监听 res 而不是 req —— req 的 'close' 在请求体读完时就触发了。
  */
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  let upstream
  try {
    upstream = await adapter.chat({
      apiModelId: model.api_model_id,
      messages,
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.headersSent) res.status(499).end()
      return
    }
    return res.status(502).json({ error: `连不上 ${vendorLabel}：${err.message}` })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return res.status(upstream.status || 502).json({
      error: `${vendorLabel} 返回 ${upstream.status}${detail ? `：${detail.slice(0, 400)}` : ''}`,
    })
  }

  // 让前端知道实际用的是哪个模型名，便于排查
  res.setHeader('X-Api-Model-Id', model.api_model_id)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  // 有反向代理时禁用缓冲，否则流会被攒成一坨再发
  res.setHeader('X-Accel-Buffering', 'no')

  const reader = upstream.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } catch (err) {
    // 客户端主动断开是正常路径，不该当错误刷日志
    if (!controller.signal.aborted) console.warn('[agent/chat] 流中断：', err.message)
  } finally {
    res.end()
  }
})

// ------------------------------------------------------------------ 运行

router.post('/agent/run', async (req, res, next) => {
  const { modelId, task, attachments, config: rawConfig } = req.body ?? {}

  const id = Number(modelId)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'modelId 无效' })
  }

  const goal = typeof task === 'string' ? task.trim() : ''
  if (!goal) {
    return res.status(400).json({ error: '任务描述不能为空' })
  }

  /*
    附件正文由前端先经 /api/attachments/parse 解析好再传上来。
    这里只做形状校验 —— 复用已经验证过的解析链路，不在这里重做一遍。
  */
  const files = (Array.isArray(attachments) ? attachments : [])
    .filter((a) => a && typeof a.name === 'string' && typeof a.text === 'string')
    .slice(0, 5)
    .map((a) => ({ name: a.name, text: a.text }))

  const config = normalizeConfig(rawConfig)
  const runId = crypto.randomUUID()

  let model
  try {
    const [rows] = await pool.query(
      `SELECT mv.id, mv.api_model_id, mv.display_name,
              v.code AS vendor_code, v.name AS vendor_name, v.name_zh AS vendor_name_zh,
              pr.input_usd, pr.output_usd, pr.cache_read_usd
         FROM model_version mv
         JOIN model_family mf ON mf.id = mv.family_id
         JOIN vendor       v  ON v.id  = mf.vendor_id
         LEFT JOIN (${PRICE_SUBQUERY}) pr ON pr.model_version_id = mv.id
        WHERE mv.id = ?`,
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: '模型不存在' })
    model = rows[0]
  } catch (err) {
    return next(err)
  }

  const vendorLabel = model.vendor_name_zh || model.vendor_name
  const adapter = getAdapter(model.vendor_code)

  if (!adapter) {
    return res.status(400).json({ error: `暂不支持调用 ${vendorLabel} —— 还没有对应的适配器。` })
  }
  if (!adapter.isConfigured()) {
    return res.status(400).json({ error: adapter.missingKeyHint() })
  }

  try {
    await ensureWorkspace(runId)
  } catch (err) {
    return next(err)
  }

  // ---- SSE 就绪
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const emit = (ev) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(ev)}\n\n`)
  }

  /*
    客户端断开时中止上游。
    必须监听 res 而不是 req —— req 的 'close' 在请求体读完时就触发，
    那时候循环还没开始（对比测试页踩过这个坑）。
  */
  const controller = new AbortController()
  let myCallIds = []

  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
    dropPending(myCallIds)
  })

  // 记录这次运行产生的 callId，断开时好清理
  const wrappedWaitApproval = (callId) => {
    myCallIds.push(callId)
    return waitApproval(callId)
  }

  const wrappedEmit = (ev) => {
    emit(ev)
  }

  try {
    await runAgent({
      runId,
      adapter,
      apiModelId: model.api_model_id,
      config,
      task: goal,
      attachments: files,
      price: {
        inputUsd: model.input_usd,
        outputUsd: model.output_usd,
        cacheReadUsd: model.cache_read_usd,
      },
      emit: wrappedEmit,
      waitApproval: wrappedWaitApproval,
      signal: controller.signal,
    })

    // 循环结束后把产物清单推给前端，供下载
    const artifacts = await listArtifacts(runId)
    emit({ type: 'artifacts', seq: 9999, t: 0, runId, artifacts })
  } catch (err) {
    emit({ type: 'error', seq: 9999, t: 0, message: err.message })
  } finally {
    dropPending(myCallIds)
    if (!res.writableEnded) res.end()
  }
})

// ------------------------------------------------------------------ 审批往返

router.post('/agent/approve', (req, res) => {
  const { callId, approved, note } = req.body ?? {}

  const pending = pendingApprovals.get(String(callId ?? ''))
  if (!pending) {
    // 超时或已被处理。用 404 而不是 400，前端据此提示"这次确认已过期"
    return res.status(404).json({ error: '这次确认请求不存在或已过期' })
  }

  clearTimeout(pending.timer)
  pendingApprovals.delete(String(callId))
  pending.resolve({ approved: Boolean(approved), note: typeof note === 'string' ? note : '' })

  res.json({ ok: true })
})

// ------------------------------------------------------------------ 产物

router.get('/agent/artifacts/:runId/:name', async (req, res, next) => {
  const { runId, name } = req.params

  if (!isValidRunId(runId)) {
    return res.status(400).json({ error: 'runId 不合法' })
  }

  try {
    const file = await artifactPath(runId, name)
    if (!file) return res.status(404).json({ error: '文件不存在' })

    /*
      一律以附件形式下载，并且强制 octet-stream。
      绝不能让浏览器按内容猜类型去内联渲染 —— 产物内容由模型生成，
      当成 HTML 内联就等于让模型往我们域里注入脚本。
    */
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
    fs.createReadStream(file).pipe(res)
  } catch (err) {
    next(err)
  }
})

export default router
