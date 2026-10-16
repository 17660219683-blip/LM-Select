/**
 * 服务端附件解析：把上传的文件抽成纯文本。
 *
 * 为什么放在服务端，而不是浏览器里（之前就是后者，踩了坑）：
 *
 *   1. 浏览器里那段解析改了 item.status，但改的是**原始对象**而不是 Vue 的
 *      响应式代理，绕过了 Proxy 的 set 拦截 —— 值改了却没有任何重渲染，
 *      界面永远停在"解析中"。这类问题在服务端根本不会存在。
 *   2. Node 版 mammoth / pdfjs 是这两个库的原生构建；浏览器版要靠打包器
 *      替换 package.json 的 browser 字段，多一层不确定性。
 *   3. 两个库加起来将近 1 MB，放前端就是白白拖慢首屏。
 *
 * 这也正是豆包网页版的做法：前端只负责上传，解析在服务端。
 */
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** 单次解析允许的最大正文字数，超了截断 */
export const MAX_EXTRACT_CHARS = 150000

/** PDF 最多解析多少页 */
const MAX_PDF_PAGES = 300

/** 能直接当纯文本读的扩展名 */
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'rst',
  'json', 'jsonl', 'csv', 'tsv', 'log',
  'yaml', 'yml', 'toml', 'ini', 'env', 'conf',
  'xml', 'html', 'htm', 'css', 'scss', 'less',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte',
  'py', 'java', 'go', 'rs', 'rb', 'php', 'swift', 'kt',
  'c', 'h', 'cpp', 'hpp', 'cc', 'cs',
  'sh', 'bash', 'ps1', 'bat', 'sql',
])

/** 认识、但当前抽不出文字的格式。提示要具体，不能笼统说"不支持" */
const UNSUPPORTED_HINT = {
  doc: '老式 .doc 是二进制格式，读不了。用 Word 另存为 .docx 或 PDF 再传。',
  pages: 'Apple Pages 文件读不了，导出成 PDF 或 .docx 再传。',
  xlsx: 'Excel 读不了，另存为 CSV 再传。',
  xls: '老式 Excel 读不了，另存为 CSV 再传。',
  pptx: 'PPT 读不了，导出成 PDF 再传。',
  ppt: '老式 PPT 读不了，导出成 PDF 再传。',
}

