/**
 * 对比测试接口。
 *
 * 前端只发数据库里的 model_version.id，服务端负责：
 *   1. 查出这个模型的真实 API 名与所属厂商；
 *   2. 找到该厂商的适配器；
 *   3. 转发调用并把上游的 SSE 原样透传给浏览器。
 *
 * 这样做的好处：API key 永远留在服务端，前端拿不到也传不了；
 * 换厂商只改适配器，路由和前端都不用动。
 */
import { Router } from 'express'

import { pool } from '../db.js'
import { getAdapter, listAdapters } from '../providers/index.js'

const router = Router()

/* ------------------------------------------------------------------ */
/* 哪些厂商已经配好了 key                                              */
/* ------------------------------------------------------------------ */

router.get('/compare/providers', (req, res) => {
  res.json({ providers: listAdapters() })
})

/* ------------------------------------------------------------------ */
/* 发起一次调用（流式）                                                */
/* ------------------------------------------------------------------ */

router.post('/compare/run', async (req, res, next) => {
  const { modelId, text, images, system } = req.body ?? {}

  const id = Number(modelId)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'modelId 无效' })
  }

  const body = typeof text === 'string' ? text.trim() : ''
  const pics = Array.isArray(images) ? images.filter((u) => typeof u === 'string' && u) : []

  /*
    文字和图片至少要有一个。
    文案要说清"两样都没有"，而不是只说"题目不能为空" —— 后者在用户
    明明挂了附件（但内容没成功送达）时特别误导，会把排查方向带偏。
  */
  if (!body && !pics.length) {
    return res.status(400).json({ error: '题目和附件都是空的，没有可发送的内容' })
  }

  let model
  try {
    const [rows] = await pool.query(
      `SELECT mv.id, mv.api_model_id, mv.display_name, mv.status,
              v.code AS vendor_code, v.name AS vendor_name, v.name_zh AS vendor_name_zh
         FROM model_version mv
         JOIN model_family mf ON mf.id = mv.family_id
         JOIN vendor       v  ON v.id  = mf.vendor_id
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
    return res.status(400).json({
      error: `暂不支持调用 ${vendorLabel} —— 还没有对应的适配器。目前只接了 DeepSeek。`,
    })
  }
  if (!adapter.isConfigured()) {
    return res.status(400).json({ error: adapter.missingKeyHint() })
  }

  /*
    客户端断开时掐掉上游，别让云端继续计费。
    必须监听 res 而不是 req：req 的 'close' 在请求体读完时就触发
    （express.json() 一读完就触发），那时候调用还没开始。
  */
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  let upstream
  try {
    /*
      有图片时用多模态的 content 数组，没有则用普通字符串。
      有些厂商对纯文本请求只接受字符串形式，所以不能无脑用数组。
    */
    const content = pics.length
      ? [
          ...(body ? [{ type: 'text', text: body }] : []),
          ...pics.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
      : body

    upstream = await adapter.chat({
      apiModelId: model.api_model_id,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content },
      ],
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
      error: `${vendorLabel} 返回 ${upstream.status}${
        detail ? `：${detail.slice(0, 400)}` : ''
      }`,
    })
  }

  // 让前端知道实际用的是哪个模型名，便于排查
  res.setHeader('X-Vendor', model.vendor_code)
  res.setHeader('X-Api-Model-Id', model.api_model_id)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  // 有反向代理时禁用缓冲，否则流会被攒成一坨再发
  res.setHeader('X-Accel-Buffering', 'no')

  const reader = upstream.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  } catch (err) {
    // 客户端主动断开是正常路径，不该当错误刷日志
    if (!controller.signal.aborted) console.warn('[compare] 流中断：', err.message)
  } finally {
    res.end()
  }
})

export default router
