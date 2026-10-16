/**
 * 附件解析接口（/api/attachments/parse）。
 *
 * 前端把文件原样 POST 上来，服务端抽成纯文本再返回。
 * 前端拿到 text 后拼进题目，和之前完全一样 —— 变的只是"谁来解析"。
 */
import express from 'express'

import { extract } from '../extract.js'

const router = express.Router()

/**
 * 上传上限。
 * 前端把单文件卡在 10MB，这里留一点余量，正常情况不会撞上。
 */
const MAX_UPLOAD = '12mb'

/*
  直接收原始字节流，不用 multipart。

  multipart 要额外引 busboy / multer，而这里只有一个文件、
  没有别的表单字段，用不上那套协议。
  前端把 File 直接当 body 发，文件名放 X-File-Name 头，
  服务端拿到的就是一个干净的 Buffer，也不用解析边界串。
*/
const rawBody = express.raw({ type: 'application/octet-stream', limit: MAX_UPLOAD })

router.post('/attachments/parse', rawBody, async (req, res) => {
  /*
    HTTP 头只能放 latin-1，中文文件名必须先编码，否则直接报错。
    前端做 encodeURIComponent，这里解回来。
  */
  const rawName = req.get('X-File-Name') ?? ''
  let filename = rawName
  try {
    filename = decodeURIComponent(rawName)
  } catch {
    // 万一没编码，就用原值，至少还能靠扩展名派发
  }

  if (!filename.trim()) {
    return res.status(400).json({ error: '缺少 X-File-Name 请求头，无法判断文件类型。' })
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: '请求体是空的，文件没传上来。' })
  }

  try {
    const { text, note } = await extract({ buffer: req.body, filename })
    res.json({ ok: true, text, note, chars: text.length })
  } catch (err) {
    /*
      解析失败是"用户该知道怎么办"的问题（格式不支持、PDF 有密码、
      扫描件抽不出字……），用 400 把 message 原样带给前端展示；
      用 500 会让界面显示成"服务器错误"，把用户引向错误方向。
    */
    res.status(400).json({ error: err.message })
  }
})

/* 请求体超过上限时 body-parser 抛的错，翻成人话 */
router.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '文件太大，超过了服务端的上传上限。' })
  }
  next(err)
})

export default router