/** "报告.PDF" -> "pdf" */
export function extOf(name) {
  const i = String(name ?? '').lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

function count(n) {
  return n.toLocaleString('zh-CN')
}

/**
 * 把解析结果规整成可读文本。
 * PDF 抽出来的原始结果塞满了排版用的尾随空白和连续空行，
 * 不清理一遍会白烧掉一大截 token。
 */
function normalizeText(raw) {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 超出上限就截断，并把"截断过"这件事带回给调用方 */
function clamp(text) {
  if (text.length <= MAX_EXTRACT_CHARS) return { text, clipped: false }
  return { text: text.slice(0, MAX_EXTRACT_CHARS), clipped: true }
}

function noteOf(label, text, clipped) {
  return `${label} · 抽出 ${count(text.length)} 字${clipped ? '（已截断）' : ''}`
}

/**
 * 纯文本文件解码。
 *
 * Windows 中文环境下 .txt / .csv 往往是 GBK 而不是 UTF-8，
 * 无脑按 utf8 解会得到满屏乱码。这里先按 utf8 解，
 * 出现替换字符 U+FFFD 就说明解错了，再退回 GBK 重试。
 */
function decodeText(buffer) {
  // UTF-8 BOM 要剥掉，否则会变成正文开头的 \uFEFF
  const body =
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer

  const utf8 = new TextDecoder('utf-8').decode(body)
  if (!utf8.includes('\uFFFD')) return utf8

  try {
    const gbk = new TextDecoder('gbk').decode(body)
    // 只有 GBK 明显更干净时才采用，避免把真含 U+FFFD 的文件改坏
    if (!gbk.includes('\uFFFD')) return gbk
  } catch {
    // 运行时的 Node 没带完整 ICU，不支持 gbk，就用 utf8 的结果
  }

  return utf8
}

/** 把 pdfjs 抛出来的各种异常翻成人能看懂的话 */
function describePdfError(err) {
  const name = err?.name ?? ''
  if (name === 'PasswordException') return '这份 PDF 有密码保护，请先去掉密码再传。'
  if (name === 'InvalidPDFException') return '这个文件不是有效的 PDF，或者已经损坏。'
  return `PDF 打不开：${err?.message || err}`
}

/**
 * 抽 PDF 的文字层。
 * 用 legacy 构建：它是 pdfjs 官方为 Node 等非浏览器环境准备的，
 * 主构建依赖不少浏览器 API，在服务端跑不稳。
 */
async function extractPdf(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Node 里不设置 workerSrc 会报 "Setting up fake worker failed"
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  const { pathToFileURL } = await import('node:url')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

  const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'))

  /*
    ⚠️ 路径必须用正斜杠且带结尾斜杠。
    pdfjs 内部是按 `endsWith('/')` 校验的，Windows 上拼出来的反斜杠
    会被判为 "must include trailing slash" 直接报错 —— 而且这个错
    会盖住真正的解析流程，看起来像是 PDF 坏了。
  */
  const assetUrl = (dir) => `${path.join(pdfjsDir, dir).replace(/\\/g, '/')}/`

  /*
    ⚠️ destroy() 挂在 loading task 上，不在 PDFDocumentProxy 上（v5 起就改了）。
    照着旧版文档写 await doc.destroy() 会在**解析成功之后**才抛 TypeError。
    所以 task 必须留住。
  */
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),

    /*
      中文 PDF 大量使用 CID 编码的字体，cmaps 是把字符码映射回 Unicode 的字典。
      缺了它，那类 PDF 会整篇抽不出字。
      这些文件随 pdfjs-dist 一起装在 node_modules 里，直接用绝对路径读。
    */
    cMapUrl: assetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts'),

    isEvalSupported: false,
  })

  let doc
  try {
    doc = await task.promise
  } catch (err) {
    await task.destroy().catch(() => {})
    throw new Error(describePdfError(err), { cause: err })
  }

  try {
    const total = doc.numPages
    const pages = Math.min(total, MAX_PDF_PAGES)
    const chunks = []

    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n)
      try {
        const content = await page.getTextContent()

        /*
          getTextContent() 返回的是带位置信息的碎片，不是字符串。
          只按 str 拼接会丢掉所有换行，抽出来是一整坨；
          hasEOL 是 pdfjs 标好的换行标记，靠它才能还原段落。
        */
        let body = ''
        for (const item of content.items) {
          if (typeof item.str !== 'string') continue
          body += item.str
          if (item.hasEOL) body += '\n'
        }

        body = normalizeText(body)
        if (!body) continue

        // 单页文档加页码标记只是噪音，多页才有导航价值
        chunks.push(total > 1 ? `【第 ${n} 页】\n${body}` : body)
      } finally {
        page.cleanup()
      }
    }

    const raw = normalizeText(chunks.join('\n\n'))

    if (!raw) {
      throw new Error(
        '这份 PDF 抽不到文字，多半是扫描件（整页都是图片）。' +
          '可以把它转成图片后用「添加图片」传，让视觉模型直接看图。',
      )
    }

    const { text, clipped } = clamp(raw)
    const label = total > pages ? `共 ${total} 页 · 只解析了前 ${pages} 页` : `共 ${total} 页`
    return { text, note: noteOf(label, text, clipped) }
  } finally {
    // 清理失败不该盖掉上面真正的报错原因
    await task.destroy().catch(() => {})
  }
}

/** 抽 Word（.docx）正文。只支持 .docx，老式 .doc 会在派发层被拦下 */
async function extractDocx(buffer) {
  const mod = await import('mammoth')
  const mammoth = mod.default ?? mod

  let value
  try {
    // Node 构建认的是 buffer（浏览器构建才认 arrayBuffer）
    const result = await mammoth.extractRawText({ buffer })
    value = result.value
  } catch (err) {
    throw new Error(`Word 打不开：${err?.message || err}`, { cause: err })
  }

  const raw = normalizeText(value)

  if (!raw) {
    throw new Error('这份 Word 里没有可提取的文字（可能整篇都是图片或表格截图）。')
  }

  const { text, clipped } = clamp(raw)
  return { text, note: noteOf('Word 正文', text, clipped) }
}

/**
 * 按扩展名派发。抽不出文字时抛 Error，message 直接面向用户，
 * 路由层原样回给前端展示。
 *
 * @param {{buffer: Buffer, filename: string}} input
 * @returns {Promise<{text: string, note: string}>}
 */
export async function extract({ buffer, filename }) {
  if (!buffer?.length) throw new Error('文件是空的。')

  const ext = extOf(filename)

  if (TEXT_EXT.has(ext)) {
    const text = normalizeText(decodeText(buffer))
    if (!text) throw new Error('这个文件里没有可读取的文字。')

    const { text: out, clipped } = clamp(text)
    return { text: out, note: noteOf('文本文件', out, clipped) }
  }

  if (ext === 'pdf') return extractPdf(buffer)
  if (ext === 'docx') return extractDocx(buffer)

  throw new Error(
    UNSUPPORTED_HINT[ext] ??
      (ext
        ? `读不了 .${ext} 格式的文件，请先转成文本或 PDF。`
        : `认不出「${filename}」是什么格式，请加上扩展名后重试。`),
  )
}
