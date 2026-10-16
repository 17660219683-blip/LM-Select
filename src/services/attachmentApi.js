/**
 * 附件解析接口（对应 server/routes/attachments.js）。
 *
 * 前端只负责把文件原样传上去，抽文字的活全在服务端 ——
 * mammoth / pdfjs 加起来近 1MB，且 Node 版是它们的原生构建，
 * 比塞进浏览器包更可控。豆包网页版也是这个分工。
 */
import { API_BASE } from '@/config'

/**
 * 上传一个文件，拿回抽好的纯文本。
 *
 * @param {File} file
 * @returns {Promise<{text: string, note: string}>}
 */
export async function parseFile(file) {
  let res
  try {
    res = await fetch(`${API_BASE}/attachments/parse`, {
      method: 'POST',
      headers: {
        // 必须显式指定：服务端按这个类型走 express.raw，否则收不到 Buffer
        'Content-Type': 'application/octet-stream',
        // HTTP 头只能放 latin-1，中文文件名不编码会直接抛错
        'X-File-Name': encodeURIComponent(file.name),
      },
      // File 本身就是 Blob，直接当 body 发，浏览器会自动带 Content-Length
      body: file,
    })
  } catch (err) {
    throw new Error(
      '连不上后端服务。附件要由服务端解析，请确认它已启动' +
        '（npm run server，或 npm run dev:all 一起起前后端）。',
      { cause: err },
    )
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // 后端没回 JSON（比如被代理截断），下面按状态码兜底
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `附件解析失败（HTTP ${res.status}）`)
  }

  return { text: data.text ?? '', note: data.note ?? '' }
}
