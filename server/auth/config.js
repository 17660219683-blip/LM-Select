/**
 * 鉴权相关的配置集中在这里，只此一处读环境变量。
 *
 * 密钥的处理是这个文件最需要解释的地方：
 *
 *   AUTH_SECRET 如果没配，就现场随机生成一个，并且**大声警告**。
 *   为什么不是"随便给个默认值" —— 默认值等于把签名密钥写进了源码，
 *   任何人都能伪造出合法令牌，比没有鉴权更糟（因为它看起来是安全的）。
 *   随机生成则保证了"至少不是公开的秘密"，代价是进程重启后旧令牌全部失效，
 *   这对本地开发完全可以接受（重新登录一次而已）。
 *
 *   所以生产部署时必须显式配置 AUTH_SECRET，这一点在启动日志里会提醒。
 */
import { randomBytes } from 'node:crypto'

import '../env.js'

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'lm_token'

/** 令牌有效期，默认 7 天 */
export const AUTH_TTL_SECONDS = (Number(process.env.AUTH_TOKEN_TTL_DAYS) || 7) * 24 * 60 * 60

/** 连续失败多少次触发锁定，锁多久（分钟） */
export const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED) || 5
export const LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES) || 15

/** 是否开启 Secure（只走 HTTPS）。本地是 http://127.0.0.1，必须为 false，否则浏览器根本不存 Cookie */
export const COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE === 'true'

export const AUTH_SECRET = (() => {
  const fromEnv = process.env.AUTH_SECRET
  if (fromEnv && fromEnv.length >= 16) return fromEnv

  const generated = randomBytes(48).toString('hex')
  console.warn('[auth] 未配置 AUTH_SECRET（或长度不足 16），已临时随机生成。')
  console.warn('[auth]   影响：服务重启后所有登录态失效，需要重新登录。')
  console.warn('[auth]   解决：在 server/.env 里加一行 AUTH_SECRET=<至少32位随机串>。')
  return generated
})()
