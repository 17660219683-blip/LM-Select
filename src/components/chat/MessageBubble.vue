<script setup>
import { NICKNAME } from '@/config'

defineProps({
  role: { type: String, required: true },
  content: { type: String, default: '' },
  /** 正在流式输出，用来显示"正在输入" */
  streaming: { type: Boolean, default: false },
})

const LABELS = { user: '我', assistant: NICKNAME }
</script>

<template>
  <article class="bubble" :class="role">
    <header class="bubble-head">
      <span class="who">{{ LABELS[role] ?? role }}</span>
      <span v-if="streaming" class="typing">正在输入</span>
    </header>

    <div class="bubble-body">{{ content }}</div>
  </article>
</template>

<style scoped>
/* 白色不透明对话气泡，靠对齐方向 + 标签颜色区分用户和 AI */
.bubble {
  max-width: min(78%, 72ch);
  padding: 0.7rem 0.95rem;
  border-radius: var(--radius);
  background: #fff;
  color: var(--ink);
  /* 字号放在这里，max-width 的 ch 单位才会按正文大小算 */
  font-size: 0.92rem;
  box-shadow: var(--shadow);
  animation: bubble-in 0.22s var(--ease) both;
}

/* 靠近说话人的那个角收窄，形成"尾巴"的方向感 */
.bubble.user {
  align-self: flex-end;
  border-bottom-right-radius: 5px;
}

.bubble.assistant {
  align-self: flex-start;
  border-bottom-left-radius: 5px;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bubble {
    animation: none;
  }
}

.bubble-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.3rem;
}

.who {
  padding: 0.02rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.bubble.user .who {
  background: rgba(27, 20, 37, 0.06);
  color: var(--ink-dim);
}

.typing {
  color: var(--ink-dim);
  font-size: 0.7rem;
}

.typing::after {
  content: '…';
  animation: dots 1.2s steps(4, end) infinite;
}

@keyframes dots {
  0% {
    opacity: 0.25;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.25;
  }
}

.bubble-body {
  /* 保留换行和缩进：代码块暂时按纯文本显示，缩进不会丢 */
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
