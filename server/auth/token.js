/**
 * HS256 JWT 的签发与校验 —— 手写，不装 jsonwebtoken。
 *
 * 为什么手写：JWT 的 HS256 只是"把两段 base64url 用 HMAC-SHA256 签个名"，
 * 全部逻辑不到 40 行，而 jsonwebtoken 拉进来一棵依赖树。手写还有一个好处：
 * 校验时到底检查了哪些字段，一眼能看完，不用去翻库。
 *
 * 只实现 HS256。算法白名单写死在这里，绝不从令牌头里读 alg ——
 * 经典漏洞 "alg: none" 就是把 header 里的算法当成可信输入导致的。
 *
 * 载荷字段刻意精简，只放三个：
 *   uid  用户 id
 *   tv   token_version，与库中值比对，用于停用/改密后即时失效
 *   iat/exp  签发与过期时间（标准字段，由本模块自动填）
 * 不放角色：角色随时可能被管理员改，放进去就得等令牌过期才生效，
 * 不如校验时从库里读一次 —— 反正为了查 status 和 tv 本来就要读。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** base64url 编码：把 base64 的 +/ 换成 -_，并去掉尾部 =（URL 与 Cookie 里更安全） */
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function signature(signingInput, secret) {
  return b64url(createHmac('sha256', secret).update(signingInput).digest())
}

/**
 * 签发令牌。
 * @param {{uid:number, tv:number}} payload
 * @param {{secret:string, ttlSeconds:number}} options
 */
export function signToken(payload, { secret, ttlSeconds }) {
  const now = Math.floor(Date.now() / 1000)

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(
    JSON.stringify({
      uid: payload.uid,
      tv: payload.tv ?? 0,
      iat: now,
      exp: now + ttlSeconds,
    }),
  )

  const signingInput = `${header}.${body}`
  return `${signingInput}.${signature(signingInput, secret)}`
}

/**
 * 校验令牌。通过返回载荷对象，任何一处不对都返回 null。
 *
 * 返回 null 而不是抛异常：调用方只关心"能不能用"，
 * 区分"过期"和"签名不对"对用户没有意义，两种情况都该重新登录。
 * 但拒绝原因会写进服务端日志，排查时看得到。
 */
export function verifyToken(token, { secret }) {
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, received] = parts
  const expected = signature(`${header}.${body}`, secret)

  /*
    恒时比较，避免通过响应时间反推签名。
    长度必须相等才比，timingSafeEqual 长度不等会抛异常。
  */
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const head = JSON.parse(fromB64url(header).toString('utf8'))
    // 算法白名单：即使签名能对上，alg 也必须是我们签的那种
    if (head.alg !== 'HS256' || head.typ !== 'JWT') return null

    const payloadJson = JSON.parse(fromB64url(body).toString('utf8'))
    if (typeof payloadJson.uid !== 'number') return null
    if (typeof payloadJson.exp !== 'number') return null
    if (payloadJson.exp * 1000 <= Date.now()) return null

    return payloadJson
  } catch {
    return null
  }
}
