/**
 * 工作目录隔离与路径校验。
 *
 * 为什么把这当成第一等的事：
 *   模型只会说话，agent 会**动手**。一个能写文件的 agent，
 *   如果路径校验漏了一处，一次运行就能把项目源码覆盖掉。
 *   所以所有写操作都必须被限制在按运行隔离的目录里，
 *   并且文件名要过一遍白名单式校验，而不是"拼起来再规范化"。
 *
 * 第一版刻意做得很保守：**只允许扁平的纯文件名**，不支持子目录。
 * 代价是模型不能建目录结构，收益是攻击面小到可以一眼看全。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** 所有产物都落在这个根目录下，每次运行再分一个子目录 */
export const WORKSPACE_ROOT = path.join(here, 'workspace')

/** 单个产物的大小上限 */
export const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024

/** Windows 上这些名字是设备名，当文件名会出各种怪问题 */
const RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

/** Windows 文件名里不允许出现的可见字符 */
const ILLEGAL_CHARS = /[<>:"/\\|?*]/

/**
 * 是否含控制字符。
 *
 * 用显式循环而不是正则里的 \u0000-\u001f：控制字符在正则里既难读，
 * 又会被 lint 规则当成 bug 拦下来（那条规则本身是对的，只是这里是有意的）。
 * 写成循环意图更直白，也不用为它加豁免注释。
 */
function hasControlChar(s) {
  for (const ch of s) {
    const code = ch.codePointAt(0)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** runId 的形状：只允许十六进制与短横线，杜绝 `../` 之类 */
const RUN_ID_RE = /^[a-z0-9-]{6,64}$/i

export function isValidRunId(runId) {
  return typeof runId === 'string' && RUN_ID_RE.test(runId)
}

export function workspaceDir(runId) {
  if (!isValidRunId(runId)) throw new Error('runId 不合法')
  return path.join(WORKSPACE_ROOT, runId)
}

/**
 * 校验一个产物文件名。
 *
 * 刻意用"只放行已知安全的形状"而不是"过滤掉危险字符"：
 * 后者永远可能漏，而前者漏不了。
 *
 * @returns {{ok: true, name: string} | {ok: false, reason: string}}
 */
export function safeName(input) {
  const raw = String(input ?? '').trim()

  if (!raw) return { ok: false, reason: '文件名为空' }
  if (raw.length > 120) return { ok: false, reason: '文件名过长（超过 120 字符）' }
  if (raw.includes('..')) return { ok: false, reason: '文件名不能包含 ..' }
  if (ILLEGAL_CHARS.test(raw) || hasControlChar(raw)) {
    return { ok: false, reason: '文件名包含非法字符（<>:"/\\|?* 或控制字符）' }
  }
  if (raw !== raw.replace(/^\.+/, '')) return { ok: false, reason: '文件名不能以点开头' }
  if (/[. ]$/.test(raw)) return { ok: false, reason: '文件名不能以点或空格结尾' }

  const base = raw.split('.')[0].toLowerCase()
  if (RESERVED.has(base)) return { ok: false, reason: `「${base}」是系统保留名，不能作为文件名` }

  return { ok: true, name: raw }
}

/**
 * 检查一次写入。
 *
 * 返回的信息同时供三处使用：
 *   guard    —— 看 blocked，决定是否直接拒绝
 *   approval —— 看 destructive，决定是否需要弹授权
 *   工具执行 —— 看 absolute，直接拿来写
 *
 * 这样"该不该拦"和"该不该问"就都建立在同一份判定上，不会出现两处逻辑打架。
 *
 * @returns {{ok: boolean, blocked: boolean, reason?: string, absolute?: string,
 *            name?: string, destructive?: boolean, existsSize?: number}}
 */
export async function inspectWrite(runId, filename) {
  const checked = safeName(filename)
  if (!checked.ok) {
    // 路径类问题属于"确定危险"，直接拦截，不弹给用户去点
    return { ok: false, blocked: true, reason: checked.reason }
  }

  const dir = workspaceDir(runId)
  const absolute = path.join(dir, checked.name)

  /*
    兜底断言：即使 safeName 被改坏，这里也要保证最终路径确实落在工作目录内。
    安全校验不该只有一道。
  */
  const rel = path.relative(dir, absolute)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, blocked: true, reason: '路径越界，已拒绝' }
  }

  let existsSize = null
  try {
    const st = await fs.stat(absolute)
    if (st.isFile()) existsSize = st.size
  } catch {
    /* 不存在就是新建，正常 */
  }

  return {
    ok: true,
    blocked: false,
    absolute,
    name: checked.name,
    // 覆盖已有文件才算破坏性；新建不算
    destructive: existsSize !== null,
    existsSize,
  }
}

export async function ensureWorkspace(runId) {
  const dir = workspaceDir(runId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** 列出这次运行产出的所有文件 */
export async function listArtifacts(runId) {
  const dir = workspaceDir(runId)
  try {
    const names = await fs.readdir(dir)
    const out = []
    for (const name of names) {
      const st = await fs.stat(path.join(dir, name)).catch(() => null)
      if (st?.isFile()) out.push({ name, size: st.size })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/** 把产物路径定位到磁盘，供下载接口使用 */
export async function artifactPath(runId, filename) {
  const checked = safeName(filename)
  if (!checked.ok) return null

  const absolute = path.join(workspaceDir(runId), checked.name)
  const st = await fs.stat(absolute).catch(() => null)
  return st?.isFile() ? absolute : null
}
