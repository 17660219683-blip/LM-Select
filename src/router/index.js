import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import ChatView from '@/views/ChatView.vue'

/**
 * 多页面项目：每个页面一个 view（src/views/），页面私有组件放 src/components/<页面名>/。
 * 对话页是主页面，直接打包进主 chunk；其余按需加载，免得把首包撑大。
 *
 * ── 关于访问控制 ──────────────────────────────────────────────────────
 * meta.requiresAuth 是**默认要求**，所有业务页面都标了。
 * 模型库、Agent、推荐这三个页面本身只读公开数据，也可以放开；
 * 放开的方式就是把对应路由的 requiresAuth 去掉，不用改别的地方。
 * 这里选择全部要求登录，是因为系统的主要功能（对话、对比、日志）
 * 都会产生归属于用户本人的数据，进门先登录比一半页面要登录更一致。
 *
 * 前端守卫只负责"体验"——把没登录的人早点送到登录页，省一次白跑的请求。
 * 真正的权限校验在服务端（server/auth/middleware.js）：
 * 改这里的 meta 骗不过后端，这一点必须清楚。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/AuthView.vue'),
      meta: { guestOnly: true, title: '登录' },
    },
    { path: '/', name: 'chat', component: ChatView, meta: { requiresAuth: true, title: '对话' } },
    {
      path: '/models',
      name: 'models',
      component: () => import('@/views/ModelLibraryView.vue'),
      meta: { requiresAuth: true, title: '模型库' },
    },
    {
      path: '/compare',
      name: 'compare',
      component: () => import('@/views/CompareView.vue'),
      meta: { requiresAuth: true, title: '对比测试' },
    },
    {
      path: '/agent',
      name: 'agent',
      component: () => import('@/views/AgentView.vue'),
      meta: { requiresAuth: true, title: 'Agent' },
    },
    {
      path: '/agent/spec',
      name: 'agent-spec',
      component: () => import('@/views/AgentSpecView.vue'),
      meta: { requiresAuth: true, title: 'Agent 规格' },
    },
    {
      path: '/recommend',
      name: 'recommend',
      component: () => import('@/views/RecommendView.vue'),
      meta: { requiresAuth: true, title: '推荐' },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
      meta: { requiresAuth: true, title: '日志管理' },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('@/views/AdminUsersView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '账号审核' },
    },
    /* 兜底：不存在的地址回首页，避免出现整页空白 */
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * 登录守卫。
 *
 * 三次判断的顺序不能调换：
 *   ① 先 bootstrap 确认登录态。status 为 unknown 时（首次进入、刷新页面）
 *      必须先问后端 —— 令牌在 httpOnly Cookie 里，前端自己看不出登没登录。
 *      漏掉这一步会表现成"刚登录完刷新一下就被踢回登录页"。
 *   ② 再判 requiresAuth。
 *   ③ 最后判 guestOnly：已登录的人访问 /login 直接送回首页，
 *      否则他会在登录页上看到自己的名字，很怪。
 *
 * 返回值用路由对象而不是调用 next()，是 vue-router 4 对 async 守卫的推荐写法，
 * 不会出现"忘了调 next 导致导航一直挂起"这种问题。
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.status === 'unknown') {
    await auth.bootstrap()
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    /*
      带 redirect 是为了登录后能回到原来想去的页面。
      访问首页时不带 —— 登录完回首页本来就是默认行为，
      在地址栏挂一个 ?redirect=/ 只会显得多余。
    */
    return {
      name: 'login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    /* 非管理员访问后台入口：直接送回首页。
       回一个 403 页面等于告诉对方"这里有个你不该来的地方"，
       而这个入口在界面上本来就不对非管理员展示。 */
    return { name: 'chat' }
  }

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: 'chat' }
  }

  return true
})

/** 标题跟着路由走，浏览器历史记录里能分清哪一条是哪个页面 */
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · LM Select` : 'LM Select'
})

export default router
