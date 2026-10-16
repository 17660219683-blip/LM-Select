<script setup>
/**
 * 模型库页面。
 *
 * 数据链路：ModelLibraryView -> /api/models -> MySQL 模型知识库。
 * 页面本身不缓存模型数据，改筛选条件就重新请求 —— 46 条的量级完全承受得起，
 * 也避免了本地一份、数据库一份两边不同步。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'

import ModelDetailModal from '@/components/models/ModelDetailModal.vue'
import ModelFilterBar from '@/components/models/ModelFilterBar.vue'
import VendorLogo from '@/components/models/VendorLogo.vue'
import { fetchModelDetail, fetchModelFilters, fetchModels } from '@/services/modelLibraryApi'
import {
  fmtContext,
  fmtNative,
  fmtUsd,
  isForeignCurrency,
  statusLabel,
  typeLabel,
} from '@/utils/modelFormat'

/** 默认只显示在售模型：已下线的混在比价榜里会误导选型 */
function defaultFilters() {
  return {
    q: '',
    vendor: '',
    status: 'ga',
    type: [],
    vision: '',
    selfHost: '',
    commercial: '',
    minContext: '',
    maxOutputUsd: '',
    sort: 'output_usd',
    order: 'asc',
  }
}

const filters = reactive(defaultFilters())
const options = ref({ vendors: [], types: [], statuses: [] })

const models = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const selectedId = ref(null)
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')

/**
 * 只监听「非搜索」的筛选条件。
 * 搜索框每敲一个字就请求一次太浪费，单独走 260ms 防抖；
 * 其余条件（下拉、开关、chip）变化要立刻生效。
 */
const nonSearchKey = computed(() => JSON.stringify({ ...filters, q: '' }))
let searchTimer = null

