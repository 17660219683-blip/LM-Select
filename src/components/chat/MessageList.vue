<script setup>
import { nextTick, ref, watch } from 'vue'

import MessageBubble from '@/components/chat/MessageBubble.vue'
import ThinkingPanel from '@/components/chat/ThinkingPanel.vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const scroller = ref(null)

/** 新消息、流式正文或思考内容更新后，滚到底部 */
async function scrollToBottom() {
  await nextTick()
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => [chat.messages.length, chat.streamingText, chat.streamingReasoning], scrollToBottom)
</script>

<template>
  <!-- 故意不加背景框：让 CRT 背景直接透出来，只有气泡是实心的 -->
  <div ref="scroller" class="message-list">
    <MessageBubble
      v-for="(message, index) in chat.messages"
      :key="index"
      :role="message.role"
      :content="message.content"
    />

    <!-- 思考过程：只在还没开始输出正文时显示 -->
    <ThinkingPanel
      v-if="chat.streamingReasoning && !chat.streamingText"
      :text="chat.streamingReasoning"
    />

    <!-- 流式输出中的临时气泡，收到完整回复后会被替换成正式消息 -->
    <MessageBubble
      v-if="chat.streamingText"
      role="assistant"
      :content="chat.streamingText"
      streaming
    />
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
  padding: 0.35rem 0.4rem 0.35rem 0;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.24) transparent;
  scrollbar-width: thin;
}

.message-list::-webkit-scrollbar {
  width: 8px;
}

.message-list::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
}

.message-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.36);
}
</style>
