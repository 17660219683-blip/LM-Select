<script setup>
/**
 * 从模型库里挑模型。
 *
 * 用厂商筛选来缩小范围，再逐个勾选。
 * 已选是跨厂商累积的 —— 切到别家不清空，因为最常见的用法就是
 * 拿 OpenAI 和 Anthropic 的模型对着比。
 */
import VendorLogo from '@/components/models/VendorLogo.vue'
import { MAX_MODELS, useCompareStore } from '@/stores/compare'
import { fmtContext, fmtUsd } from '@/utils/modelFormat'

const compare = useCompareStore()
</script>

<template>
  <section class="picker">
    <!-- 厂商单选 -->
    <div class="row">
      <span class="row-label">厂商</span>

      <p v-if="compare.isLoadingVendors" class="hint">加载中…</p>

      <template v-else>
        <button
          type="button"
          class="chip"
          :class="{ on: !compare.vendor }"
          @click="compare.selectVendor('')"
        >
          <span class="chip-text">全部</span>
        </button>

        <button
          v-for="v in compare.vendors"
          :key="v.code"
          type="button"
          class="chip"
          :class="{ on: compare.vendor === v.code }"
          @click="compare.selectVendor(v.code)"
        >
          <VendorLogo :code="v.code" :size="16" />
          <span class="chip-text">{{ v.nameZh || v.name }}</span>
          <span class="chip-n">{{ v.count }}</span>
        </button>
      </template>
    </div>

    <!-- 模型列表 -->
    <div class="list-head">
      <span class="list-title">
        {{ compare.vendor ? '该厂商的模型' : '全部在售模型' }}
        <span class="list-n">{{ compare.models.length }}</span>
      </span>
      <span class="slots">
        已选 {{ compare.selected.length }} / {{ MAX_MODELS }}
      </span>
    </div>

    <p v-if="compare.isLoadingModels" class="hint">正在读取模型…</p>
    <p v-else-if="!compare.models.length" class="hint">没有匹配的模型</p>

    <ul v-else class="models">
      <li v-for="m in compare.models" :key="m.id">
        <button
          type="button"
          class="model"
          :class="{ on: compare.selectedIds.has(m.id) }"
          :disabled="!compare.selectedIds.has(m.id) && !compare.canSelectMore"
          @click="compare.toggleModel(m)"
        >
          <span class="tick" aria-hidden="true">
            {{ compare.selectedIds.has(m.id) ? '✓' : '' }}
          </span>

          <VendorLogo :code="m.vendor.code" :size="18" />

          <span class="name">
            <span class="n">{{ m.displayName }}</span>
            <code class="id">{{ m.apiModelId }}</code>
          </span>

          <span class="badges">
            <span v-if="m.supportsVision" class="badge">视觉</span>
            <span v-if="m.supportsSelfHost" class="badge self">自部署</span>
          </span>

          <span class="ctx">{{ fmtContext(m.contextWindow) }}</span>
          <span class="price">{{ fmtUsd(m.price.outputUsd) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.row-label {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.24rem 0.65rem;
  border: 1px solid rgba(27, 20, 37, 0.14);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  transition:
    background 0.16s var(--ease),
    color 0.16s var(--ease),
    border-color 0.16s var(--ease);
}

.chip:hover {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink);
}

.chip.on {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.chip-text {
  white-space: nowrap;
}

.chip-n {
  opacity: 0.6;
  font-size: 0.72rem;
}

/* ---- 列表 ---- */
.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 0.3rem;
  border-top: 1px solid rgba(27, 20, 37, 0.08);
}

.list-title {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.list-n {
  margin-left: 0.2rem;
  opacity: 0.6;
  font-weight: 400;
}

.slots {
  color: var(--ink-dim);
  font-size: 0.76rem;
}

.models {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 19rem;
  margin: 0;
  padding: 0 0.15rem 0 0;
  overflow-y: auto;
  list-style: none;
}

.models::-webkit-scrollbar {
  width: 6px;
}

.models::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(27, 20, 37, 0.16);
}

.model {
  display: grid;
  grid-template-columns: 1.1rem 1.15rem minmax(0, 2.4fr) minmax(0, 1fr) 4.2rem 4.6rem;
  align-items: center;
  gap: 0.55rem;
  box-sizing: border-box;
  width: 100%;
  padding: 0.42rem 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.025);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    background 0.14s var(--ease),
    border-color 0.14s var(--ease);
}

.model:hover:not(:disabled) {
  background: rgba(27, 20, 37, 0.055);
}

.model.on {
  border-color: var(--accent-ring);
  background: var(--accent-soft);
}

.model:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.tick {
  display: grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
  border: 1px solid rgba(27, 20, 37, 0.22);
  border-radius: 5px;
  background: #fff;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.model.on .tick {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.05rem;
}

.n {
  overflow: hidden;
  font-size: 0.84rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id {
  overflow: hidden;
  color: var(--ink-dim);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.badge {
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.66rem;
  white-space: nowrap;
}

.badge.self {
  background: rgba(34, 160, 90, 0.12);
  color: #1c7a45;
}

.ctx,
.price {
  color: var(--ink-dim);
  font-size: 0.78rem;
  text-align: right;
  white-space: nowrap;
}

.price {
  color: var(--accent);
  font-weight: 650;
}

.hint {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
}

@media (max-width: 760px) {
  .model {
    grid-template-columns: 1.1rem 1.15rem minmax(0, 1fr) 4.2rem;
  }

  .badges,
  .ctx {
    display: none;
  }
}
</style>
