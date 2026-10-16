/**
 * 登录态。
 *
 * 与上一版的根本区别：**用户信息不再存 localStorage**。
 *
 * 以前是占位实现，把用户名写进 localStorage 就算登录了。现在令牌在
 * httpOnly Cookie 里，前端根本读不到，所以"我有没有登录"必须问后端。
 * 这里只保存一份内存副本，刷新页面后由 bootstrap() 重新拉一次。
 *
 * 换来的是：页面上的任何脚本（包括被注入的第三方代码）都拿不到登录凭证。
 * localStorage 版本对 XSS 是一击致命的 —— 攻击者读一次就拿到了长期有效的令牌，
 * 而且用户完全无感。
 *
 * status 用四态而不是一个布尔，是因为"还没问过后端"和"确定没登录"必须分开：
 *   还没问过 → 先问，问完再决定跳不跳登录页
 *   已知没登录 → 直接跳
 * 混在一起的结果是：刷新受保护页面时会先闪一下登录页再跳回来，很难看。
 *   unknown     尚未确认
 *   guest       确认未登录
 *   authed      已登录
 *   unavailable 后端连不上（不是"没登录"，是"问不到"）
 */
import { defineStore } from 'pinia'

import {
  AuthError,
  changePassword as changePasswordApi,
  fetchMe,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
} from '@/services/authApi'

/** 去重用的模块级 Promise：路由守卫和组件可能同时触发 bootstrap，只发一次请求 */
let bootstrapPromise = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    /** 已登录时是后端返回的用户对象，否则 null */
    user: null,
    /** 'unknown' | 'guest' | 'authed' | 'unavailable' */
    status: 'unknown',
    /** 正在登录/注册，用来禁用按钮、防重复提交 */
    submitting: false,
    /** 最后一次操作的错误信息，直接展示给用户 */
    error: '',
    /** 非错误的一次性提示，比如"注册成功，请等待审核" */
    notice: '',
  }),

  getters: {
    isLoggedIn: (state) => state.status === 'authed' && Boolean(state.user),
    isAdmin: (state) => state.user?.role === 'admin',
    displayName: (state) => state.user?.displayName || state.user?.username || '未登录',
    /** 头像里显示的首字母 */
    initial: (state) =>
      (state.user?.displayName || state.user?.username || '?').trim().charAt(0).toUpperCase(),
    /** 后端连不上——与"未登录"是两码事，给的提示也不同 */
    isServiceUnavailable: (state) => state.status === 'unavailable',
  },

  actions: {
    /**
     * 向后端确认登录态。幂等：重复调用不会重复发请求。
     * @returns {Promise<boolean>} 是否已登录
     */
    async bootstrap(force = false) {
      if (!force && this.status !== 'unknown') return this.isLoggedIn
      if (!force && bootstrapPromise) return bootstrapPromise

      bootstrapPromise = (async () => {
        try {
          const { user } = await fetchMe()
          this.user = user
          this.status = 'authed'
          return true
        } catch (err) {
          if (err instanceof AuthError && err.code === 'UNAUTHENTICATED') {
            this.user = null
            this.status = 'guest'
          } else {
            /*
              网络失败与"未登录"分开。
              后端没启动时如果直接当成未登录，用户会被弹到登录页、输了密码又登不进去，
              全程看到的都是"密码错误"，根本猜不到真正原因是服务没起。
            */
            this.user = null
            this.status = 'unavailable'
            this.error = err?.message || '无法确认登录状态'
          }
          return false
        } finally {
          bootstrapPromise = null
        }
      })()

      return bootstrapPromise
    },

    async login({ identifier, password }) {
      this.submitting = true
      this.error = ''
      this.notice = ''
      try {
        const { user } = await loginApi({ identifier, password })
        this.user = user
        this.status = 'authed'
        return user
      } catch (err) {
        this.error = err?.message || '登录失败'
        throw err
      } finally {
        this.submitting = false
      }
    },

    /**
     * 注册。
     * @returns {Promise<{pending: boolean, message: string}>}
     *   pending 为真表示账号已创建但需等管理员审核，此时**没有**登录态 ——
     *   后端也确实没下发 Cookie，所以这里不能把 status 改成 authed。
     */
    async register(payload) {
      this.submitting = true
      this.error = ''
      this.notice = ''
      try {
        const result = await registerApi(payload)
        if (result.pending) {
          this.status = 'guest'
          this.notice = result.message || '注册成功，请等待管理员审核。'
        } else {
          this.user = result.user
          this.status = 'authed'
        }
        return result
      } catch (err) {
        this.error = err?.message || '注册失败'
        throw err
      } finally {
        this.submitting = false
      }
    },

    /**
     * 登出。
     * 即使请求失败也要清本地状态 —— 用户点了"退出登录"，
     * 界面上还留着他的名字才是更糟的结果。
     */
    async logout() {
      try {
        await logoutApi()
      } catch {
        /* 服务端清不掉 Cookie 也继续往下走，本地状态先清干净 */
      }
      this.user = null
      this.status = 'guest'
      this.error = ''
      this.notice = ''
    },

    clearMessages() {
      this.error = ''
      this.notice = ''
    },

    /**
     * 修改自己的密码。
     * 后端在改密时会把 token_version +1（其他设备全部掉线），
     * 同时重新下发一次 Cookie 把**当前**这次会话续上，
     * 所以这里拿到响应后要把 user 换成最新的那份。
     */
    async changePassword({ currentPassword, newPassword }) {
      this.submitting = true
      this.error = ''
      this.notice = ''
      try {
        const result = await changePasswordApi({ currentPassword, newPassword })
        this.user = result.user
        this.notice = result.message || '密码已修改'
        return result
      } catch (err) {
        this.error = err?.message || '修改密码失败'
        throw err
      } finally {
        this.submitting = false
      }
    },
  },
})
