<script setup>
/**
 * 对比测试页面。
 *
 * 流程：按厂商筛选 → 勾选 2~4 个模型 → 写题目（可带附件）→ 并发调用 → 弹窗并排看结果。
 * 实际的并发调用与指标对比由后端适配器完成，API key 全程留在服务端。
 *
 * 已备好的部分：
 *   - 后端 /api/compare/*（厂商适配器层，目前接了 DeepSeek）
 *   - 组件 components/compare/CompareResultModal.vue（居中结果弹窗，每模型一列）
 * 接入云厂商时沿用这套，或把调用适配器换掉即可。
 */
import { computed, onMounted, ref } from 'vue'

import AttachmentBar from '@/components/compare/AttachmentBar.vue'
import CompareResultModal from '@/components/compare/CompareResultModal.vue'
import LibraryModelPicker from '@/components/compare/LibraryModelPicker.vue'
import VendorLogo from '@/components/models/VendorLogo.vue'
import { MAX_MODELS, useCompareStore } from '@/stores/compare'

const compare = useCompareStore()

/**
 * 结果弹窗开关。
 * 关掉弹窗只是隐藏，**不会停止**正在跑的请求 —— 结果留在 store 里，
 * 页面上可以随时再打开看。想中断要点弹窗里的「停止」。
 */
const resultOpen = ref(false)

async function startCompare() {
  // 先开弹窗再发请求，用户能立刻看到流式输出出现在哪一列
  resultOpen.value = true
  await compare.start()
}

/*
  跑不了的厂商要分两种原因说 —— 解决方式完全不同：
    没适配器 = 后端进程旧了，重启；没 key = 去 .env 补 key。
  混成一句"未配置 API key"会把用户引偏（踩过）。
*/
const blockedNoAdapter = computed(() =>
  compare.blockedVendors.filter((b) => b.reason === 'no_adapter').map((b) => b.name),
)

const blockedNoKey = computed(() =>
  compare.blockedVendors.filter((b) => b.reason === 'no_key').map((b) => b.name),
)

/*
  附件读不出内容的名字。
  这种附件必须让用户先处理：放着不管的话请求里就没有它的内容，
  模型会说"没收到文档"，而用户完全看不出是附件的问题（踩过）。
*/
const brokenNames = computed(() => compare.brokenAttachments.map((a) => a.name))

/*
  拖拽放置。
  dragenter/dragleave 会在子元素之间反复触发，直接切换布尔值会闪，
  所以用计数器记录"拖进了几层"，减到 0 才算真正离开。
*/
const dragging = ref(false)
let dragDepth = 0

function onDragEnter() {
  dragDepth += 1
  dragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event) {
  dragDepth = 0
  dragging.value = false
  compare.addAttachments(event.dataTransfer?.files)
}

onMounted(() => {
  // 进页面就拉厂商、模型、以及哪些厂商已配好 key
  compare.loadVendors()
  compare.loadModels()
  compare.loadProviders()
})
</script>

