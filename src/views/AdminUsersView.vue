<script setup>
/**
 * 账号审核与用户管理（/admin/users），仅管理员可见。
 *
 * 这个页面是"注册需要审核"这个决定的落点：没有它，用户注册完就永远卡在
 * pending 状态，谁也进不来。
 *
 * 三类操作分开处理，因为它们的后果完全不同：
 *   通过 / 驳回 —— 待审核账号的出口，驳回是删除，不可撤销，必须二次确认
 *   停用 / 启用 —— 已有账号的开关，停用会立刻踢掉对方在线上的会话
 *   改角色 / 重置密码 —— 权限类操作，影响面最大，都放在详情弹窗里
 *                       而不是列表行上，避免误点
 */
import { onMounted, reactive, ref } from 'vue'

import {
  approveUser,
  getUserDetail,
  listUsers,
  rejectUser,
  resetUserPassword,
  updateUser,
} from '@/services/authApi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const users = ref([])
const counts = reactive({ pending: 0, active: 0, disabled: 0, total: 0 })
const loading = ref(false)
const error = ref('')

/** '' 表示全部 */
const statusFilter = ref('')
const keyword = ref('')

/** 详情弹窗：null 表示关闭 */
const detail = ref(null)
const detailLoading = ref(false)

/** 需要二次确认或输入的操作。kind: 'reject' | 'disable' | 'reset' */
const dialog = reactive({ kind: '', user: null, newPassword: '', submitting: false, error: '' })

const FILTERS = [
  { value: 'pending', label: '待审核', key: 'pending' },
  { value: '', label: '全部', key: 'total' },
  { value: 'active', label: '已启用', key: 'active' },
  { value: 'disabled', label: '已停用', key: 'disabled' },
]

const STATUS_TEXT = { pending: '待审核', active: '已启用', disabled: '已停用' }

/** 当前登录的管理员不能动自己 —— 后端也会拦，这里提前把按钮禁掉，省一次必然失败的请求 */
const isSelf = (user) => user.id === auth.user?.id

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const data = await listUsers({ status: statusFilter.value, q: keyword.value.trim() })
    users.value = data.users
    Object.assign(counts, data.counts)
  } catch (err) {
    error.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function switchFilter(value) {
  statusFilter.value = value
  reload()
}

let searchTimer = null
function onSearchInput() {
  /* 防抖：每敲一个字就查一次数据库没必要，输入停 300ms 再查 */
  clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 300)
}

async function openDetail(user) {
  detail.value = { user, logs: [] }
  detailLoading.value = true
  try {
    const data = await getUserDetail(user.id)
    detail.value = { user: data.user, logs: data.logs }
  } catch (err) {
    error.value = err?.message || '加载详情失败'
  } finally {
    detailLoading.value = false
  }
}

/** 统一包一层：执行操作 → 关弹窗 → 刷新列表和详情 */
async function runAction(fn) {
  dialog.error = ''
  dialog.submitting = true
  try {
    await fn()
    const detailId = detail.value?.user?.id
    dialog.kind = ''
    dialog.user = null
    dialog.newPassword = ''
    await reload()
    if (detailId) {
      const stillThere = users.value.find((u) => u.id === detailId)
      /* 被驳回的账号已经从列表里消失了，详情弹窗也就没必要留着 */
      if (stillThere) await openDetail(stillThere)
      else detail.value = null
    }
  } catch (err) {
    dialog.error = err?.message || '操作失败'
  } finally {
    dialog.submitting = false
  }
}

const approve = (user) => runAction(() => approveUser(user.id))

const askReject = (user) => {
  Object.assign(dialog, { kind: 'reject', user, error: '' })
}

const askDisable = (user) => {
  Object.assign(dialog, { kind: 'disable', user, error: '' })
}

const enable = (user) => runAction(() => updateUser(user.id, { status: 'active' }))

