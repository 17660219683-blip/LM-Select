/**
 * 账号与鉴权 API（对应 migration_09_auth.sql 的 app_user / login_log）。
 *
 * 接口一览
 *   公开    POST   /api/auth/register            注册（审核通过前不能登录）
 *           POST   /api/auth/login               登录，成功下发 httpOnly Cookie
 *           POST   /api/auth/logout              登出，清 Cookie
 *   需登录  GET    /api/auth/me                  取当前登录用户
 *           PATCH  /api/auth/password            修改自己的密码
 *   需管理员 GET   /api/auth/users               账号列表（可按状态筛）
 *           POST   /api/auth/users/:id/approve   审核通过
 *           POST   /api/auth/users/:id/reject    驳回（删除待审核账号，留痕）
 *           PATCH  /api/auth/users/:id           改角色 / 启用停用
 *           POST   /api/auth/users/:id/reset-password  重置密码
 *           GET    /api/auth/logs                审计日志
 *
 * 三条贯穿全文件的原则：
 *
 * ① 登录失败一律回同一句话「登录名或密码不正确」。
 *    区分"用户不存在"和"密码错误"，等于给攻击者一个免费的账号枚举接口：
 *    他能先确认哪些用户名有效，再集中爆破这些账号。
 *
 * ② 状态检查放在密码校验**之后**。
 *    "你这个账号正在等审核"是一句信息量很大的话，只能告诉通过密码验证的人。
 *    顺序反过来，任何人随便填个密码都能探出某个账号是 pending 还是 disabled。
 *
 * ③ 让权限变更立刻生效。
 *    停用、改角色、重置密码都会 token_version +1，使此前签发的令牌当场作废。
 *    否则管理员把某人降级后，对方凭旧令牌还能当半小时管理员。
 */
import { Router } from 'express'

import { pool } from '../db.js'
import { logAuthEvent } from '../auth/audit.js'
import { clearAuthCookie, setAuthCookie } from '../auth/cookie.js'
import { AUTH_SECRET, AUTH_TTL_SECONDS, LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from '../auth/config.js'
import { findUserById, requireAdmin, requireAuth, toPublicUser } from '../auth/middleware.js'
import { checkPasswordStrength, checkUsername, hashPassword, verifyPassword } from '../auth/password.js'
import { signToken } from '../auth/token.js'

const router = Router()

/** 登录名或邮箱都允许登录，统一叫 identifier */
const USER_COLUMNS_BY_ID = `
  id, username, email, display_name, role, status, token_version,
  approved_at, last_login_at, created_at
`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function badRequest(res, message) {
  return res.status(400).json({ error: message })
}

/** 给账号签发 Cookie。注册引导成功、登录成功、改密后各用一次 */
function issueSession(res, user) {
  const token = signToken(
    { uid: user.id, tv: user.token_version },
    { secret: AUTH_SECRET, ttlSeconds: AUTH_TTL_SECONDS },
  )
  setAuthCookie(res, token, AUTH_TTL_SECONDS)
}

/* ------------------------------------------------------------------ */
/* 注册                                                                */
/* ------------------------------------------------------------------ */

/**
 * 引导规则：库里一个管理员都没有时，第一个注册的人直接成为管理员并激活。
 *
 * 这不是"谁先注册谁是老大"的偷懒，而是初始化的唯一现实做法 ——
 * 没有管理员就没有人能审核，系统会永久卡死。种子脚本也会建一个 admin，
 * 这条规则是它没跑成功时的兜底。
 *
 * 并发问题值得说一下：两个人同时注册、同时查到"管理员数 = 0"，
 * 就会双双变成管理员。加 GET_LOCK 串行化这一段。
 * ⚠️ GET_LOCK 是**连接级**的，必须从池里借同一条连接来加锁和解锁，
 *    用 pool.query 两次很可能落到不同连接上，锁就形同虚设。
 */
const BOOTSTRAP_LOCK = 'lm_select:bootstrap_admin'

async function registerFirstAdminIfNeeded() {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT GET_LOCK(?, 5) AS got', [BOOTSTRAP_LOCK])

    const [[{ admins }]] = await conn.query(
      "SELECT COUNT(*) AS admins FROM app_user WHERE role = 'admin'",
    )
    return Number(admins) === 0
  } finally {
    await conn.query('SELECT RELEASE_LOCK(?)', [BOOTSTRAP_LOCK]).catch(() => {})
    conn.release()
  }
}

