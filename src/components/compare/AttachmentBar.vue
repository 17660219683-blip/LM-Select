<script setup>
/**
 * 题目的附件区：添加按钮 + 已挂附件列表。
 *
 * 拖拽放置由外层「题目」面板统一处理（见 CompareView），
 * 这样把文件拖到文本框上也能生效，不必精确瞄准这个小区域。
 */
import { computed, ref } from 'vue'

import { useCompareStore } from '@/stores/compare'
import { formatSize, MAX_ATTACHMENTS, MAX_FILE_SIZE } from '@/utils/attachments'

const compare = useCompareStore()

const fileInput = ref(null)
const imageInput = ref(null)

const full = computed(() => !compare.canAddAttachment)

/** 每个附件右侧的状态说明 */
function describe(a) {
  if (a.status === 'parsing') return `${formatSize(a.size)} · 解析中…`
  // 解析失败时 error 里是服务端给的、面向用户的原因
  if (a.status === 'error') return a.error
  if (a.kind === 'image') return `${formatSize(a.size)} · 图片`
  return `${formatSize(a.size)} · ${a.note || '已读取'}`
}

/*
  弹出系统文件选择框。

  ⚠️ 必须传 ref 对象本身，不能把模板里的 ref 当参数传：
  模板中的 ref 会被 Vue 自动解包成 DOM 元素，
  于是 onclick 里拿到的是元素而不是 { value } 包装，
  input.value 会变成元素自己的 value（字符串），再 .value/.click() 就抛异常，
  结果就是"点了没反应"。所以这里用两个无参函数，闭包直接引用 ref。
*/
function trigger(inputRef) {
  if (full.value) return

  const el = inputRef.value
  if (!el) return

  // 清掉上次的选择，否则连续选同一个文件不会再触发 change
  el.value = ''
  el.click()
}

function pickFile() {
  trigger(fileInput)
}

function pickImage() {
  trigger(imageInput)
}

function onPicked(event) {
  compare.addAttachments(event.target.files)
  event.target.value = ''
}
</script>

<template>
  <div class="attach">
    <div class="bar">
      <button
        type="button"
        class="add"
        :disabled="full"
        @click="pickFile"
      >
        <span class="ico" aria-hidden="true">📎</span>
        添加文件
      </button>

      <button
        type="button"
        class="add"
        :disabled="full"
        @click="pickImage"
      >
        <span class="ico" aria-hidden="true">🖼</span>
        添加图片
      </button>

      <span class="tip">
        支持 PDF / Word / 文本类文件 / 图片 · 也可以直接拖进上面的输入框 · 最多
        {{ MAX_ATTACHMENTS }} 个，单个不超过 {{ formatSize(MAX_FILE_SIZE) }}
      </span>
    </div>

    <p v-if="compare.attachmentError" class="err">{{ compare.attachmentError }}</p>

    <ul v-if="compare.attachments.length" class="list">
      <li v-for="a in compare.attachments" :key="a.id" class="item" :class="a.status">
        <img
          v-if="a.kind === 'image'"
          class="thumb"
          :src="a.previewUrl"
          :alt="a.name"
          :title="a.name"
        />
        <span v-else class="doc" aria-hidden="true">📄</span>

        <span class="meta">
          <span class="name" :title="a.name">{{ a.name }}</span>
          <span class="sub">{{ describe(a) }}</span>
        </span>

        <button
          type="button"
          class="remove"
          :title="`移除 ${a.name}`"
          @click="compare.removeAttachment(a.id)"
        >
          ✕
        </button>
      </li>
    </ul>

    <!--
      两个隐藏的文件选择器。
      图片那个带 accept，能把系统选择框预过滤成图片。
      用 sr-only 而不是 hidden：部分浏览器拒绝对 display:none 的元素
      弹出文件选择框（点了没反应），"渲染但不可见"最稳。
    -->
    <input ref="fileInput" class="sr-only" type="file" multiple @change="onPicked" />
    <input
      ref="imageInput"
      class="sr-only"
      type="file"
      accept="image/*"
      multiple
      @change="onPicked"
    />
  </div>
</template>

<style scoped>
/*
  标准的"视觉隐藏"写法：移出视口、压成 1px，但仍在渲染树里，
  因此 .click() 能正常弹出系统文件选择框。
*/
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

.attach {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.add {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.85rem;
  /* 实线边框 + 白底，让它读起来是"按钮"而不是"虚线占位区" */
  border: 1px solid rgba(27, 20, 37, 0.18);
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(5, 1, 10, 0.06);
  transition:
    border-color 0.16s var(--ease),
    color 0.16s var(--ease),
    background 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.add:hover:not(:disabled) {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 2px 8px rgba(139, 63, 214, 0.16);
}

.add:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: none;
}

.add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.add:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ico {
  font-size: 0.82rem;
}

.tip {
  color: var(--ink-dim);
  font-size: 0.74rem;
}

.err {
  margin: 0;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  background: rgba(217, 58, 86, 0.1);
  color: var(--danger);
  font-size: 0.76rem;
}

/* ---- 附件列表 ---- */
.list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 17rem;
  padding: 0.35rem 0.4rem 0.35rem 0.45rem;
  border: 1px solid rgba(27, 20, 37, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
}

/* 解析中：正常过程，只是压暗一点，不要用报错的红色吓人 */
.item.parsing {
  opacity: 0.7;
}

/* 解析失败：用醒目的红色 */
.item.error {
  border-color: rgba(217, 58, 86, 0.4);
  background: rgba(217, 58, 86, 0.07);
}

.thumb {
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  border-radius: 6px;
  object-fit: cover;
  background: rgba(27, 20, 37, 0.06);
}

.doc {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 6px;
  background: rgba(27, 20, 37, 0.06);
  font-size: 1.1rem;
}

.meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.05rem;
}

.name {
  overflow: hidden;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item.error .name {
  color: var(--danger);
}

.sub {
  overflow: hidden;
  color: var(--ink-dim);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.3rem;
  height: 1.3rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font-size: 0.66rem;
}

.remove:hover {
  background: rgba(27, 20, 37, 0.1);
  color: var(--ink);
}
</style>
