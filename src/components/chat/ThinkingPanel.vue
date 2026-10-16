<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
})

const body = ref(null)

/** 思考内容持续增长时保持滚到底部 */
watch(
  () => props.text,
  async () => {
    await nextTick()
    const el = body.value
    if (el) el.scrollTop = el.scrollHeight
  },
)
</script>

<template>
  <div class="thinking">
    <span class="thinking-head">
      <span class="dot" aria-hidden="true"></span>
      思考中
    </span>
    <div ref="body" class="thinking-body">{{ props.text }}</div>
  </div>
</template>

<style scoped>
/* 推理模型的思考过程：白色磨砂 + 虚线边，和正式的白色气泡区分开 */
.thinking {
  align-self: flex-start;
  max-width: min(78%, 72ch);
  padding: 0.6rem 0.9rem;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.thinking-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}

.thinking-body {
  max-height: 150px;
  margin-top: 0.25rem;
  overflow-y: auto;
  color: var(--ink-dim);
  font-size: 0.78rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