router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')
    const emailRaw = String(req.body?.email ?? '').trim()
    const email = emailRaw || null
    const displayName = String(req.body?.displayName ?? '').trim() || username

    const usernameErr = checkUsername(username)
    if (usernameErr) return badRequest(res, usernameErr)

    const passwordErr = checkPasswordStrength(password)
    if (passwordErr) return badRequest(res, passwordErr)

    if (email && !EMAIL_RE.test(email)) return badRequest(res, '邮箱格式不正确')
    if (email && email.length > 160) return badRequest(res, '邮箱过长')

    /* 唯一性先查一次，是为了给出"登录名已被占用"这种能直接照做的提示。
       真正兜底的是表上的唯一索引 —— 并发下仍可能撞上，由 catch ER_DUP_ENTRY 处理。 */
    const [dup] = await pool.query(
      'SELECT username, email FROM app_user WHERE username = ? OR (email IS NOT NULL AND email = ?) LIMIT 1',
      [username, email],
    )
    if (dup.length) {
      if (dup[0].username === username) return res.status(409).json({ error: '该登录名已被占用' })
      return res.status(409).json({ error: '该邮箱已被注册' })
    }

    const isFirstAdmin = await registerFirstAdminIfNeeded()
    const passwordHash = await hashPassword(password)

    const [result] = await pool.query(
      `INSERT INTO app_user (username, email, display_name, password_hash, role, status, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        displayName.slice(0, 64),
        passwordHash,
        isFirstAdmin ? 'admin' : 'user',
        isFirstAdmin ? 'active' : 'pending',
        isFirstAdmin ? new Date() : null,
      ],
    )

    const user = await findUserById(result.insertId)

    await logAuthEvent(req, {
      userId: user.id,
      username,
      eventType: 'register',
      success: true,
      reason: isFirstAdmin ? '系统首个账号，自动成为管理员并激活' : '等待管理员审核',
    })

    if (isFirstAdmin) {
      issueSession(res, user)
      return res.status(201).json({
        user: toPublicUser(user),
        pending: false,
        message: '已创建系统首个账号，自动成为管理员。',
      })
    }

    /* 待审核时**不下发** Cookie：能登录才能拿到令牌，这是审核机制的意义所在 */
    return res.status(201).json({
      user: toPublicUser(user),
      pending: true,
      message: '注册成功，请等待管理员审核通过后再登录。',
    })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '该登录名或邮箱已被占用' })
    }
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 登录                                                                */
/* ------------------------------------------------------------------ */

router.post('/login', async (req, res, next) => {
  try {
    const identifier = String(req.body?.identifier ?? req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')

    if (!identifier || !password) return badRequest(res, '请填写登录名和密码')

    const [rows] = await pool.query(
      `SELECT ${USER_COLUMNS_BY_ID}, password_hash, failed_attempts, locked_until
         FROM app_user
        WHERE username = ? OR (email IS NOT NULL AND email = ?)
        LIMIT 1`,
      [identifier, identifier],
    )
    const user = rows[0]

    if (!user) {
      await logAuthEvent(req, {
        userId: null,
        username: identifier,
        eventType: 'login_failed',
        success: false,
        reason: '账号不存在',
      })
      return res.status(401).json({ error: '登录名或密码不正确', code: 'BAD_CREDENTIALS' })
    }

    /* 锁定检查放在验密码之前：被锁的账号连试都不让试，否则锁定就没有威慑力 */
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      await logAuthEvent(req, {
        userId: user.id,
        username: identifier,
        eventType: 'locked',
        success: false,
        reason: `账号锁定中，剩余 ${minutes} 分钟`,
      })
      return res.status(423).json({
        error: `连续输错密码次数过多，账号已锁定，请 ${minutes} 分钟后再试`,
        code: 'LOCKED',
      })
    }

    const ok = await verifyPassword(password, user.password_hash)

    if (!ok) {
      const attempts = Number(user.failed_attempts) + 1
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS

      await pool.query(
        'UPDATE app_user SET failed_attempts = ?, locked_until = ? WHERE id = ?',
        [
          shouldLock ? 0 : attempts,
          shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          user.id,
        ],
      )

      await logAuthEvent(req, {
        userId: user.id,
        username: identifier,
        eventType: 'login_failed',
        success: false,
        reason: shouldLock
          ? `连续失败 ${MAX_FAILED_ATTEMPTS} 次，已锁定 ${LOCK_MINUTES} 分钟`
          : `密码错误（第 ${attempts} 次）`,
      })

      if (shouldLock) {
        return res.status(423).json({
          error: `连续输错密码 ${MAX_FAILED_ATTEMPTS} 次，账号已锁定 ${LOCK_MINUTES} 分钟`,
          code: 'LOCKED',
        })
      }
      return res.status(401).json({ error: '登录名或密码不正确', code: 'BAD_CREDENTIALS' })
    }

    /* 密码正确之后才谈状态 —— 见文件头原则② */
    if (user.status === 'pending') {
      await logAuthEvent(req, {
        userId: user.id,
        username: identifier,
        eventType: 'login',
        success: false,
        reason: '账号尚未通过审核',
      })
      return res.status(403).json({
        error: '账号正在等待管理员审核，通过后即可登录',
        code: 'PENDING_APPROVAL',
      })
    }

    if (user.status === 'disabled') {
      await logAuthEvent(req, {
        userId: user.id,
        username: identifier,
        eventType: 'login',
        success: false,
        reason: '账号已被停用',
      })
      return res.status(403).json({ error: '账号已被停用，请联系管理员', code: 'DISABLED' })
    }

    await pool.query(
      'UPDATE app_user SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [(req.ip ?? '').replace(/^::ffff:/, '').slice(0, 45) || null, user.id],
    )

    const fresh = await findUserById(user.id)
    issueSession(res, fresh)

    await logAuthEvent(req, {
      userId: user.id,
      username: identifier,
      eventType: 'login',
      success: true,
      reason: null,
    })

    res.json({ user: toPublicUser(fresh) })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 登出 / 当前用户                                                      */
/* ------------------------------------------------------------------ */

/**
 * 登出：清 Cookie 即可。
 * 用 attachUser 而不是 requireAuth —— 令牌已经过期时用户点登出，
 * 不该给他一个 401（他本来就是想退出）。清干净并回 200 最合理。
 */
router.post('/logout', async (req, res) => {
  clearAuthCookie(res)
  if (req.user) {
    await logAuthEvent(req, {
      userId: req.user.id,
      username: req.user.username,
      eventType: 'logout',
      success: true,
    })
  }
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) })
})

/* ------------------------------------------------------------------ */
/* 修改自己的密码                                                       */
/* ------------------------------------------------------------------ */

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword ?? '')
    const newPassword = String(req.body?.newPassword ?? '')

    const err = checkPasswordStrength(newPassword)
    if (err) return badRequest(res, err)
    if (currentPassword === newPassword) return badRequest(res, '新密码不能与当前密码相同')

    const [rows] = await pool.query('SELECT password_hash FROM app_user WHERE id = ? LIMIT 1', [
      req.user.id,
    ])
    const ok = await verifyPassword(currentPassword, rows[0]?.password_hash)
    if (!ok) return res.status(401).json({ error: '当前密码不正确', code: 'BAD_CREDENTIALS' })

    const passwordHash = await hashPassword(newPassword)

    /*
      token_version +1 会让**所有**已签发的令牌失效，包括当前这台设备。
      所以紧接着重新下发一次 Cookie，把当前会话续上 ——
      否则用户改完密码立刻被自己踢出去，体验很怪。
      其他设备则确实被登出了，这正是改密应该达到的效果。
    */
    await pool.query(
      'UPDATE app_user SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, req.user.id],
    )

    const fresh = await findUserById(req.user.id)
    issueSession(res, fresh)

    await logAuthEvent(req, {
      userId: req.user.id,
      username: req.user.username,
      eventType: 'password_change',
      success: true,
    })

    res.json({ user: toPublicUser(fresh), message: '密码已修改，其他设备上的登录已失效。' })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 管理员：账号管理                                                     */
/* ------------------------------------------------------------------ */

/** 列表。带 status 过滤与关键字搜索，前端「待审核」页签直接复用 */
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = ['pending', 'active', 'disabled'].includes(req.query.status)
      ? req.query.status
      : null
    const keyword = String(req.query.q ?? '').trim()

    const where = []
    const params = []
    if (status) {
      where.push('status = ?')
      params.push(status)
    }
    if (keyword) {
      where.push('(username LIKE ? OR display_name LIKE ? OR email LIKE ?)')
      const like = `%${keyword}%`
      params.push(like, like, like)
    }

    const [rows] = await pool.query(
      `SELECT ${USER_COLUMNS_BY_ID} FROM app_user
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY FIELD(status, 'pending', 'active', 'disabled'), created_at DESC
       LIMIT 200`,
      params,
    )

    /* 三个计数单独查一次：前端要显示「待审核 3」这样的角标，
       让它自己数当前这一页会漏掉被 200 条上限截掉的部分 */
    const [[counts]] = await pool.query(
      `SELECT
         SUM(status = 'pending')  AS pending,
         SUM(status = 'active')   AS active,
         SUM(status = 'disabled') AS disabled,
         COUNT(*)                 AS total
       FROM app_user`,
    )

    res.json({
      users: rows.map(toPublicUser),
      counts: {
        pending: Number(counts.pending ?? 0),
        active: Number(counts.active ?? 0),
        disabled: Number(counts.disabled ?? 0),
        total: Number(counts.total ?? 0),
      },
    })
  } catch (err) {
    next(err)
  }
})

/** 取某个账号的完整信息，含它在 login_log 里的最近记录 —— 审核时要有依据可看 */
router.get('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const user = await findUserById(Number(req.params.id))
    if (!user) return res.status(404).json({ error: '账号不存在' })

    const [logs] = await pool.query(
      `SELECT id, event_type, success, reason, ip, created_at
         FROM login_log WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
      [user.id],
    )

    res.json({ user: toPublicUser(user), logs })
  } catch (err) {
    next(err)
  }
})

