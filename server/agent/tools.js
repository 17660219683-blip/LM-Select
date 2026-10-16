/**
 * agent 可用的工具。
 *
 * 第一版刻意只做两个：read_file / write_file。
 * 这个组合刚好够演示整个设计的核心对照 —— "全自动"与"强确认"的差别，
 * 正好落在 write_file 上（要不要弹授权、要不要拦覆盖）。
 *
 * 刻意没做 run_python 与 web_search：
 *   前者要真沙箱，Node 里做隔离比想象的麻烦；
 *   后者要多一份搜索 API 与 key。
 *   两者都会让第一版的变量变多，而这一版要验证的是"轨迹能不能看出差异"，
 *   不是"工具够不够多"。
 */
import fs from 'node:fs/promises'

import { MAX_ARTIFACT_BYTES, artifactPath, inspectWrite, listArtifacts } from './sandbox.js'

/** 单次读回正文的长度上限，防止把上下文撑爆 */
const MAX_READ_CHARS = 20000

/**
 * 工具 schema（OpenAI 兼容格式）。
 *
 * 描述写得比"够用"详细一点是刻意的：
 * 工具描述的质量本身就是脚手架的一部分，也会影响模型的表现。
 * 后面做参数对比时，"描述详细 vs 简略"是可以作为一个变量去测的。
 */
export const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        '读取一份文件的纯文本内容。可以读两类：用户在这次任务里上传的附件，' +
        '以及你自己在本次任务中写出的文件（用来自查）。' +
        '如果记不清有哪些文件，直接调用它并留空 name，会返回可用清单。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '文件名，例如 report.txt' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        '把内容写成一份文件，供用户下载。文件名只能是扁平的名字（不带目录）。' +
        '如果同名文件已存在，会被覆盖。写完后请把文件名告诉用户。',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件名，例如 result.csv' },
          content: { type: 'string', description: '文件的完整内容' },
        },
        required: ['filename', 'content'],
      },
    },
  },
]

export const TOOL_NAMES = TOOL_SCHEMAS.map((t) => t.function.name)

/**
 * 按文件名找附件：先精确，再忽略大小写，最后按"附件名包含查询"匹配。
 *
 * ⚠️ 方向不能反。
 * 之前这里还有一条 `query.includes(附件名去掉扩展名)` 的兜底，
 * 结果是模型要读自己刚写的 `sales.csv` 时命中了附件 `sales.txt`，
 * 静默返回了错误的内容 —— 模型自己发现并如实报告了"读到的还是原文件"。
 * agent 最怕的就是这种静默错误：它不会报错，只会让模型基于错数据往下走。
 * 所以模糊匹配只允许"查询是附件名的子串"（模型忘了扩展名时仍能命中），
 * 反过来一律不匹配。
 */
function findAttachment(ctx, name) {
  const list = ctx.attachments ?? []
  const key = String(name ?? '').trim()
  if (!key) return null

  const lower = key.toLowerCase()

  return (
    list.find((a) => a.name === key) ??
    list.find((a) => a.name.toLowerCase() === lower) ??
    list.find((a) => a.name.toLowerCase().includes(lower)) ??
    null
  )
}

async function runReadFile(args, ctx) {
  const wanted = String(args?.name ?? '').trim()

  // ---- 1. 先当附件找
  const hit = findAttachment(ctx, wanted)
  if (hit) {
    const text = String(hit.text ?? '')
    const truncated = text.length > MAX_READ_CHARS
    return {
      ok: true,
      content: truncated
        ? `${text.slice(0, MAX_READ_CHARS)}\n\n（内容过长，只返回了前 ${MAX_READ_CHARS} 字）`
        : text,
      meta: { name: hit.name, source: 'attachment', chars: text.length, truncated },
    }
  }

  /*
    ---- 2. 再当"本次运行产出的文件"找

    这一步是让 verify=self-check（写完自检）真正成立的前提。
    之前只能读附件，模型写完文件后回头根本读不到，
    所谓"自检"就只能是一句空话 —— 上一轮实测里模型自己在答复中指出了这点。
  */
  if (wanted) {
    const file = await artifactPath(ctx.runId, wanted)
    if (file) {
      const text = await fs.readFile(file, 'utf8').catch(() => null)
      if (text !== null) {
        const truncated = text.length > MAX_READ_CHARS
        return {
          ok: true,
          content: truncated
            ? `${text.slice(0, MAX_READ_CHARS)}\n\n（内容过长，只返回了前 ${MAX_READ_CHARS} 字）`
            : text,
          meta: { name: wanted, source: 'artifact', chars: text.length, truncated },
        }
      }
    }
  }

  // ---- 3. 都没有：把可用清单还给它，让它下一步能自己纠错
  const available = (ctx.attachments ?? []).map((a) => a.name)
  const produced = (await listArtifacts(ctx.runId)).map((a) => a.name)

  const parts = []
  if (available.length) parts.push(`用户上传的附件：${available.join('、')}`)
  if (produced.length) parts.push(`你本次已经写出的文件：${produced.join('、')}`)

  return {
    ok: false,
    content: wanted
      ? `找不到「${wanted}」。${parts.join('；') || '当前没有任何可读文件。'}`
      : `未指定文件名。${parts.join('；') || '当前没有任何可读文件。'}`,
    meta: { available, produced },
  }
}

async function runWriteFile(args, ctx) {
  const filename = args?.filename
  const content = String(args?.content ?? '')

  /*
    写之前必须重新走一遍 inspectWrite，而不是复用循环里那次判定。
    原因：从"循环判定"到"真正落盘"之间存在时间差，
    这期间同名文件可能已被创建（比如模型连续两次写同一个名字）。
    安全判定和实际动作之间不该有信任假设。
  */
  const inspected = await inspectWrite(ctx.runId, filename)
  if (!inspected.ok) {
    return { ok: false, content: `写入被拒绝：${inspected.reason}` }
  }

  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_ARTIFACT_BYTES) {
    return {
      ok: false,
      content: `内容过大（${(bytes / 1024).toFixed(0)} KB），上限 ${MAX_ARTIFACT_BYTES / 1024 / 1024} MB`,
    }
  }

  try {
    await fs.writeFile(inspected.absolute, content, 'utf8')
  } catch (err) {
    return { ok: false, content: `写入失败：${err.message}` }
  }

  return {
    ok: true,
    content: `已写入 ${inspected.name}（${bytes} 字节）`,
    meta: { name: inspected.name, bytes, overwrote: inspected.destructive },
  }
}

/**
 * 执行一次工具调用。
 *
 * @returns {Promise<{ok: boolean, content: string, meta?: object}>}
 *   content 会作为 tool 角色的消息回喂给模型，所以措辞要面向模型，
 *   失败时尽量给出"下一步该怎么办"，而不是只报错。
 */
export async function executeTool(name, args, ctx) {
  switch (name) {
    case 'read_file':
      return runReadFile(args, ctx)
    case 'write_file':
      return runWriteFile(args, ctx)
    default:
      return { ok: false, content: `没有名为「${name}」的工具。` }
  }
}
