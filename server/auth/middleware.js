/**
 * 鉴权中间件。
 *
 * requireAuth 做四件事，顺序不能换：
 *   1. 从 Cookie 取令牌、验签 → 拿到 uid
 *   2. 按 uid 查库 → 账号还在不在
 *   3. 查 status → 是不是 active（用户可能刚被管理员停用）
 *   4. 比对 token_version → 令牌是不是改密前签发的
 *
 * 2~4 步是"无状态 JWT"的必要补丁。纯 JWT 校验只证明"这张令牌是我签的"，
 * 不证明"这个人现在还被允许访问"。管理员停用一个账号后，对方手里的令牌
 * 在过期前依然有效 —— 这是很多教程式 JWT 实现的真实漏洞。
 * 代价是每次请求多一次主键查询，走的是聚簇索引，实际开销可以忽略。
 *
 * 未通过一律回 401，且不区分原因（令牌过期 / 被停用 / 已改密）。
 * 区分原因反而是在帮攻击者确认账号是否存在、是否被停用。
 * 前端拿到 401 就清本地状态并跳登录页，是唯一正确的反应。
 */
import { pool } from '../db.js'

import { readCookie } from './cookie.js'
import { AUTH_COOKIE_NAME, AUTH_SECRET } from './config.js'
import { verifyToken } from './token.js'

/** 查库时只取需要的列，密码哈希绝不出现在这里 */
const USER_COLUMNS = `
  id, username, email, display_name, role, status, token_version,
  approved_at, last_login_at, created_at
`

/** 对外输出的用户对象。白名单式构造 —— 加字段要显式写，避免哪天不小心把 password_hash 带出去 */
export function toPublicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at ?? null,
  }
}

/** 按 id 取用户；带 status 与 token_version，供鉴权链路使用 */
export async function findUserById(id) {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM app_user WHERE id = ? LIMIT 1`, [id])
  return rows[0] ?? null
}

/**
 * 把请求里的登录态解析出来挂到 req.user。
 * 解析不出来就挂 null —— 不直接拒绝。这样同一条路由按需选择
 * 强制登录（requireAuth）还是"登录了就带上身份"（可选登录）。
 */
export async function attachUser(req, _res, next) {
  req.user = null

  try {
    const token = readCookie(req, AUTH_COOKIE_NAME)
    if (!token) return next()

    const payload = verifyToken(token, { secret: AUTH_SECRET })
    if (!payload) return next()

    const user = await findUserById(payload.uid)
    if (!user) return next()
    if (user.status !== 'active') return next()
    if (Number(user.token_version) !== Number(payload.tv ?? 0)) return next()

    req.user = user
  } catch (err) {
    /*
      数据库连不上时不要在这里抛 500。
      鉴权是"附加信息"，让它失败降级成"未登录"，由 requireAuth 去回 401，
      用户看到的是"请重新登录"而不是"服务器错误"，不会误以为是系统坏了。
    */
    console.warn('[auth] 解析登录态失败：', err.message)
  }

  next()
}

/** 强制登录 */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录或登录已失效', code: 'UNAUTHENTICATED' })
  next()
}

/** 强制管理员。必须先经过 requireAuth（它负责填充 req.user） */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录或登录已失效', code: 'UNAUTHENTICATED' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限', code: 'FORBIDDEN' })
  next()
}
