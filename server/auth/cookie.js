/**
 * Cookie 的解析与序列化 —— 手写，不装 cookie-parser。
 *
 * 只用得到两种能力：从请求头里取出某个 Cookie 的值、拼一个 Set-Cookie 串。
 * 为此引一个依赖不划算，而且自己写能顺手把几个属性设对。
 *
 * ⚠️ httpOnly 是这个登录系统安全性的关键，不能改：
 *    令牌前后端都不落 localStorage，页面上任何 JS（包括被注入的第三方脚本）
 *    都读不到它，XSS 成功也偷不走登录态。这是选 Cookie 而不是 localStorage
 *    的唯一理由，去掉 httpOnly 就等于白选。
 *
 *    配套要求是 sameSite='lax'：跨站请求不带 Cookie，挡住 CSRF。
 *    'lax' 而不是 'strict' —— strict 下从外部链接点进来会丢登录态，体验很差；
 *    lax 只放行顶层导航的 GET，写操作（POST/PATCH/DELETE）依然被挡，
 *    而我们的写接口没有一个是靠顶层导航触发的，所以够用。
 */
import { AUTH_COOKIE_NAME, AUTH_TTL_SECONDS, COOKIE_SECURE } from './config.js'

/** 从 req.headers.cookie 里取出指定名字的值，没有则返回 null */
export function readCookie(req, name) {
  const raw = req.headers?.cookie
  if (!raw) return null

  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() !== name) continue
    // 值里可能有 %xx 转义，解码失败就按原样返回，不让一个坏 Cookie 打挂整个请求
    try {
      return decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      return part.slice(idx + 1).trim()
    }
  }
  return null
}

/** 拼一段 Set-Cookie。maxAge 用秒，与令牌有效期保持一致 */
function serialize(name, value, { maxAge }) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (COOKIE_SECURE) attrs.push('Secure')
  return attrs.join('; ')
}

/** 下发登录令牌 */
export function setAuthCookie(res, token, ttlSeconds = AUTH_TTL_SECONDS) {
  /*
    用 appendHeader 而不是 setHeader：Express 5 若已存在同名响应头，
    setHeader 会覆盖。append 保证多个 Set-Cookie 能同时存在。
  */
  res.appendHeader('Set-Cookie', serialize(AUTH_COOKIE_NAME, token, { maxAge: ttlSeconds }))
}

/**
 * 清除登录令牌。
 * Max-Age=0 即可让浏览器立刻丢弃；值给空串更保险 ——
 * 某些老浏览器对 Max-Age 的处理不一致，空值 + 立即过期双管齐下。
 * 其余属性必须与下发时完全一致（Path / SameSite），否则删不掉。
 */
export function clearAuthCookie(res) {
  res.appendHeader('Set-Cookie', serialize(AUTH_COOKIE_NAME, '', { maxAge: 0 }))
}