router.post('/users/:id/approve', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const target = await findUserById(Number(req.params.id))
    if (!target) return res.status(404).json({ error: '账号不存在' })
    if (target.status === 'active') return badRequest(res, '该账号已经处于启用状态')

    await pool.query(
      "UPDATE app_user SET status = 'active', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [req.user.id, target.id],
    )

    await logAuthEvent(req, {
      userId: target.id,
      username: target.username,
      eventType: 'admin_approve',
      success: true,
      reason: `由 ${req.user.username} 审核通过`,
    })

    res.json({ user: toPublicUser(await findUserById(target.id)) })
  } catch (err) {
    next(err)
  }
})

/**
 * 驳回 = 删除待审核账号。
 * 不改成 disabled 是因为两者语义不同：驳回意味着"这个人不该有账号"，
 * 留在表里会永远占着一个登录名，而且"被驳回"和"被停用"混在一起，
 * 以后看列表根本分不清谁是谁。删除后 login_log 因外键 ON DELETE SET NULL
 * 依然保留记录，追责线索没丢。
 */
router.post('/users/:id/reject', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const target = await findUserById(Number(req.params.id))
    if (!target) return res.status(404).json({ error: '账号不存在' })
    if (target.status !== 'pending') return badRequest(res, '只能驳回待审核的账号')

    await pool.query('DELETE FROM app_user WHERE id = ?', [target.id])

    await logAuthEvent(req, {
      userId: null,
      username: target.username,
      eventType: 'admin_reject',
      success: true,
      reason: `由 ${req.user.username} 驳回，账号已删除`,
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** 改角色 / 启用停用。两种改动都会让对方的旧令牌立刻失效 */
router.patch('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const target = await findUserById(id)
    if (!target) return res.status(404).json({ error: '账号不存在' })

    const nextRole = ['user', 'admin'].includes(req.body?.role) ? req.body.role : null
    const nextStatus = ['active', 'disabled'].includes(req.body?.status) ? req.body.status : null
    if (!nextRole && !nextStatus) return badRequest(res, '没有可更新的字段')

    /*
      两个自锁保护。少了它们，管理员手一抖就能把系统弄成没人能管：
        · 不能停用或降级自己 —— 点完自己就进不去了
        · 不能动最后一个管理员 —— 全站唯一的管事人没了，审核功能彻底停摆
    */
    if (target.id === req.user.id && (nextStatus === 'disabled' || nextRole === 'user')) {
      return badRequest(res, '不能停用或降级自己的账号')
    }

    if (target.role === 'admin' && (nextRole === 'user' || nextStatus === 'disabled')) {
      const [[{ others }]] = await pool.query(
        "SELECT COUNT(*) AS others FROM app_user WHERE role = 'admin' AND status = 'active' AND id <> ?",
        [target.id],
      )
      if (Number(others) === 0) return badRequest(res, '这是最后一个可用的管理员，不能停用或降级')
    }

    const sets = []
    const params = []
    if (nextRole) {
      sets.push('role = ?')
      params.push(nextRole)
    }
    if (nextStatus) {
      sets.push('status = ?')
      params.push(nextStatus)
    }
    /* token_version +1：权限变更必须在下一个请求就生效，不能等令牌自然过期 */
    sets.push('token_version = token_version + 1')
    params.push(target.id)

    await pool.query(`UPDATE app_user SET ${sets.join(', ')} WHERE id = ?`, params)

    if (nextRole && nextRole !== target.role) {
      await logAuthEvent(req, {
        userId: target.id,
        username: target.username,
        eventType: 'admin_role_change',
        success: true,
        reason: `${target.role} → ${nextRole}（操作人 ${req.user.username}）`,
      })
    }
    if (nextStatus && nextStatus !== target.status) {
      await logAuthEvent(req, {
        userId: target.id,
        username: target.username,
        eventType: nextStatus === 'disabled' ? 'admin_disable' : 'admin_enable',
        success: true,
        reason: `操作人 ${req.user.username}`,
      })
    }

    res.json({ user: toPublicUser(await findUserById(id)) })
  } catch (err) {
    next(err)
  }
})

/** 重置密码：用户忘了密码又没有邮件通道，这是唯一的补救手段 */
router.post('/users/:id/reset-password', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const target = await findUserById(id)
    if (!target) return res.status(404).json({ error: '账号不存在' })

    const newPassword = String(req.body?.newPassword ?? '')
    const err = checkPasswordStrength(newPassword)
    if (err) return badRequest(res, err)

    const passwordHash = await hashPassword(newPassword)
    await pool.query(
      'UPDATE app_user SET password_hash = ?, failed_attempts = 0, locked_until = NULL, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, id],
    )

    await logAuthEvent(req, {
      userId: id,
      username: target.username,
      eventType: 'admin_reset_password',
      success: true,
      reason: `操作人 ${req.user.username}`,
    })

    /* 不回传新密码本身，也不代它登录 —— 管理员知道密码是不可避免的，
       但至少不要让它出现在响应体里被浏览器缓存或日志记录 */
    res.json({ ok: true, message: `已重置 ${target.username} 的密码，该账号在所有设备上的登录已失效。` })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 管理员：审计日志                                                     */
/* ------------------------------------------------------------------ */

router.get('/logs', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const eventType = String(req.query.eventType ?? '').trim()

    const [rows] = await pool.query(
      `SELECT l.id, l.user_id, l.username, l.event_type, l.success, l.reason,
              l.ip, l.user_agent, l.created_at, u.display_name
         FROM login_log l
         LEFT JOIN app_user u ON u.id = l.user_id
        ${eventType ? 'WHERE l.event_type = ?' : ''}
        ORDER BY l.id DESC
        LIMIT ?`,
      eventType ? [eventType, limit] : [limit],
    )

    res.json({ logs: rows })
  } catch (err) {
    next(err)
  }
})

export default router
