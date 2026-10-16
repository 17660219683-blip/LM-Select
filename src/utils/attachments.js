/**
 * 对比测试的附件处理（前端这一侧）。
 *
 * 前端只负责两件事：
 *   image —— 生成 blob URL 做缩略图，执行阶段缩成 data URL 发给模型
 *   file  —— 原样上传给服务端，由服务端抽成纯文本（见 server/extract.js）
 *
 * 解析为什么不放前端：mammoth / pdfjs 加起来近 1MB，浏览器构建还得靠
 * 打包器替换 package.json 的 browser 字段，不如 Node 原生构建可控。
 * 豆包网页版也是这个分工 —— 前端只上传，解析在服务端。
 *
 * 三步走，职责分开：
 *   readAttachment  同步：校验大小/数量，建出条目（此时内容还是空的）
 *   parseAttachment 异步：非图片附件上传给服务端，把返回的正文填进 item
 *
 * 拆开是为了让附件立刻出现在界面上并显示"解析中"，
 * 而不是点了之后界面毫无反应、过几秒才冒出来。
 */

import { parseFile } from '@/services/attachmentApi'

/** 一次最多挂几个附件 */
export const MAX_ATTACHMENTS = 5

/**
 * 单个文件大小上限。
 * 服务端另有一道限制，这里先拦一道是为了省掉一次注定失败的上传。
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

export function isImage(file) {
  return file.type.startsWith('image/')
}

/** 1048576 -> "1.0 MB" */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 校验一个文件并建出条目。**同步**，此时内容还是空的。
 * 内容由随后的 parseAttachment 填。
 *
 * @returns {{ok: true, item: object} | {ok: false, reason: string}}
 */
export function readAttachment(file, existingCount) {
  if (existingCount >= MAX_ATTACHMENTS) {
    return { ok: false, reason: `最多只能挂 ${MAX_ATTACHMENTS} 个附件` }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: `${file.name} 超过 ${formatSize(MAX_FILE_SIZE)}` }
  }
  if (file.size === 0) {
    return { ok: false, reason: `${file.name} 是空文件` }
  }

  const isImg = isImage(file)

  const item = {
    id: makeId(),
    name: file.name,
    size: file.size,
    mime: file.type || '未知类型',
    kind: isImg ? 'image' : 'file',

    /** 原始 File，执行阶段要用。File 不是普通对象，Vue 不会代理它 */
    file,

    /**
     * parsing —— 正在上传/解析，还不能送进模型
     * ready   —— 内容已就绪（图片=原图，文件=text 非空）
     * error   —— 上传或解析失败，error 里是服务端给的原因
     */
    status: isImg ? 'ready' : 'parsing',
    error: '',

    /** 图片缩略图用的 blob URL，移除时要 revoke */
    previewUrl: '',
    /** 文件正文。图片不用这个字段 */
    text: '',
    /** 给用户看的解析结果摘要，例如「共 12 页 · 抽出 8,432 字」 */
    note: '',
  }

  if (isImg) item.previewUrl = URL.createObjectURL(file)

  return { ok: true, item }
}

/**
 * 把条目里的内容准备好。图片不需要这一步（原图就是内容）。
 *
 * ⚠️ item 必须是**响应式代理**（即从 Pinia state 里取回来的那个），
 * 不能是刚造出来的原始对象。直接改原始对象会绕过 Vue 的 Proxy set 拦截：
 * 值确实变了，但不会触发任何重渲染，界面就永远停在"解析中"。
 */
export async function parseAttachment(item) {
  if (!item || item.kind === 'image') return

  try {
    const { text, note } = await parseFile(item.file)

    // 服务端理论上不会回空，但空文本等同于"没送出去"，这里再兜一道
    if (!text.trim()) throw new Error('这个文件里没有可读取的文字。')

    item.text = text
    item.note = note
    item.status = 'ready'
  } catch (err) {
    item.status = 'error'
    item.error = err?.message || String(err)
  }
}

/** 释放图片的 blob URL，避免内存泄漏 */
export function releaseAttachment(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl)
    item.previewUrl = ''
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
    reader.readAsDataURL(file)
  })
}

/**
 * 把图片转成可直接发给模型的 data URL。
 *
 * 两个原因不能直接发原图：
 *   1. 原图动辄十几 MB，base64 后还要再涨三分之一，会撞上后端请求体上限；
 *   2. 视觉模型对分辨率有上限，超出的部分既浪费 token 也不提升效果。
 * 所以先等比缩到 maxEdge 以内，再按 JPEG 重编码。
 *
 * 1568 是常用的视觉输入长边上限，多数模型在这个尺寸下不会丢细节。
 */
export async function toSendableImage(file, maxEdge = 1568) {
  const bitmap = await createImageBitmap(file)

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, maxEdge / longest)

    // 本来就又小又轻，不必重编码，直接读原始数据
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
      return await fileToDataUrl(file)
    }

    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)

    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    // ImageBitmap 占的是显存/内存，用完要显式释放
    bitmap.close?.()
  }
}