const toggleRole = (user) =>
  runAction(() => updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' }))

const askReset = (user) => {
  Object.assign(dialog, { kind: 'reset', user, newPassword: genPassword(), error: '' })
}

/** 生成一个符合强度规则的随机密码：8 位字母数字混排 + 至少各一个字母和数字 */
function genPassword() {
  const letters = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = letters + letters.toUpperCase() + digits
  const pick = (set) => set[Math.floor(Math.random() * set.length)]

  let out = pick(letters) + pick(letters.toUpperCase()) + pick(digits)
  while (out.length < 10) out += pick(all)

  /* 打乱一次，否则开头永远是"字母 大写字母 数字"的固定形态 */
  return out
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

function confirmDialog() {
  const user = dialog.user
  if (dialog.kind === 'reject') return runAction(() => rejectUser(user.id))
  if (dialog.kind === 'disable') return runAction(() => updateUser(user.id, { status: 'disabled' }))
  if (dialog.kind === 'reset') {
    if (dialog.newPassword.length < 8) {
      dialog.error = '密码至少 8 位'
      return
    }
    return runAction(() => resetUserPassword(user.id, dialog.newPassword))
  }
}

function closeDialog() {
  Object.assign(dialog, { kind: '', user: null, newPassword: '', error: '' })
}

/** 时间展示到分钟即可，审计用途不需要秒 */
function fmt(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(reload)
</script>

<template>
  <div class="admin-page">
    <header class="page-head">
      <div>
        <h1 class="page-title">账号审核与用户管理</h1>
        <p class="page-sub">
          新注册账号默认为「待审核」，通过后才能登录。停用与改角色会立即使该账号的登录失效。
        </p>
      </div>
      <div class="head-stat">
        <span class="stat"
          ><b>{{ counts.pending }}</b> 待审核</span
        >
        <span class="stat"
          ><b>{{ counts.active }}</b> 已启用</span
        >
        <span class="stat"
          ><b>{{ counts.total }}</b> 总计</span
        >
      </div>
    </header>

    <div class="toolbar">
      <div class="filters">
        <button
          v-for="f in FILTERS"
          :key="f.label"
          type="button"
          class="filter"
          :class="{ active: statusFilter === f.value }"
          @click="switchFilter(f.value)"
        >
          {{ f.label }}
          <span class="filter-count">{{ counts[f.key] }}</span>
        </button>
      </div>

      <input
        v-model="keyword"
        class="search"
        type="search"
        placeholder="搜索登录名 / 显示名 / 邮箱"
        @input="onSearchInput"
      />
    </div>

    <p v-if="error" class="alert error">{{ error }}</p>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>登录名</th>
            <th>显示名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>最后登录</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="empty">加载中…</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="8" class="empty">没有符合条件的账号</td>
          </tr>
          <!--
            这里必须用 <template v-else> 把 v-for 包起来。
            把 v-for 和 v-else 写在同一个 <tr> 上，Vue 3 里 v-if 的优先级高于 v-for，
            虽然本例能跑通，但读代码的人要停下来想一下才敢确认，不值得。
          -->
          <template v-else>
            <tr v-for="user in users" :key="user.id">
              <td>
                <button type="button" class="link-btn" @click="openDetail(user)">
                  {{ user.username }}
                </button>
                <span v-if="isSelf(user)" class="self-tag">我</span>
              </td>
              <td>{{ user.displayName }}</td>
              <td class="dim">{{ user.email || '—' }}</td>
              <td>
                <span class="badge" :class="user.role === 'admin' ? 'role-admin' : 'role-user'">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
              </td>
              <td>
                <span class="badge" :class="`st-${user.status}`">{{
                  STATUS_TEXT[user.status]
                }}</span>
              </td>
              <td class="dim">{{ fmt(user.createdAt) }}</td>
              <td class="dim">{{ fmt(user.lastLoginAt) }}</td>
              <td class="col-actions">
                <template v-if="user.status === 'pending'">
                  <button type="button" class="mini primary" @click="approve(user)">通过</button>
                  <button type="button" class="mini danger" @click="askReject(user)">驳回</button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="mini"
                    :disabled="isSelf(user)"
                    @click="user.status === 'disabled' ? enable(user) : askDisable(user)"
                  >
                    {{ user.status === 'disabled' ? '启用' : '停用' }}
                  </button>
                  <button
                    type="button"
                    class="mini"
                    :disabled="isSelf(user)"
                    @click="askReset(user)"
                  >
                    重置密码
                  </button>
                </template>
                <button type="button" class="mini ghost" @click="openDetail(user)">详情</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 详情：账号信息 + 它的审计轨迹 -->
    <div v-if="detail" class="mask" @click.self="detail = null">
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2 class="modal-title">{{ detail.user.displayName }}</h2>
          <button type="button" class="close" aria-label="关闭" @click="detail = null">×</button>
        </header>

        <dl class="facts">
          <div>
            <dt>登录名</dt>
            <dd>{{ detail.user.username }}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{{ detail.user.email || '—' }}</dd>
          </div>
          <div>
            <dt>角色</dt>
            <dd>{{ detail.user.role === 'admin' ? '管理员' : '普通用户' }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ STATUS_TEXT[detail.user.status] }}</dd>
          </div>
          <div>
            <dt>注册时间</dt>
            <dd>{{ fmt(detail.user.createdAt) }}</dd>
          </div>
          <div>
            <dt>最后登录</dt>
            <dd>{{ fmt(detail.user.lastLoginAt) }}</dd>
          </div>
        </dl>

        <div class="modal-actions">
          <button
            type="button"
            class="btn"
            :disabled="isSelf(detail.user)"
            @click="toggleRole(detail.user)"
          >
            {{ detail.user.role === 'admin' ? '降为普通用户' : '设为管理员' }}
          </button>
          <button
            v-if="detail.user.status === 'active'"
            type="button"
            class="btn danger"
            :disabled="isSelf(detail.user)"
            @click="askDisable(detail.user)"
          >
            停用账号
          </button>
          <button
            v-else-if="detail.user.status === 'disabled'"
            type="button"
            class="btn"
            @click="enable(detail.user)"
          >
            恢复启用
          </button>
        </div>

        <h3 class="section-title">操作记录</h3>
        <p v-if="detailLoading" class="dim small">加载中…</p>
        <p v-else-if="!detail.logs.length" class="dim small">暂无记录</p>
        <ul v-else class="logs">
          <li v-for="log in detail.logs" :key="log.id" class="log-item">
            <span class="log-time">{{ fmt(log.created_at) }}</span>
            <span class="log-type" :class="{ fail: !log.success }">{{ log.event_type }}</span>
            <span class="log-reason">{{ log.reason || '—' }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- 二次确认 / 重置密码 -->
    <div v-if="dialog.kind" class="mask" @click.self="closeDialog">
      <div class="modal small" role="dialog" aria-modal="true">
        <h2 class="modal-title">
          {{ dialog.kind === 'reject' ? '驳回注册申请' : '' }}
          {{ dialog.kind === 'disable' ? '停用账号' : '' }}
          {{ dialog.kind === 'reset' ? '重置密码' : '' }}
        </h2>

        <p class="modal-text">
          <template v-if="dialog.kind === 'reject'">
            账号 <strong>{{ dialog.user.username }}</strong> 将被<strong>删除</strong>，
            该登录名会被释放。操作不可撤销，操作记录会保留在审计日志里。
          </template>
          <template v-else-if="dialog.kind === 'disable'">
            账号 <strong>{{ dialog.user.username }}</strong> 将无法登录，
            且其<strong>当前在线的会话会立即失效</strong>。
          </template>
          <template v-else>
            为 <strong>{{ dialog.user.username }}</strong> 设置新密码。
            重置后该账号在所有设备上的登录会失效，需要把新密码线下告知对方。
          </template>
        </p>

        <label v-if="dialog.kind === 'reset'" class="field">
          <span class="field-label">新密码</span>
          <div class="pwd-row">
            <input v-model="dialog.newPassword" class="field-input" type="text" />
            <button type="button" class="btn tiny" @click="dialog.newPassword = genPassword()">
              重新生成
            </button>
          </div>
        </label>

        <p v-if="dialog.error" class="alert error">{{ dialog.error }}</p>

        <div class="modal-actions end">
          <button type="button" class="btn ghost" @click="closeDialog">取消</button>
          <button
            type="button"
            class="btn"
            :class="{ danger: dialog.kind !== 'reset' }"
            :disabled="dialog.submitting"
            @click="confirmDialog"
          >
            {{ dialog.submitting ? '处理中…' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  box-sizing: border-box;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.8rem 1.5rem 3rem;
}

.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.page-title {
  margin: 0 0 0.3rem;
  color: var(--ink);
  font-size: 1.3rem;
  font-weight: 600;
}

.page-sub {
  max-width: 46rem;
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
  line-height: 1.7;
}

.head-stat {
  display: flex;
  gap: 0.5rem;
}

.stat {
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink-dim);
  font-size: 0.76rem;
}

.stat b {
  color: var(--accent);
  font-size: 0.9rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  transition:
    background 0.16s var(--ease),
    color 0.16s var(--ease);
}

.filter.active {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.filter-count {
  color: inherit;
  font-size: 0.72rem;
  opacity: 0.75;
}

.search {
  box-sizing: border-box;
  min-width: 240px;
  padding: 0.45rem 0.8rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.82);
  color: var(--ink);
  font: inherit;
  font-size: 0.84rem;
}

.search:focus {
  border-color: var(--accent);
  outline: none;
}

.alert {
  margin: 0 0 0.9rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  line-height: 1.6;
}

.alert.error {
  background: rgba(217, 58, 86, 0.1);
  color: var(--danger);
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.table th {
  padding: 0.7rem 0.8rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.08);
  color: var(--ink-dim);
  font-size: 0.76rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

.table td {
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.05);
  color: var(--ink);
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover {
  background: rgba(139, 63, 214, 0.045);
}

.dim {
  color: var(--ink-dim);
}

.small {
  font-size: 0.8rem;
}

.empty {
  padding: 2rem;
  color: var(--ink-dim);
  text-align: center;
}

.col-actions {
  width: 1%;
  white-space: nowrap;
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
}

.link-btn:hover {
  text-decoration: underline;
}

.self-tag {
  margin-left: 0.35rem;
  padding: 0.02rem 0.3rem;
  border-radius: 4px;
  background: rgba(27, 20, 37, 0.08);
  color: var(--ink-dim);
  font-size: 0.66rem;
}

.badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  white-space: nowrap;
}

.role-admin {
  background: var(--accent-soft);
  color: var(--accent);
}

.role-user {
  background: rgba(27, 20, 37, 0.06);
  color: var(--ink-dim);
}

.st-pending {
  background: rgba(186, 117, 23, 0.14);
  color: #8a5300;
}

.st-active {
  background: rgba(15, 110, 86, 0.12);
  color: #0f6e56;
}

.st-disabled {
  background: rgba(217, 58, 86, 0.12);
  color: var(--danger);
}

.mini {
  padding: 0.24rem 0.6rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  transition: background 0.14s var(--ease);
}

.mini:hover:not(:disabled) {
  background: rgba(27, 20, 37, 0.05);
}

.mini.primary {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.mini.primary:hover:not(:disabled) {
  background: #7a2fc4;
}

.mini.danger {
  border-color: rgba(217, 58, 86, 0.4);
  color: var(--danger);
}

.mini.ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ink-dim);
}

.mini:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

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
  box-sizing: border-box;
  width: 100%;
  max-width: 520px;
  max-height: 84vh;
  overflow-y: auto;
  padding: 1.5rem;
  border-radius: var(--radius);
  background: #fff;
  color: var(--ink);
  box-shadow: 0 18px 48px rgba(5, 1, 10, 0.32);
}

.modal.small {
  max-width: 420px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.modal-title {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.close {
  padding: 0 0.35rem;
  border: none;
  background: none;
  color: var(--ink-dim);
  cursor: pointer;
  font-size: 1.3rem;
  line-height: 1;
}

.close:hover {
  color: var(--ink);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem 1rem;
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.035);
}

.facts div {
  display: flex;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.facts dt {
  flex-shrink: 0;
  color: var(--ink-dim);
}

.facts dd {
  margin: 0;
  color: var(--ink);
  font-weight: 600;
}

.modal-text {
  margin: 0 0 1rem;
  color: var(--ink-dim);
  font-size: 0.84rem;
  line-height: 1.7;
}

.section-title {
  margin: 1.2rem 0 0.6rem;
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 600;
}

.logs {
  margin: 0;
  padding: 0;
  list-style: none;
}

.log-item {
  display: grid;
  grid-template-columns: 118px 132px 1fr;
  gap: 0.6rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(27, 20, 37, 0.05);
  font-size: 0.78rem;
}

.log-time {
  color: var(--ink-dim);
}

.log-type {
  color: var(--accent);
  font-weight: 600;
}

.log-type.fail {
  color: var(--danger);
}

.log-reason {
  color: var(--ink-dim);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 1rem;
}

.field-label {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.pwd-row {
  display: flex;
  gap: 0.5rem;
}

.field-input {
  box-sizing: border-box;
  flex: 1;
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(27, 20, 37, 0.16);
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

.field-input:focus {
  border-color: var(--accent);
  outline: none;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.modal-actions.end {
  justify-content: flex-end;
  margin-top: 0.8rem;
}

.btn {
  padding: 0.45rem 1rem;
  border: 1px solid rgba(27, 20, 37, 0.16);
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  transition: background 0.16s var(--ease);
}

.btn:hover:not(:disabled) {
  background: rgba(27, 20, 37, 0.05);
}

.btn.primary,
.btn.danger {
  border-color: transparent;
  color: #fff;
}

.btn.primary {
  background: var(--accent);
}

.btn.danger {
  background: var(--danger);
}

.btn.ghost {
  background: transparent;
  color: var(--ink-dim);
}

.btn.tiny {
  padding: 0.3rem 0.7rem;
  font-size: 0.76rem;
  white-space: nowrap;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 720px) {
  .page-head {
    flex-direction: column;
  }

  .search {
    min-width: 0;
    width: 100%;
  }

  .log-item {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
