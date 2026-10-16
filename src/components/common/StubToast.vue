<script setup>
/**
 * 复刻件里点击"未实现"元素时的提示条。
 *
 * 挂在 AgentModal 上（不在复刻件内部）：复刻件自己有 overflow: hidden，
 * 挂里面会被裁掉；而且三个复刻件共用一条，不必各写一份。
 */
import { stubToastVisible, STUB_TOAST_TEXT } from '@/composables/stubToast'
</script>

<template>
  <Transition name="stub-toast">
    <div v-if="stubToastVisible" class="stub-toast" role="status">
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.3" />
        <path d="M8 4.9v3.6M8 11h.01" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
      {{ STUB_TOAST_TEXT }}
    </div>
  </Transition>
</template>

<style scoped>
.stub-toast {
  position: fixed;
  bottom: 44px;
  left: 50%;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(24, 24, 28, 0.92);
  box-shadow: 0 10px 30px rgba(5, 1, 10, 0.35);
  color: #fff;
  font-size: 0.78rem;
  line-height: 1.4;
  pointer-events: none;
  transform: translateX(-50%);
}

.stub-toast-enter-active,
.stub-toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.stub-toast-enter-from,
.stub-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
