<script setup>
import { computed, nextTick, ref } from 'vue'

import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const draft = ref('')
const input = ref(null)

const MAX_HEIGHT = 180

const canSend = computed(() => draft.value.trim().length > 0 && !chat.isStreaming)

/** 输入框随内容长高，到上限后在框内滚动 */
async function autoGrow() {
  await nextTick()
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
}

async function send() {
  if (!canSend.value) return
  const text = draft.value
  draft.value = ''
  autoGrow()
  await chat.sendMessage(text)
}

function onKeydown(event) {
  // Enter 发送，Shift+Enter 换行；输入法组词过程中的 Enter 不拦截
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  send()
}
</script>

<template>
  <!-- 去掉外层磨砂面板，只留一个白色实心输入条 -->
  <div class="composer">
    <textarea
      ref="input"
      v-model="draft"
      class="composer-input"
      rows="1"
      placeholder="说点什么…（Enter 发送，Shift+Enter 换行）"
      @input="autoGrow"
      @keydown="onKeydown"
    ></textarea>

    <button
      v-if="chat.isStreaming"
      type="button"
      class="composer-button stop"
      @click="chat.stopStreaming()"
    >
      停止
    </button>
    <button v-else type="button" class="composer-button" :disabled="!canSend" @click="send">
      发送
    </button>
  </div>
</template>

<style scoped>
.composer {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  margin-top: 0.7rem;
  padding: 0.45rem 0.45rem 0.45rem 1rem;
  border-radius: 22px;
  background: #fff;
  box-shadow: var(--shadow);
}

.composer-input {
  flex: 1;
  min-width: 0;
  /*
    必须用 border-box：自动增高是 height = scrollHeight，而 scrollHeight 含上下内边距。
    默认的 content-box 会让每次输入都多出 16px，框会越敲越高。
  */
  box-sizing: border-box;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 0.92rem;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
}

.composer-input:focus {
  outline: none;
}

.composer-input::placeholder {
  color: var(--ink-dim);
}

.composer-button {
  flex-shrink: 0;
  padding: 0.5rem 1.15rem;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  transition:
    background 0.18s var(--ease),
    opacity 0.18s var(--ease);
}

.composer-button:hover:not(:disabled) {
  background: #7a2fc4;
}

.composer-button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.composer-button.stop {
  background: var(--danger);
}

.composer-button.stop:hover {
  background: #bf2d47;
}

.composer-button:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
}
</style>
