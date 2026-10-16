<script setup>
import { onMounted, ref, watch } from 'vue'

import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import MessageList from '@/components/chat/MessageList.vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()

const COLLAPSE_KEY = 'lm-select:sidebar-collapsed'

/** 侧边栏收起状态持久化，刷新后保持 */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const collapsed = ref(readCollapsed())

function toggleSidebar() {
  collapsed.value = !collapsed.value
}

watch(collapsed, (value) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0')
  } catch {
    /* 私密模式下写不了，忽略即可 */
  }
})

onMounted(() => {
  chat.bootstrap()
})
</script>

<template>
  <div class="chat-layout">
    <ChatSidebar :collapsed="collapsed" />

    <!-- 窄屏时侧边栏是浮层，点空白处收起 -->
    <div v-if="!collapsed" class="sidebar-backdrop" @click="toggleSidebar"></div>

    <section class="chat-main" :class="{ collapsed }">
      <header class="chat-header">
        <button
          type="button"
          class="sidebar-toggle"
          :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
          :aria-expanded="!collapsed"
          aria-controls="chat-sidebar"
          @click="toggleSidebar"
        >
          <span aria-hidden="true">{{ collapsed ? '☰' : '‹' }}</span>
        </button>

        <p class="chat-meta">
          会话 <code>{{ chat.currentSessionId || '—' }}</code>
          <span v-if="chat.isStreaming" class="chat-meta-live">· 正在生成</span>
        </p>
      </header>

      <div v-if="chat.error" class="error-bar">
        <span class="error-text">{{ chat.error }}</span>
        <div class="error-actions">
          <button type="button" class="error-btn" @click="chat.retryConnection()">重试</button>
          <button type="button" class="error-btn ghost" @click="chat.dismissError()">知道了</button>
        </div>
      </div>

      <MessageList />
      <ChatComposer />
    </section>
  </div>
</template>

<style scoped>
.chat-layout {
  /* 顶部导航栏占了 --nav-h，页面高度要减掉它。dvh 带 vh 兜底 */
  min-height: calc(100vh - var(--nav-h));
  min-height: calc(100dvh - var(--nav-h));
}

/*
  用 fixed + top/bottom 直接锚定高度，不再依赖 calc(100dvh - var(--nav-h))。
  之前输入框被挤出可视区，就是因为高度没锁住：
  一旦那个 calc 解析失败，height 退化成 auto，页面就被内容撑高、
  消息区不再内部滚动，输入框被顶到屏幕外面去。
  这样写和侧边栏是同一套定位方式，高度由定位确定，不可能被撑开。
*/
.chat-main {
  position: fixed;
  top: var(--nav-h);
  right: 0;
  bottom: 0;
  left: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 1.15rem 1.5rem 1.25rem;
  transition: left 0.28s var(--ease);
}

/* 侧边栏是 fixed，不占布局，靠主区让出等宽距离给它腾位置 */
.chat-main.collapsed {
  left: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.sidebar-toggle {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--glass);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 1rem;
  line-height: 1;
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition:
    background 0.18s var(--ease),
    transform 0.18s var(--ease);
}

.sidebar-toggle:hover {
  background: #fff;
  transform: translateY(-1px);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* 背景现在是浅色的，用浅色描边把深色文字从波纹里托起来 */
.chat-meta {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.8rem;
  text-shadow:
    0 1px 2px rgba(255, 255, 255, 0.95),
    0 0 12px rgba(255, 255, 255, 0.8);
}

.chat-meta code,
.chat-meta-live {
  color: #d9b8ff;
}

.error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.7rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid rgba(255, 107, 129, 0.45);
  border-radius: var(--radius-sm);
  background: rgba(217, 58, 86, 0.24);
  font-size: 0.85rem;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.error-text {
  word-break: break-word;
}

.error-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.4rem;
}

.error-btn {
  padding: 0.25rem 0.8rem;
  border: 1px solid rgba(217, 58, 86, 0.5);
  border-radius: 8px;
  background: rgba(217, 58, 86, 0.16);
  color: #8a1c30;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
}

.error-btn:hover {
  background: rgba(217, 58, 86, 0.28);
}

.error-btn.ghost {
  background: transparent;
  font-weight: 400;
}

.sidebar-backdrop {
  display: none;
}

@media (max-width: 880px) {
  .chat-main,
  .chat-main.collapsed {
    left: 0;
    padding: 1rem;
  }

  /* 窄屏时侧边栏改成浮层，配一层可点击关闭的遮罩 */
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 15;
    background: rgba(5, 1, 10, 0.42);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }
}
</style>
