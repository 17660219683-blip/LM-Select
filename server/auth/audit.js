/**
 * 登录审计日志写入。
 *
 * 单独抽一个模块，是因为它被三处调用（登录、登出、管理员操作），
 * 而且必须遵守一条铁律：**审计日志写失败不能影响主流程**。
 *
 * 所以这里永远不抛异常，只在控制台留一行警告。
 * 反过来想：如果因为日志表写不进去就让用户登录失败，那才是本末倒置 ——
 * 审计是为了安全，让正常用户登不进来不是安全。
 *
 * ip 的取值有个容易踩的坑：req.ip 在 Express 5 下拿的是 socket 地址；
 * 如果以后放到 Nginx 后面，必须显式 app.set('trust proxy', ...) 才会是真实 IP，
 * 否则记下来的全是 127.0.0.1，日志就没有排查价值了。
 */
import { pool } from '../db.js'

/**
 * @param {object} req  Express 请求，用于取 ip / user-agent
 * @param {object} entry
 * @param {number|null} entry.userId
 * @param {string} entry.username  当时提交的登录名，账号不存在时也要有值
 * @param {string} entry.eventType 对应 login_log.event_type 枚举
 * @param {boolean} entry.success
 * @param {string} [entry.reason]
 */
export async function logAuthEvent(req, { userId = null, username, eventType, success, reason = null }) {
  try {
    await pool.query(
      `INSERT INTO login_log (user_id, username, event_type, success, reason, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(username ?? '').slice(0, 64),
        eventType,
        success ? 1 : 0,
        reason ? String(reason).slice(0, 160) : null,
        (req.ip ?? '').replace(/^::ffff:/, '').slice(0, 45) || null,
        String(req.headers?.['user-agent'] ?? '').slice(0, 255) || null,
      ],
    )
  } catch (err) {
    console.warn('[auth] 写审计日志失败（不影响本次操作）：', err.message)
  }
}
