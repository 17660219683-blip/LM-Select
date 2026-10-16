<script setup>
/**
 * 对比结果弹窗。
 *
 * 占视口约 90%，每个模型一列：上面是输出正文，下面是首字延迟 / 总耗时等指标。
 * 列数与所选模型数一致（2 ~ 4 列）。
 *
 * 关闭弹窗**不会停止**正在跑的请求 —— 结果仍在 store 里，
 * 页面上可以随时重新打开。想中断要点弹窗里的「停止」。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'

import RunColumn from '@/components/compare/RunColumn.vue'
import { useCompareStore } from '@/stores/compare'

const emit = defineEmits(['close'])

const compare = useCompareStore()

/** 题目预览：附件也算题目的一部分，这里只提示有无 */
const promptPreview = computed(() => {
  const text = compare.prompt.trim().replace(/\s+/g, ' ')
  const files = compare.attachments.length
  const suffix = files ? `（另有 ${files} 个附件）` : ''

  if (!text) return files ? `仅附件${suffix}` : '（无题目）'
  return `${text.length > 90 ? `${text.slice(0, 90)}…` : text}${suffix}`
})

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // 弹窗打开期间锁住页面滚动，否则背景会跟着滚
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

/** 导出成 JSON：正文 + 完整指标，便于存档或后续写进数据库 */
function exportJson() {
  const payload = {
    prompt: compare.prompt,
    attachmentCount: compare.attachments.length,
    exportedAt: new Date().toISOString(),
    results: compare.columns.map((c) => ({
      model: c.model.displayName,
      apiModelId: c.model.apiModelId,
      vendor: c.model.vendor.code,
      status: c.status,
      text: c.text,
      reasoning: c.reasoning || null,
      error: c.error || null,
      metrics: {
        ttftMs: c.ttftMs,
        firstTokenMs: c.firstTokenMs,
        wallMs: c.wallMs,
        promptTokens: c.promptTokens,
        outputTokens: c.outputTokens,
        tokensPerSec: c.tokensPerSec,
        chars: c.text.length,

        /** length 表示被长度上限截断，此时耗时与成本偏低，不可直接比较 */
        finishReason: c.finishReason,
        /** 本次调用成本（USD），按模型库标准档单价估算 */
        costUsd: c.costUsd,
        /** 单价快照，便于日后价格变动时回溯当时用的价 */
        unitPriceUsd: {
          input: c.model.price?.inputUsd ?? null,
          output: c.model.price?.outputUsd ?? null,
        },
        contextWindow: c.model.contextWindow ?? null,
      },
    })),
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

  const a = document.createElement('a')
  a.href = url
  a.download = `compare-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function copyAll() {
  const text = compare.columns
    .map((c) => `### ${c.model.displayName}\n${c.text || '(无输出)'}`)
    .join('\n\n---\n\n')

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 剪贴板不可用（非安全上下文等），静默失败 */
  }
}
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal-head">
        <div class="head-main">
          <h2 class="title">
            对比结果
            <span class="count">{{ compare.columns.length }} 个模型</span>
          </h2>
          <p class="prompt" :title="compare.prompt">{{ promptPreview }}</p>
        </div>

        <div class="head-actions">
          <button
            v-if="compare.isRunning"
            type="button"
            class="btn danger"
            @click="compare.stop()"
          >
            停止
          </button>
          <button v-else type="button" class="btn primary" @click="compare.start()">
            重新运行
          </button>

          <button
            type="button"
            class="btn ghost"
            :disabled="!compare.hasResult"
            @click="copyAll()"
          >
            复制全部
          </button>
          <button
            type="button"
            class="btn ghost"
            :disabled="!compare.hasResult"
            @click="exportJson()"
          >
            导出 JSON
          </button>

          <button type="button" class="close" title="关闭（Esc）" @click="emit('close')">
            ✕
          </button>
        </div>
      </header>

      <div
        v-if="compare.columns.length"
        class="grid"
        :style="{ '--cols': compare.columns.length }"
      >
        <RunColumn
          v-for="col in compare.columns"
          :key="col.modelId"
          :run="col"
          :fastest-tps="compare.fastestTps"
        />
      </div>

      <p v-else class="empty">还没有结果</p>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 2vh 2vw;
  background: rgba(27, 20, 37, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/*
  占视口约 90%。
  min-height: 0 不能省 —— 里面是可滚动的列，没有它弹性子项会被内容撑破，
  列内部的滚动区就失效了。
*/
.modal {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 90vw;
  max-width: 1900px;
  height: 90vh;
  max-height: 1200px;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius);
  background: #fff;
  box-shadow: 0 24px 70px rgba(5, 1, 10, 0.42);
}

/* ---- 头部 ---- */
.modal-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.9rem 1.2rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.09);
}

.head-main {
  min-width: 0;
}

.title {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}

.count {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
}

.prompt {
  overflow: hidden;
  margin: 0.2rem 0 0;
  color: var(--ink-dim);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.45rem;
}

.btn {
  padding: 0.42rem 1rem;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
}

.btn.primary {
  background: var(--accent);
  color: #fff;
}

.btn.primary:hover {
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

.close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: 0.3rem;
  border: none;
  border-radius: 9px;
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink-dim);
  cursor: pointer;
  font-size: 0.9rem;
}

.close:hover {
  background: rgba(27, 20, 37, 0.1);
  color: var(--ink);
}

/* ---- 列 ---- */
.grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
  gap: 0.8rem;
  min-height: 0;
  padding: 0.9rem 1.2rem 1.2rem;
  overflow: hidden;
}

.empty {
  margin: 3rem 0;
  color: var(--ink-dim);
  font-size: 0.88rem;
  text-align: center;
}

/* 列太多时先保证每列可读，再考虑并排 */
@media (max-width: 1100px) {
  .grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    overflow-y: auto;
  }
}

@media (max-width: 720px) {
  .modal {
    width: 96vw;
    height: 94vh;
  }

  .modal-head {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }
}
</style>
