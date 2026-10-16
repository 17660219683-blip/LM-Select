<script setup>
/**
 * 修改密码弹窗。
 *
 * 单独抽成组件而不是并进 AuthView：它只在已登录之后用得到，
 * 和登录页的生命周期完全不重叠，放一起只会让两边都变复杂。
 *
 * 注意"其他设备会掉线"这句提示。后端改密时会 token_version +1，
 * 所有旧令牌当场失效——这是改密应有的效果，但用户不知道的话，
 * 第二天在另一台机器上发现自己被登出，会以为系统出了问题。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'

const emit = defineEmits(['close'])
const auth = useAuthStore()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const fieldErrors = reactive({})
const done = ref(false)

const canSubmit = computed(
  () => form.currentPassword && form.newPassword && form.confirmPassword && !auth.submitting,
)

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function validate() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]

  if (form.newPassword.length < 8) fieldErrors.newPassword = '密码至少 8 位'
  else if (!/[a-zA-Z]/.test(form.newPassword)) fieldErrors.newPassword = '密码需包含至少一个字母'
  else if (!/\d/.test(form.newPassword)) fieldErrors.newPassword = '密码需包含至少一个数字'
  else if (form.newPassword === form.currentPassword)
    fieldErrors.newPassword = '新密码不能与当前密码相同'

  if (form.confirmPassword !== form.newPassword)
    fieldErrors.confirmPassword = '两次输入的密码不一致'

  return Object.keys(fieldErrors).length === 0
}

async function submit() {
  auth.clearMessages()
  if (!validate()) return
  try {
    await auth.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    })
    done.value = true
  } catch {
    /* 错误信息由 store 提供，模板里展示 */
  }
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="pwd-title">
      <h2 id="pwd-title" class="modal-title">修改密码</h2>

      <template v-if="done">
        <p class="alert notice">{{ auth.notice }}</p>
        <p class="hint">其他设备上的登录已失效。当前这台设备无需重新登录。</p>
        <div class="actions">
          <button type="button" class="btn primary" @click="emit('close')">知道了</button>
        </div>
      </template>

      <form v-else class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">当前密码</span>
          <input
            v-model="form.currentPassword"
            class="field-input"
            type="password"
            autocomplete="current-password"
          />
        </label>

        <label class="field">
          <span class="field-label">新密码</span>
          <input
            v-model="form.newPassword"
            class="field-input"
            :class="{ invalid: fieldErrors.newPassword }"
            type="password"
            autocomplete="new-password"
            placeholder="至少 8 位，含字母和数字"
          />
          <span v-if="fieldErrors.newPassword" class="field-error">
            {{ fieldErrors.newPassword }}
          </span>
        </label>

        <label class="field">
          <span class="field-label">确认新密码</span>
          <input
            v-model="form.confirmPassword"
            class="field-input"
            :class="{ invalid: fieldErrors.confirmPassword }"
            type="password"
            autocomplete="new-password"
          />
          <span v-if="fieldErrors.confirmPassword" class="field-error">
            {{ fieldErrors.confirmPassword }}
          </span>
        </label>

        <p v-if="auth.error" class="alert error">{{ auth.error }}</p>

        <div class="actions">
          <button type="button" class="btn ghost" @click="emit('close')">取消</button>
          <button type="submit" class="btn primary" :disabled="!canSubmit">
            {{ auth.submitting ? '提交中…' : '确认修改' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(27, 20, 37, 0.32);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 380px;
  padding: 1.6rem 1.6rem 1.4rem;
  border-radius: var(--radius);
  background: #fff;
  color: var(--ink);
  box-shadow: 0 18px 48px rgba(5, 1, 10, 0.32);
}

.modal-title {
  margin: 0 0 1.1rem;
  font-size: 1.15rem;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.field-input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgba(27, 20, 37, 0.16);
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font: inherit;
  font-size: 0.9rem;
}

.field-input:focus {
  border-color: var(--accent);
  outline: none;
}

.field-input.invalid {
  border-color: var(--danger);
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

.hint {
  margin: 0.6rem 0 0;
  color: var(--ink-dim);
  font-size: 0.78rem;
  line-height: 1.6;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.btn {
  padding: 0.5rem 1.2rem;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  transition: background 0.16s var(--ease);
}

.btn.ghost {
  border: 1px solid rgba(27, 20, 37, 0.16);
  background: transparent;
  color: var(--ink-dim);
}

.btn.ghost:hover {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink);
}

.btn.primary {
  border: none;
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
</style>
