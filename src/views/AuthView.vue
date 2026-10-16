<script setup>
/**
 * 登录 / 注册页（/login）。
 *
 * 为什么是整页而不是弹窗：
 *   注册表单字段多（登录名、显示名、邮箱、密码、确认密码），塞进小弹窗会挤成一团；
 *   而且"注册后等待审核"需要一个能停下来看清楚的结果态，弹窗里一闪而过容易被忽略。
 *
 * 为什么带 redirect 参数：
 *   用户直接访问 /compare 之类受保护页面时会被守卫踢到这里。
 *   登录成功后要把他送回原来想去的地方，而不是一律丢回首页 ——
 *   这个细节决定了"登录"在用户感觉里是流程的一环还是打断。
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/** 'login' | 'register' */
const tab = ref('login')
/** 注册成功待审核时的结果态：此时不跳转，展示等待说明 */
const registered = ref(null)

const loginForm = reactive({ identifier: '', password: '' })
const registerForm = reactive({
  username: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
})

/** 字段级错误，键名与表单字段一一对应 */
const fieldErrors = reactive({})

/** 登录成功后回到用户原本想去的页面 */
const redirect = computed(() =>
  typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
    ? route.query.redirect
    : '/',
)

/** 切 tab 时清掉上一次的报错，否则"登录失败"会一直挂在注册表单上方 */
watch(tab, () => {
  auth.clearMessages()
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
})

function clearFieldErrors() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
}

/*
  前端校验规则必须与后端 server/auth/password.js 保持一致。
  前端校验只是为了让用户少跑一趟网络，**不能替代后端校验** ——
  绕过前端发请求是最基本的攻击手法，真正的把关永远在服务端。
*/
function validateRegister() {
  clearFieldErrors()
  const f = registerForm

  if (!/^[A-Za-z0-9_]{3,32}$/.test(f.username.trim())) {
    fieldErrors.username = '登录名需 3-32 位，只能包含字母、数字和下划线'
  }
  if (f.displayName.trim().length > 32) {
    fieldErrors.displayName = '显示名最长 32 个字符'
  }
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
    fieldErrors.email = '邮箱格式不正确'
  }
  if (f.password.length < 8) {
    fieldErrors.password = '密码至少 8 位'
  } else if (!/[a-zA-Z]/.test(f.password)) {
    fieldErrors.password = '密码需包含至少一个字母'
  } else if (!/\d/.test(f.password)) {
    fieldErrors.password = '密码需包含至少一个数字'
  }
  if (f.confirmPassword !== f.password) {
    fieldErrors.confirmPassword = '两次输入的密码不一致'
  }

  return Object.keys(fieldErrors).length === 0
}

async function submitLogin() {
  if (auth.submitting) return
  if (!loginForm.identifier.trim() || !loginForm.password) {
    auth.error = '请填写登录名和密码'
    return
  }
  try {
    await auth.login({ identifier: loginForm.identifier.trim(), password: loginForm.password })
    await router.replace(redirect.value)
  } catch {
    /* 错误信息已由 store 写进 auth.error，模板里统一展示 */
  }
}

async function submitRegister() {
  if (auth.submitting) return
  if (!validateRegister()) return

  try {
    const result = await auth.register({
      username: registerForm.username.trim(),
      displayName: registerForm.displayName.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password,
    })

    if (result.pending) {
      registered.value = { username: registerForm.username.trim(), message: result.message }
    } else {
      /* 系统首个账号会自动成为管理员并直接登录，无需等待审核 */
      await router.replace(redirect.value)
    }
  } catch {
    /* 同上，错误已在 store 里 */
  }
}

/** 从"等待审核"结果态回到登录表单，并把刚注册的登录名填进去 */
function backToLogin() {
  loginForm.identifier = registered.value?.username || ''
  loginForm.password = ''
  registered.value = null
  tab.value = 'login'
  auth.clearMessages()
}
</script>

