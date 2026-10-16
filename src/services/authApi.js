/**
 * 登录接口的前端封装（对应 server/routes/auth.js）。
 *
 * 关于 credentials: 'include' —— 这一行不能省。
 *
 * 登录态是一枚 httpOnly Cookie，浏览器默认只对"同源"请求自动携带它。
 * 开发时前端走 Vite 代理（/api 转发到 3001），在浏览器眼里是同源，本来就会带上；
 * 但一旦改用别的方式访问后端（比如直接指向 127.0.0.1:3001），就变成跨域了，
 * 此时不带 credentials 的话表现是"登录接口返回 200，但下一个请求就 401"，
 * 报错信息完全指不到真正的原因。显式写上，两种情况都对。
 *
 * 后端那边也得配合：Access-Control-Allow-Origin 不能是 *，必须回显来源，
 * 见 server/index.js 的 CORS 段。
 */
import { API_BASE } from '@/config'

/** 把后端返回的 { error, code } 变成一个带 code 的 Error，供 UI 区分处理 */
export class AuthError extends Error {
  constructor(message, code, status) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

/** 后端没启动时 fetch 直接抛 TypeError，翻译成能照做的提示 */
function describeNetworkFailure() {
  return '连不上后端服务。请在项目目录运行 npm run dev:all，或用 npm run server 单独启动后端。'
}

async function request(path, { method = 'GET', body } = {}) {
  /*
    只在真的有 body 时才挂 headers/body，不要写成 `body: undefined`。
    GET 请求带一个 body 键（哪怕是 undefined）在部分运行时和静态检查里都算违规，
    oxlint 的 no-invalid-fetch-options 规则就会直接报错。
  */
  const init = { method, credentials: 'include' }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${API_BASE}/auth${path}`, init)
  } catch {
    throw new AuthError(describeNetworkFailure(), 'NETWORK', 0)
  }

  if (res.status === 204) return null

  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* 后端没回 JSON（比如代理返回了 HTML 错误页），下面用状态码兜底 */
  }

  if (!res.ok) {
    throw new AuthError(
      payload?.error || `请求失败（${res.status}）`,
      payload?.code || 'UNKNOWN',
      res.status,
    )
  }

  return payload
}

/** 注册。返回 { user, pending, message }，pending 为真表示还需管理员审核 */
export function register({ username, password, email, displayName }) {
  return request('/register', { method: 'POST', body: { username, password, email, displayName } })
}

/** 登录。identifier 可以是登录名或邮箱 */
export function login({ identifier, password }) {
  return request('/login', { method: 'POST', body: { identifier, password } })
}

export function logout() {
  return request('/logout', { method: 'POST' })
}

/** 取当前登录用户。未登录时抛出 code 为 UNAUTHENTICATED 的错误 */
export function fetchMe() {
  return request('/me')
}

export function changePassword({ currentPassword, newPassword }) {
  return request('/password', { method: 'PATCH', body: { currentPassword, newPassword } })
}

/* ── 管理员接口 ────────────────────────────────────────────────────── */

export function listUsers({ status = '', q = '' } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const qs = params.toString()
  return request(`/users${qs ? `?${qs}` : ''}`)
}

export function getUserDetail(id) {
  return request(`/users/${id}`)
}

export function approveUser(id) {
  return request(`/users/${id}/approve`, { method: 'POST' })
}

export function rejectUser(id) {
  return request(`/users/${id}/reject`, { method: 'POST' })
}

export function updateUser(id, patch) {
  return request(`/users/${id}`, { method: 'PATCH', body: patch })
}

export function resetUserPassword(id, newPassword) {
  return request(`/users/${id}/reset-password`, { method: 'POST', body: { newPassword } })
}

export function listAuthLogs({ limit = 100, eventType = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (eventType) params.set('eventType', eventType)
  return request(`/logs?${params.toString()}`)
}
