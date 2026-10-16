<script setup>
/**
 * Agent 卡片：图标 + 名称 + 一句话描述 + 底部官网外链。
 *
 * 结构上卡片根是 <div>，里面套一个占满卡面的 <button>：
 * <button> 的内容模型不允许再嵌交互元素，把官网 <a> 塞进按钮里
 * 浏览器虽然照样渲染，但键盘 Tab 会走到一个"按钮里的链接"上，
 * 读屏器和 HTML 规范都不认这种结构。所以拆成两层：
 * 按钮管"打开复刻件"，链接管"去官网"，两者各管一件事、互不干扰。
 *
 * 卡片高度由网格拉齐（同一行等高），.hit 用 flex: 1 撑开，
 * 官网那行因此永远贴在卡底 —— 几张卡并排时链接不会高低不齐。
 */
defineProps({
  agent: { type: Object, required: true },
})

const emit = defineEmits(['open'])

/** 显示用：去掉协议头和结尾斜杠，deepseek.com/harness 比整串 URL 好认 */
function shortUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
</script>

<template>
  <div class="card">
    <button type="button" class="hit" @click="emit('open', agent.id)">
      <img class="icon" :src="agent.iconSrc" :alt="`${agent.name} 图标`" />

      <span class="text">
        <span class="name">{{ agent.name }}</span>
        <span class="tagline">{{ agent.tagline }}</span>
      </span>

      <span class="foot">
        <span class="vendor">{{ agent.vendor }}</span>
        <span class="form">{{ agent.form }}</span>
      </span>
    </button>

    <!--
      新标签页打开。rel 里必须带 noopener：不带的话新页面能通过 window.opener
      反向操作本页（钓鱼站常用手法），noopener 之后 referrer 也更干净。
    -->
    <a
      v-if="agent.site"
      class="site"
      :href="agent.site"
      target="_blank"
      rel="noopener noreferrer"
      :title="agent.site"
    >
      <span class="site-tag">官网</span>
      <span class="site-url">{{ shortUrl(agent.site) }}</span>
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
        <path
          d="M6 3h7v7M13 3 4.5 11.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  padding: 1.1rem;
  border: 1px solid rgba(27, 20, 37, 0.12);
  border-radius: var(--radius);
  background: var(--glass);
  color: var(--ink);
  transition:
    border-color 0.16s var(--ease),
    box-shadow 0.16s var(--ease),
    transform 0.16s var(--ease);
}

.card:hover {
  border-color: var(--accent-ring);
  box-shadow: 0 6px 20px rgba(139, 63, 214, 0.14);
  transform: translateY(-2px);
}

.card:active {
  transform: translateY(0);
}

/* 键盘 Tab 进来时，高亮整张卡而不是只有里面那个按钮 */
.card:focus-within {
  border-color: var(--accent-ring);
}

.hit {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.hit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 6px;
}

/*
  图标直接用完整应用图标 —— 它自带圆角浅色底，
  所以这里不再加背景和阴影，否则就成了"图标外面再套一个方块"。
*/
.icon {
  display: block;
  width: 3rem;
  height: 3rem;
  border-radius: 13px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.name {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.tagline {
  color: var(--ink-dim);
  font-size: 0.78rem;
  line-height: 1.65;
}

.foot {
  display: flex;
  gap: 0.4rem;
  margin-top: auto;
}

.vendor,
.form {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink-dim);
  font-size: 0.7rem;
}

.form {
  background: var(--accent-soft);
  color: var(--accent);
}

/* ---------- 底部官网外链 ---------- */
.site {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid rgba(27, 20, 37, 0.08);
  color: var(--ink-dim);
  font-size: 0.72rem;
  text-decoration: none;
}

.site:hover {
  color: var(--accent);
}

.site:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.site-tag {
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.05);
}

/* 域名过长时截尾，别把卡片撑破 */
.site-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site svg {
  flex-shrink: 0;
  margin-left: auto;
}
</style>