<template>
  <div class="auth-page">
    <div class="card">
      <header class="card-head">
        <h1 class="card-title">{{ tab === 'login' ? '登录' : '注册' }}</h1>
        <p class="card-sub">LM Select · 大语言模型与智能体选型推荐系统</p>
      </header>

      <!-- 注册完成、等待审核的结果态 -->
      <template v-if="registered">
        <div class="result">
          <div class="result-icon" aria-hidden="true">✓</div>
          <h2 class="result-title">注册申请已提交</h2>
          <p class="result-text">
            登录名 <strong>{{ registered.username }}</strong> 已创建，当前状态为 <em>待审核</em>。
          </p>
          <p class="result-text">
            本系统未接入邮件服务，审核由管理员在后台手动完成。通过后即可用该账号登录。
          </p>
          <button type="button" class="btn primary block" @click="backToLogin">返回登录</button>
        </div>
      </template>

      <template v-else>
        <!-- 页签 -->
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ active: tab === 'login' }"
            :aria-selected="tab === 'login'"
            @click="tab = 'login'"
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ active: tab === 'register' }"
            :aria-selected="tab === 'register'"
            @click="tab = 'register'"
          >
            注册
          </button>
        </div>

        <!-- 登录 -->
        <form v-if="tab === 'login'" class="form" @submit.prevent="submitLogin">
          <label class="field">
            <span class="field-label">登录名或邮箱</span>
            <input
              v-model="loginForm.identifier"
              class="field-input"
              type="text"
              autocomplete="username"
              placeholder="例如 admin"
            />
          </label>

          <label class="field">
            <span class="field-label">密码</span>
            <input
              v-model="loginForm.password"
              class="field-input"
              type="password"
              autocomplete="current-password"
              placeholder="请输入密码"
            />
          </label>

          <p v-if="auth.error" class="alert error">{{ auth.error }}</p>
          <p v-if="auth.notice" class="alert notice">{{ auth.notice }}</p>

          <button type="submit" class="btn primary block" :disabled="auth.submitting">
            {{ auth.submitting ? '登录中…' : '登录' }}
          </button>

          <!--
            演示账号提示。
            ⚠️ 正式部署前必须删掉这一段 —— 把可用账号写在登录页上等于没有登录。
            放在这里是因为答辩演示需要一个"打开就能进"的路径。
          -->
          <div class="demo-hint">
            <span class="demo-title">演示账号</span>
            <code>admin / lmselect2026</code>（管理员） <code>demo / demo2026abc</code>（普通用户）
          </div>
        </form>

        <!-- 注册 -->
        <form v-else class="form" @submit.prevent="submitRegister">
          <label class="field">
            <span class="field-label">登录名 <em class="req">必填</em></span>
            <input
              v-model="registerForm.username"
              class="field-input"
              :class="{ invalid: fieldErrors.username }"
              type="text"
              autocomplete="username"
              placeholder="3-32 位字母、数字或下划线"
            />
            <span v-if="fieldErrors.username" class="field-error">{{ fieldErrors.username }}</span>
          </label>

          <label class="field">
            <span class="field-label">显示名 <em class="opt">选填，默认与登录名相同</em></span>
            <input
              v-model="registerForm.displayName"
              class="field-input"
              :class="{ invalid: fieldErrors.displayName }"
              type="text"
              placeholder="界面上展示的名字"
            />
            <span v-if="fieldErrors.displayName" class="field-error">
              {{ fieldErrors.displayName }}
            </span>
          </label>

          <label class="field">
            <span class="field-label">邮箱 <em class="opt">选填</em></span>
            <input
              v-model="registerForm.email"
              class="field-input"
              :class="{ invalid: fieldErrors.email }"
              type="text"
              autocomplete="email"
              placeholder="用于后续找回密码，可留空"
            />
            <span v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email }}</span>
          </label>

          <label class="field">
            <span class="field-label">密码 <em class="req">必填</em></span>
            <input
              v-model="registerForm.password"
              class="field-input"
              :class="{ invalid: fieldErrors.password }"
              type="password"
              autocomplete="new-password"
              placeholder="至少 8 位，含字母和数字"
            />
            <span v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password }}</span>
          </label>

          <label class="field">
            <span class="field-label">确认密码 <em class="req">必填</em></span>
            <input
              v-model="registerForm.confirmPassword"
              class="field-input"
              :class="{ invalid: fieldErrors.confirmPassword }"
              type="password"
              autocomplete="new-password"
              placeholder="再输一次"
            />
            <span v-if="fieldErrors.confirmPassword" class="field-error">
              {{ fieldErrors.confirmPassword }}
            </span>
          </label>

          <p v-if="auth.error" class="alert error">{{ auth.error }}</p>

          <p class="alert info">
            提交后账号处于<strong>待审核</strong>状态，需管理员在后台通过后才能登录。
          </p>

          <button type="submit" class="btn primary block" :disabled="auth.submitting">
            {{ auth.submitting ? '提交中…' : '提交注册' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - var(--nav-h));
  min-height: calc(100dvh - var(--nav-h));
  padding: 2rem 1.5rem 3rem;
}

.card {
  box-sizing: border-box;
  width: 100%;
  max-width: 432px;
  padding: 2rem 2rem 1.6rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}

.card-head {
  margin-bottom: 1.3rem;
  text-align: center;
}

.card-title {
  margin: 0 0 0.3rem;
  color: var(--ink);
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.card-sub {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.8rem;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  margin-bottom: 1.2rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.06);
}

.tab {
  padding: 0.45rem 0.5rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  transition:
    background 0.16s var(--ease),
    color 0.16s var(--ease);
}

.tab.active {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 1px 6px rgba(5, 1, 10, 0.12);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.field-label .req,
.field-label .opt {
  font-style: normal;
  font-weight: 400;
}

.field-label .req {
  color: var(--danger);
}

.field-label .opt {
  color: rgba(109, 101, 128, 0.72);
}

.field-input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(27, 20, 37, 0.16);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink);
  font: inherit;
  font-size: 0.9rem;
  transition: border-color 0.16s var(--ease);
}

.field-input:focus {
  border-color: var(--accent);
  outline: none;
}

.field-input.invalid {
  border-color: var(--danger);
}

.field-input::placeholder {
  color: rgba(109, 101, 128, 0.62);
}

.field-error {
  color: var(--danger);
  font-size: 0.74rem;
}

.alert {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  line-height: 1.6;
}

.alert.error {
  background: rgba(217, 58, 86, 0.1);
  color: var(--danger);
}

.alert.notice {
  background: var(--accent-soft);
  color: var(--accent);
}

.alert.info {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink-dim);
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background 0.16s var(--ease);
}

.btn.primary {
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: #7a2fc4;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn.block {
  width: 100%;
  margin-top: 0.2rem;
}

.demo-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.2rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.04);
  color: var(--ink-dim);
  font-size: 0.74rem;
}

.demo-title {
  font-weight: 600;
}

.demo-hint code {
  padding: 0.05rem 0.35rem;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--ink);
  font-size: 0.72rem;
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
}

.result-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 1.4rem;
}

.result-title {
  margin: 0;
  color: var(--ink);
  font-size: 1.05rem;
  font-weight: 600;
}

.result-text {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
  line-height: 1.7;
}

.result .btn.block {
  margin-top: 0.6rem;
}
</style>
