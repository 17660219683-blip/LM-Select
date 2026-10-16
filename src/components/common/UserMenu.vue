<script setup>
/**
 * 顶栏右侧的用户区。
 *
 * 未登录时是一个跳 /login 的链接而不是按钮 ——
 * 登录态由 httpOnly Cookie 决定，前端说了不算，所以入口应该是"去登录页"
 * 这样一次导航，而不是"打开一个弹窗"。用 RouterLink 还能让用户右键新开标签。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import PasswordModal from '@/components/account/PasswordModal.vue'

defineProps({
  /** chip：导航栏里的紧凑样式；block：侧边栏底部的整行样式（下拉向上弹） */
  variant: { type: String, default: 'chip' },
})

const auth = useAuthStore()
const router = useRouter()
const open = ref(false)
const passwordOpen = ref(false)
const root = ref(null)

function onDocumentClick(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false
}

watch(open, (value) => {
  if (value) document.addEventListener('click', onDocumentClick)
  else document.removeEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

async function logout() {
  open.value = false
  await auth.logout()
  /* 退出后停在当前页会看到"未登录"状态下的页面，不如直接回首页 */
  router.push('/')
}

/*
  用方法而不是内联 `@click="open = false; passwordOpen = true"`：
  模板里的多语句表达式一旦被格式化工具折行就会丢掉分号、直接变成语法错误
  （构建报 Unexpected token），拆成具名函数既躲开这个坑，也更好读。
*/
function openPassword() {
  open.value = false
  passwordOpen.value = true
}
</script>

<template>
  <div ref="root" class="user-menu" :class="variant">
    <RouterLink v-if="!auth.isLoggedIn" to="/login" class="login-btn">登录</RouterLink>

    <template v-else>
      <button type="button" class="user-btn" :aria-expanded="open" @click="open = !open">
        <span class="avatar" aria-hidden="true">{{ auth.initial }}</span>
        <span class="user-name">{{ auth.displayName }}</span>
        <span v-if="auth.isAdmin" class="role-tag">管理员</span>
        <span class="caret" aria-hidden="true">▾</span>
      </button>

      <ul v-if="open" class="menu">
        <li class="menu-head">
          <span class="menu-head-name">{{ auth.displayName }}</span>
          <span class="menu-head-sub">@{{ auth.user.username }}</span>
        </li>
        <li v-if="auth.isAdmin">
          <RouterLink to="/admin/users" class="menu-item" @click="open = false">
            账号审核
          </RouterLink>
        </li>
        <li>
          <button type="button" class="menu-item" @click="openPassword">修改密码</button>
        </li>
        <li>
          <RouterLink to="/logs" class="menu-item" @click="open = false">日志管理</RouterLink>
        </li>
        <li>
          <button type="button" class="menu-item danger" @click="logout">退出登录</button>
        </li>
      </ul>
    </template>

    <PasswordModal v-if="passwordOpen" @close="passwordOpen = false" />
  </div>
</template>

<style scoped>
.user-menu {
  position: relative;
  flex-shrink: 0;
}

.login-btn {
  display: inline-block;
  padding: 0.35rem 1.1rem;
  border: 1px solid var(--accent-ring);
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.16s var(--ease);
}

.login-btn:hover {
  background: #7a2fc4;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.7rem 0.25rem 0.25rem;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  transition: background 0.16s var(--ease);
}

.user-btn:hover {
  background: #fff;
}

.avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.user-name {
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  color: var(--ink-dim);
  font-size: 0.7rem;
}

/* 管理员身份要一眼可见：这个账号能审核别人、能看全站日志，不该和普通用户长得一样 */
.role-tag {
  padding: 0.05rem 0.4rem;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 600;
}

.menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 8px);
  right: 0;
  min-width: 168px;
  margin: 0;
  padding: 0.3rem;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--shadow);
  list-style: none;
}

/* 下拉顶部标示当前是谁，多账号切换时不用猜 */
.menu-head {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  margin-bottom: 0.25rem;
  padding: 0.4rem 0.65rem 0.5rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.08);
}

.menu-head-name {
  color: var(--ink);
  font-size: 0.84rem;
  font-weight: 600;
}

.menu-head-sub {
  color: var(--ink-dim);
  font-size: 0.72rem;
}

/* 侧边栏底部空间有限，下拉向上弹 */
.block .menu {
  top: auto;
  right: 0;
  bottom: calc(100% + 8px);
  left: 0;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  text-align: left;
  text-decoration: none;
  transition: background 0.14s var(--ease);
}

.menu-item:hover {
  background: var(--accent-soft);
}

.menu-item.danger {
  color: var(--danger);
}

.menu-item.danger:hover {
  background: rgba(217, 58, 86, 0.1);
}

/* block 变体：在侧边栏里占满一整行 */
.block {
  width: 100%;
}

.block .user-btn,
.block .login-btn {
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.8rem;
}
</style>
