<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  /** { id, title, preview, messageCount } */
  session: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'rename', 'remove'])

const editing = ref(false)
const draft = ref('')
const input = ref(null)

async function startRename() {
  draft.value = props.session.title || ''
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

/** 提交：只有真的改了才通知父级，避免无意义的请求 */
function commit() {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.trim()
  if (next !== (props.session.title || '')) emit('rename', next)
}

function cancel() {
  editing.value = false
}
</script>

<template>
  <li class="session" :class="{ active }">
    <!-- 重命名时整行变成输入框 -->
    <input
      v-if="editing"
      ref="input"
      v-model="draft"
      class="rename-input"
      type="text"
      maxlength="40"
      placeholder="会话名称"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="cancel"
      @blur="commit"
    />

    <template v-else>
      <button type="button" class="session-open" :title="session.id" @click="$emit('select')">
        <span class="session-title">{{ session.title || session.id }}</span>
        <span v-if="session.preview" class="session-preview">{{ session.preview }}</span>
        <span v-else class="session-preview empty">（空会话）</span>
      </button>

      <div class="session-actions">
        <button type="button" class="action" title="重命名" @click="startRename">✎</button>
        <button type="button" class="action danger" title="删除会话" @click="$emit('remove')">
          ✕
        </button>
      </div>
    </template>
  </li>
</template>

<style scoped>
.session {
  display: flex;
  align-items: stretch;
  gap: 0.1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition:
    background 0.16s var(--ease),
    border-color 0.16s var(--ease);
}

.session:hover {
  background: rgba(27, 20, 37, 0.05);
}

.session.active {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
}

.session-open {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  padding: 0.45rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.session-title {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session.active .session-title {
  color: var(--accent);
}

.session-preview {
  overflow: hidden;
  color: var(--ink-dim);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-preview.empty {
  opacity: 0.6;
}

.session-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.05rem;
  padding-right: 0.2rem;
}

.action {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font-size: 0.72rem;
  opacity: 0;
  transition:
    opacity 0.16s var(--ease),
    color 0.16s var(--ease),
    background 0.16s var(--ease);
}

.session:hover .action,
.session.active .action {
  opacity: 0.6;
}

.action:hover {
  background: rgba(27, 20, 37, 0.08);
  opacity: 1;
}

.action.danger:hover {
  color: var(--danger);
}

@media (hover: none) {
  /* 触屏没有 hover，操作按钮常驻显示 */
  .action {
    opacity: 0.5;
  }
}

.rename-input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 0.78rem;
}

.rename-input:focus {
  outline: none;
}
</style>