async function loadModels() {
  loading.value = true
  error.value = ''

  try {
    const data = await fetchModels({ ...filters })
    models.value = data.items
    total.value = data.total
  } catch (err) {
    error.value = err.message
    models.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(nonSearchKey, loadModels)

watch(
  () => filters.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(loadModels, 260)
  },
)

function applyFilters(next) {
  Object.assign(filters, next)
}

function resetFilters() {
  Object.assign(filters, defaultFilters())
}

async function openDetail(model) {
  selectedId.value = model.id
  detail.value = null
  detailError.value = ''
  detailLoading.value = true

  try {
    detail.value = await fetchModelDetail(model.id)
  } catch (err) {
    detailError.value = err.message
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  selectedId.value = null
  detail.value = null
  detailError.value = ''
}

onMounted(() => {
  loadModels()
  // 筛选项加载失败不影响列表展示，静默处理
  fetchModelFilters()
    .then((data) => {
      options.value = data
    })
    .catch(() => {})
})
</script>

<template>
  <div class="models-page">
    <header class="page-head">
      <h1 class="title">模型库</h1>
      <p class="sub">
        各厂商模型版本汇总。价格统一折算成美元便于横向比较，副行是厂商原币种计价。
      </p>
    </header>

    <ModelFilterBar
      :filters="filters"
      :options="options"
      :total="total"
      :loading="loading"
      @update:filters="applyFilters"
      @reset="resetFilters"
    />

    <div v-if="error" class="error-bar">
      <span>{{ error }}</span>
      <button type="button" class="retry" @click="loadModels">重试</button>
    </div>

    <!-- 表头：让下面每一列的含义一眼可读 -->
    <div v-if="models.length" class="head-row">
      <span>厂商</span>
      <span>模型</span>
      <span>类型</span>
      <span class="r">上下文</span>
      <span class="r">输入 / 百万</span>
      <span class="r">输出 / 百万</span>
      <span></span>
    </div>

    <div class="list">
      <button
        v-for="m in models"
        :key="m.id"
        type="button"
        class="row"
        @click="openDetail(m)"
      >
        <span class="c-vendor">
          <VendorLogo :code="m.vendor.code" :size="22" />
          <span class="vendor-name">{{ m.vendor.nameZh || m.vendor.name }}</span>
          <span v-if="m.vendor.cnDirect" class="dot" title="国内可直连"></span>
        </span>

        <span class="c-name">
          <span class="n">{{ m.displayName }}</span>
          <code class="id">{{ m.apiModelId }}</code>
        </span>

        <span class="c-type">
          {{ typeLabel(m.modelType) }}
          <span v-if="m.status !== 'ga'" class="st">{{ statusLabel(m.status) }}</span>
        </span>

        <span class="c-ctx r">{{ fmtContext(m.contextWindow) }}</span>

        <span class="c-price r">
          {{ fmtUsd(m.price.inputUsd) }}
          <span v-if="isForeignCurrency(m.price.currency)" class="native">
            {{ fmtNative(m.price.input, m.price.currency) }}
          </span>
        </span>

        <span class="c-price r strong">
          {{ fmtUsd(m.price.outputUsd) }}
          <span v-if="isForeignCurrency(m.price.currency)" class="native">
            {{ fmtNative(m.price.output, m.price.currency) }}
          </span>
        </span>

        <span class="badges">
          <span v-if="m.supportsVision" class="badge">视觉</span>
          <span v-if="m.supportsSelfHost" class="badge self">可自部署</span>
          <span v-if="m.license?.allowsCommercial === false" class="badge warn">禁商用</span>
        </span>
      </button>
    </div>

    <p v-if="!loading && !models.length && !error" class="empty">
      没有符合当前筛选条件的模型
    </p>

    <ModelDetailModal
      v-if="selectedId"
      :model="detail"
      :loading="detailLoading"
      :error="detailError"
      @close="closeDetail"
    />
  </div>
</template>

<style scoped>
.models-page {
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
  max-width: 56ch;
  color: var(--text-dim);
  font-size: 0.86rem;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}

.error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.8rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid rgba(255, 107, 129, 0.45);
  border-radius: var(--radius-sm);
  background: rgba(217, 58, 86, 0.24);
  color: #8a1c30;
  font-size: 0.84rem;
}

.retry {
  flex-shrink: 0;
  padding: 0.25rem 0.8rem;
  border: 1px solid rgba(217, 58, 86, 0.5);
  border-radius: 8px;
  background: rgba(217, 58, 86, 0.14);
  color: #8a1c30;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
}

/* ---- 表格 ---- */
.head-row,
.row {
  display: grid;
  grid-template-columns:
    minmax(120px, 0.95fr)
    minmax(180px, 2.2fr)
    minmax(72px, 0.7fr)
    minmax(72px, 0.6fr)
    minmax(96px, 0.8fr)
    minmax(96px, 0.8fr)
    minmax(96px, 0.9fr);
  align-items: center;
  gap: 0.6rem;
}

.head-row {
  margin-top: 0.9rem;
  padding: 0 1rem 0.45rem;
  color: var(--text-dim);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 0.62rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
  box-shadow: 0 2px 10px rgba(5, 1, 10, 0.08);
  transition:
    border-color 0.16s var(--ease),
    transform 0.16s var(--ease),
    box-shadow 0.16s var(--ease);
}

.row:hover {
  border-color: var(--accent-ring);
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}

.row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.c-vendor {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
  color: var(--ink-dim);
  font-size: 0.8rem;
}

/* 截断放在文字本身，而不是容器 —— 否则 logo 会跟着一起被省略号吃掉 */
.vendor-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34a853;
}

.c-name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.1rem;
}

.n {
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id {
  overflow: hidden;
  color: var(--ink-dim);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-type {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  color: var(--ink-dim);
  font-size: 0.78rem;
}

.st {
  color: var(--danger);
  font-size: 0.7rem;
}

.r {
  text-align: right;
}

.c-ctx {
  color: var(--ink-dim);
  font-size: 0.82rem;
  white-space: nowrap;
}

.c-price {
  font-size: 0.82rem;
  white-space: nowrap;
}

.c-price.strong {
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 650;
}

.native {
  display: block;
  color: var(--ink-dim);
  font-size: 0.68rem;
  font-weight: 400;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.25rem;
}

.badge {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.68rem;
  white-space: nowrap;
}

.badge.self {
  background: rgba(34, 160, 90, 0.12);
  color: #1c7a45;
}

.badge.warn {
  background: rgba(217, 58, 86, 0.12);
  color: var(--danger);
}

.empty {
  margin: 2rem 0;
  color: var(--text-dim);
  font-size: 0.86rem;
  text-align: center;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.9);
}

@media (max-width: 900px) {
  /* 窄屏收起次要列：厂商、类型、徽标 */
  .head-row,
  .row {
    grid-template-columns: minmax(0, 2fr) minmax(64px, 0.7fr) minmax(92px, 1fr) minmax(92px, 1fr);
  }

  .head-row span:nth-child(1),
  .head-row span:nth-child(3),
  .head-row span:nth-child(7),
  .c-vendor,
  .c-type,
  .badges {
    display: none;
  }
}
</style>