<template>
  <div class="compare-page">
    <header class="page-head">
      <h1 class="title">对比测试</h1>
      <p class="sub">
        从模型库中挑 2 ~ 4 个模型，用同一道题横向比较。
        先按厂商筛选缩小范围，选择会跨厂商累积。
      </p>
    </header>

    <!--
      读不到后端配置时的提示。
      必须和"某个厂商没配 key"分开讲 —— 否则会把用户引去检查 key，
      而真正的原因往往是后端还是旧进程。
    -->
    <div v-if="compare.needsBackendRestart" class="warn-bar">
      <strong>读不到后端配置，无法判断哪些模型可用</strong>
      <span>
        {{ compare.providersError }}
        最常见的原因是后端仍是改动前的进程（没有 /api/compare/* 路由）——
        请把跑着 <code>npm run server</code> 或 <code>npm run dev:all</code>
        的终端 Ctrl+C 停掉，重新启动一次。
      </span>
    </div>

    <!-- 选模型 -->
    <section class="panel">
      <LibraryModelPicker />
    </section>

    <!-- 已选 -->
    <section class="panel">
      <div class="selected-head">
        <span class="panel-label">已选模型</span>
        <button
          v-if="compare.selected.length"
          type="button"
          class="link-btn"
          @click="compare.clearSelected()"
        >
          全部清空
        </button>
      </div>

      <p v-if="!compare.selected.length" class="hint">
        还没有选择模型。至少选 2 个才能发起对比（最多 {{ MAX_MODELS }} 个）。
      </p>

      <div v-else class="selected-groups">
        <div v-for="g in compare.selectedByVendor" :key="g.vendor" class="group">
          <span class="group-label">{{ g.vendor }}</span>
          <div class="group-items">
            <span v-for="m in g.models" :key="m.id" class="pill">
              <VendorLogo :code="m.vendor.code" :size="15" />
              <span class="pill-text">{{ m.displayName }}</span>
              <button
                type="button"
                class="pill-x"
                :title="`移除 ${m.displayName}`"
                @click="compare.removeModel(m.id)"
              >
                ✕
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 题目（整块都是拖拽放置区，不必瞄准某个小区域） -->
    <section
      class="panel"
      :class="{ dragging }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <span class="panel-label">测试题目</span>

      <textarea
        :value="compare.prompt"
        class="prompt"
        rows="4"
        placeholder="写一道所有模型都要回答的问题，例如：用一句话解释什么是递归（也可以只传附件）"
        @input="compare.setPrompt($event.target.value)"
      ></textarea>

      <AttachmentBar />

      <p v-if="dragging" class="drop-tip">松手即可添加为附件</p>

      <div class="actions">
        <button
          v-if="compare.isRunning"
          type="button"
          class="btn danger"
          @click="compare.stop()"
        >
          停止
        </button>
        <button
          v-else
          type="button"
          class="btn primary"
          :disabled="!compare.canCompare"
          @click="startCompare()"
        >
          开始对比
        </button>

        <!-- 弹窗关掉后结果还在，用这个重新打开 -->
        <button
          v-if="compare.hasResult && !resultOpen"
          type="button"
          class="btn ghost"
          @click="resultOpen = true"
        >
          查看结果
        </button>

        <button
          type="button"
          class="btn ghost"
          :disabled="!compare.hasResult || compare.isRunning"
          @click="compare.clearRuns()"
        >
          清空结果
        </button>

        <!--
          提示按"离用户最近的问题"排：附件是刚操作过的，先说；
          厂商配置是环境问题，放后面。
        -->
        <span v-if="compare.isParsingAttachments" class="note">附件解析中，稍等…</span>
        <span v-else-if="brokenNames.length" class="note warn">
          {{ brokenNames.join('、') }} 读不出内容，先移除它再开始。
        </span>
        <span v-else-if="blockedNoAdapter.length" class="note warn">
          {{ blockedNoAdapter.join('、') }} 的调用适配器后端没加载 ——
          后端多半还是改动前的进程，重启一次即可。
        </span>
        <span v-else-if="blockedNoKey.length" class="note warn">
          {{ blockedNoKey.join('、') }} 还没配置 API key，这些模型调不通。
        </span>
        <span v-else-if="compare.selected.length < 2" class="note">至少选 2 个模型</span>
        <span v-else-if="!compare.hasInput" class="note">写点题目，或传个附件</span>
      </div>
    </section>

    <!-- 错误 -->
    <div v-if="compare.error" class="error-bar">
      <span>{{ compare.error }}</span>
    </div>

    <p v-if="!compare.hasResult" class="empty">
      选好模型、写好题目，点「开始对比」。结果会在页面中央的弹窗里并排展示。
    </p>

    <!-- 结果弹窗：每个模型一列，输出在上、指标在下 -->
    <CompareResultModal v-if="resultOpen" @close="resultOpen = false" />
  </div>
</template>

<style scoped>
.compare-page {
  box-sizing: border-box;
  min-height: calc(100vh - var(--nav-h));
  min-height: calc(100dvh - var(--nav-h));
  padding: 1.5rem clamp(1rem, 3vw, 2.5rem) 3rem;
}

.page-head {
  margin-bottom: 1rem;
}

.title {
  margin: 0;
  color: var(--text);
  font-size: 1.5rem;
  font-weight: 650;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}

.sub {
  margin: 0.3rem 0 0;
  max-width: 62ch;
  color: var(--text-dim);
  font-size: 0.86rem;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
  padding: 0.9rem 1.1rem;
  border-radius: var(--radius);
  background: #fff;
  box-shadow: var(--shadow);
}

.panel-label {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

/* 拖拽悬停：整块面板高亮 + 虚线边，明确告诉用户"松手就放这儿" */
.panel.dragging {
  outline: 2px dashed var(--accent);
  outline-offset: -4px;
  background: #faf7ff;
}

.drop-tip {
  margin: 0;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: center;
}

/* ---- 已选 ---- */
.selected-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.link-btn:hover {
  text-decoration: underline;
}

.hint {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
}

.selected-groups {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.group-label {
  flex-shrink: 0;
  padding-top: 0.18rem;
  color: var(--ink-dim);
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}

.group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.3rem 0.2rem 0.5rem;
  border: 1px solid var(--accent-ring);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.8rem;
}

.pill-text {
  font-weight: 600;
  white-space: nowrap;
}

.pill-x {
  display: grid;
  place-items: center;
  width: 1.15rem;
  height: 1.15rem;
  border: none;
  border-radius: 50%;
  background: rgba(139, 63, 214, 0.16);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.62rem;
  line-height: 1;
}

.pill-x:hover {
  background: var(--accent);
  color: #fff;
}

/* ---- 题目 ---- */
.prompt {
  box-sizing: border-box;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.7;
  resize: vertical;
}

.prompt:focus {
  border-color: var(--accent);
  outline: none;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.2rem;
}

.btn {
  padding: 0.5rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn.primary {
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover:not(:disabled) {
  background: #7a2fc4;
}

.btn.danger {
  background: var(--danger);
  color: #fff;
}

.btn.danger:hover {
  background: #bf2d47;
}

.btn.ghost {
  border-color: rgba(27, 20, 37, 0.14);
  background: transparent;
  color: var(--ink-dim);
  font-weight: 400;
}

.btn.ghost:hover:not(:disabled) {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.note {
  max-width: 46ch;
  color: var(--ink-dim);
  font-size: 0.78rem;
  line-height: 1.6;
}

.note.warn {
  color: var(--danger);
}

/* ---- 提示 ---- */
.error-bar {
  margin-bottom: 0.9rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid rgba(255, 107, 129, 0.45);
  border-radius: var(--radius-sm);
  background: rgba(217, 58, 86, 0.2);
  color: #8a1c30;
  font-size: 0.82rem;
}

.warn-bar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.9rem;
  padding: 0.7rem 0.95rem;
  border: 1px solid rgba(196, 158, 42, 0.45);
  border-radius: var(--radius-sm);
  background: rgba(214, 176, 60, 0.18);
  color: #6f5a10;
  font-size: 0.82rem;
  line-height: 1.7;
}

.warn-bar strong {
  font-size: 0.85rem;
}

.warn-bar code {
  padding: 0.05rem 0.3rem;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.78rem;
}

/* ---- 空态 ---- */
.empty {
  margin: 2.5rem 0;
  color: var(--text-dim);
  font-size: 0.88rem;
  text-align: center;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}
</style>
