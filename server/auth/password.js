/**
 * 密码哈希：node:crypto 的 scrypt。
 *
 * 为什么不装 bcrypt：
 *   后端从 db.js 到 providers 一直是"内置能做的就不用第三方"。scrypt 是
 *   RFC 7914 标准算法，Node 自带，且是内存硬（memory-hard）的 —— 相比
 *   PBKDF2 更能抵抗 GPU 暴力破解。少一个依赖 = 少一份 node_modules 里的
 *   原生编译风险（bcrypt 需要 node-gyp，Windows 上装不上是常见事故）。
 *
 * 存储格式（单字段自描述，换参数不用改表结构）：
 *   scrypt$16384$8$1$<salt base64>$<hash base64>
 *   依次是 算法$N$r$p$盐$摘要
 *   把参数写进哈希串是为了将来提高强度时能平滑升级：老记录按字符串里的
 *   参数校验、新记录用新参数，不需要一次性重算所有人的密码。
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

/** CPU/内存代价，2^14。再高登录会明显变慢，毕设环境没必要 */
const N = 16384
/** 块大小，固定 8 是 scrypt 的常规取值 */
const R = 8
/** 并行度 */
const P = 1
/** 盐长度与摘要长度（字节） */
const SALT_BYTES = 16
const KEY_BYTES = 64

/*
  必须显式给 maxmem。
  scrypt 需要的内存约 128 * N * r ≈ 16MB，而 Node 的默认上限是 32MB，
  本来到得了边、能跑，但加上内部开销后在部分版本上会直接抛
  "memory limit exceeded"。显式给 64MB，省得换机器就崩。
*/
const MAX_MEM = 64 * 1024 * 1024

/** 明文密码 -> 可直接入库的哈希串 */
export async function hashPassword(plain) {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(plain, salt, KEY_BYTES, { N, r: R, p: P, maxmem: MAX_MEM })

  return ['scrypt', N, R, P, salt.toString('base64'), derived.toString('base64')].join('$')
}

/**
 * 校验明文密码。返回布尔值，任何异常一律当作"不匹配"。
 *
 * 用 timingSafeEqual 而不是 === ：普通字符串比较在第一个不同字节就返回，
 * 攻击者能通过测量响应时间逐字节猜出哈希。timingSafeEqual 恒时比较。
 * 长度不等时它会抛异常，所以先比长度。
 */
export async function verifyPassword(plain, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored).split('$')
    if (scheme !== 'scrypt') return false

    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')

    const actual = await scryptAsync(plain, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEM,
    })

    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/**
 * 密码强度规则，注册/改密共用一处，避免前后端各写一套导致口径不一致。
 * 返回 null 表示通过，否则返回可直接展示给用户的原因。
 */
export function checkPasswordStrength(plain) {
  const value = String(plain ?? '')
  if (value.length < 8) return '密码至少 8 位'
  if (value.length > 72) return '密码最长 72 位'
  if (!/[a-zA-Z]/.test(value)) return '密码需包含至少一个字母'
  if (!/\d/.test(value)) return '密码需包含至少一个数字'
  return null
}

/** 登录名的形状约束，注册与后台建号共用 */
export function checkUsername(raw) {
  const value = String(raw ?? '').trim()
  if (value.length < 3) return '登录名至少 3 个字符'
  if (value.length > 32) return '登录名最长 32 个字符'
  if (!/^[A-Za-z0-9_]+$/.test(value)) return '登录名只能包含字母、数字和下划线'
  return null
}
