<script setup>
import { computed } from 'vue'

import SessionItem from '@/components/chat/SessionItem.vue'
import UserMenu from '@/components/common/UserMenu.vue'
import { useChatStore } from '@/stores/chat'

defineProps({
  /** 收起状态由父级控制：收起时整块向左滑出视口 */
  collapsed: { type: Boolean, default: false },
})

const chat = useChatStore()

/** YYYY-MM-DD，用来把会话按天分桶 */
function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

const groups = computed(() => {
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 24 * 3600 * 1000))
  const buckets = { today: [], yesterday: [], earlier: [] }

  for (const session of chat.sessions) {
    // 会话 ID 就是 YYYY-MM-DD_HH-MM-SS，前 10 位即日期
    const key = session.id.slice(0, 10)
    if (key === today) buckets.today.push(session)
    else if (key === yesterday) buckets.yesterday.push(session)
    else buckets.earlier.push(session)
  }

  return [
    { label: '今天', items: buckets.today },
    { label: '昨天', items: buckets.yesterday },
    { label: '更早', items: buckets.earlier },
  ].filter((group) => group.items.length)
})
</script>

<template>
  <aside id="chat-sidebar" class="sidebar" :class="{ collapsed }">
    <button
      type="button"
      class="new-session"
      :disabled="chat.isStreaming"
      @click="chat.newSession()"
    >
      <span aria-hidden="true">✏️</span>
      <span>新建会话</span>
    </button>

    <div class="history">
      <p class="history-title">会话历史</p>

      <p v-if="chat.isLoading" class="history-hint">加载中…</p>
      <p v-else-if="!chat.sessions.length" class="history-hint">还没有保存的会话</p>

      <div v-else class="history-groups">
        <section v-for="group in groups" :key="group.label" class="group">
          <p class="group-label">{{ group.label }}</p>

          <ul class="history-list">
            <SessionItem
              v-for="session in group.items"
              :key="session.id"
              :session="session"
              :active="session.id === chat.currentSessionId"
              @select="chat.switchSession(session.id)"
              @rename="chat.renameSession(session.id, $event)"
              @remove="chat.removeSession(session.id)"
            />
          </ul>
        </section>
      </div>
    </div>

    <div class="account">
      <UserMenu variant="block" />
    </div>
  </aside>
</template>

<style scoped>
/*
  贴着整个页面左侧、通高、白色半透明磨砂。
  用 position: fixed 是为了不受父级内边距影响，能真正贴到视口边缘。
  top 让开顶部导航栏的高度。
*/
.sidebar {
  position: fixed;
  top: var(--nav-h);
  right: auto;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 1rem;
  width: var(--sidebar-w);
  padding: 1.1rem 1rem 1rem;
  border-right: 1px solid var(--glass-border);
  background: var(--glass);
  box-shadow: 1px 0 26px rgba(5, 1, 10, 0.12);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  transition: transform 0.28s var(--ease);
}

.sidebar.collapsed {
  transform: translateX(-100%);
}

.new-session {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--accent-ring);
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  transition:
    background 0.18s var(--ease),
    color 0.18s var(--ease);
}

.new-session:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.new-session:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.history {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}

.history-title {
  margin: 0;
  padding: 0 0.15rem;
  color: var(--ink-dim);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.history-hint {
  margin: 0;
  padding: 0 0.15rem;
  color: var(--ink-dim);
  font-size: 0.8rem;
}

.history-groups {
  flex: 1;
  min-height: 0;
  padding-right: 0.15rem;
  overflow-y: auto;
}

.history-groups::-webkit-scrollbar {
  width: 6px;
}

.history-groups::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(27, 20, 37, 0.16);
}

.history-groups::-webkit-scrollbar-thumb:hover {
  background: rgba(27, 20, 37, 0.28);
}

.group + .group {
  margin-top: 0.7rem;
}

.group-label {
  margin: 0 0 0.25rem;
  padding: 0 0.35rem;
  color: var(--ink-dim);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.account {
  padding-top: 0.75rem;
  border-top: 1px solid rgba(27, 20, 37, 0.1);
}
</style>
