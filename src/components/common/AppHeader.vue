<script setup>
import { RouterLink, useRoute } from 'vue-router'

import UserMenu from '@/components/common/UserMenu.vue'

const NAV = [
  { to: '/', label: '对话' },
  { to: '/models', label: '模型库' },
  { to: '/compare', label: '对比测试' },
  { to: '/agent', label: 'Agent' },
  { to: '/recommend', label: '推荐' },
]

const route = useRoute()

/**
 * '/' 是所有路径的前缀，必须精确匹配；
 * 其余按前缀匹配，这样以后有子路由时父项也能高亮。
 */
function isActive(to) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span class="brand-name">LM Select</span>
    </RouterLink>

    <nav class="nav">
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="nav-link"
        :class="{ active: isActive(item.to) }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <UserMenu />
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  gap: 1.5rem;
  height: var(--nav-h);
  padding: 0 1.25rem;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass);
  box-shadow: 0 1px 18px rgba(5, 1, 10, 0.12);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
}

.brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
  color: var(--ink);
  text-decoration: none;
}

.brand-mark {
  color: var(--accent);
  font-size: 1rem;
}

.brand-name {
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.nav {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.2rem;
}

.nav-link {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  color: var(--ink-dim);
  font-size: 0.87rem;
  text-decoration: none;
  transition:
    background 0.16s var(--ease),
    color 0.16s var(--ease);
}

.nav-link:hover {
  background: rgba(27, 20, 37, 0.06);
  color: var(--ink);
}

.nav-link.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: 640px) {
  .app-header {
    gap: 0.75rem;
    padding: 0 0.75rem;
  }

  .brand-name {
    display: none;
  }

  .nav-link {
    padding: 0.35rem 0.6rem;
    font-size: 0.82rem;
  }
}
</style>
