<script setup>
/**
 * 模型详情弹窗。
 *
 * 页面中央弹出，宽高各占视口约 80%，内部两栏：左信息、右价格。
 * 价格是全量展示的 —— 缓存 / 批量 / 峰谷 / 各上下文档都列出来，
 * 各厂家收费模式差异很大，折叠掉就没法比较了。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import VendorLogo from '@/components/models/VendorLogo.vue'
import { fetchAgentsByModel } from '@/services/agentApi'
import {
  fmtContext,
  fmtNative,
  fmtUsd,
  isForeignCurrency,
  opennessLabel,
  statusLabel,
  triLabel,
  triTone,
  typeLabel,
} from '@/utils/modelFormat'

const props = defineProps({
  model: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const VARIANT_LABEL = {
  standard: '标准',
  off_peak: '空闲时段',
  batch: '批量',
  flex: 'Flex',
  priority: '优先级',
  fast: 'Fast',
  ultra: 'Ultra',
  short: '短上下文',
  long: '长上下文',
  '5min': '缓存 TTL 5min',
  '1h': '缓存 TTL 1h',
  le_32k: '≤32K',
  gt_32k_le_128k: '32K–128K',
  gt_128k_le_256k: '128K–256K',
  le_256k: '≤256K',
  le_1024k: '≤1M',
  all: '',
}

const UNIT_LABEL = {
  per_1m_tokens: '/ 百万 token',
  per_1m_tokens_hour: '/ 百万 token · 小时',
  per_minute: '/ 分钟',
  per_1k_requests: '/ 千次请求',
  per_image: '/ 张',
}

/** 价格点按科目分组，同一科目的不同档位并列显示 */
const priceGroups = computed(() => {
  const groups = new Map()

  for (const p of props.model?.prices ?? []) {
    if (!groups.has(p.item)) {
      groups.set(p.item, { item: p.item, name: p.itemName, role: p.role, rows: [] })
    }
    groups.get(p.item).rows.push(p)
  }

  return [...groups.values()]
})

function variantLabel(p) {
  const parts = [p.variant, p.variant2].map((v) => VARIANT_LABEL[v] ?? v).filter(Boolean)
  return parts.length ? parts.join(' · ') : '标准'
}

function unitLabel(unit) {
  return UNIT_LABEL[unit] ?? unit
}

/** 已失效的历史价：标注出来但不隐藏，看价格变迁还得靠它 */
function isExpired(p) {
  if (!p.effectiveTo) return false
  return p.effectiveTo < new Date().toISOString().slice(0, 10)
}

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

/*
  桥表反查：这个模型能被哪些 Agent 用。
  只在弹窗拿到模型 id 后查一次；库里没登记就明说「尚未登记」，
  不能把空结果渲染成「没有 Agent 支持它」。
*/
const agentSupport = ref(null)

const BINDING_LABEL = {
  default: '默认模型',
  supported: '支持',
  self_host_only: '仅私有化',
  not_supported: '不支持',
}

watch(
  () => props.model?.id,
  async (id) => {
    agentSupport.value = null
    if (!id) return
    try {
      agentSupport.value = await fetchAgentsByModel(id)
    } catch {
      agentSupport.value = { failed: true, items: [] }
    }
  },
)

watch(
  () => props.model,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

// 弹窗打开期间锁住页面滚动，否则背景会跟着滚
onMounted(() => {
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="mask" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal-head">
        <div class="head-main">
          <template v-if="model">
            <div class="head-top">
              <VendorLogo :code="model.vendor.code" :size="24" />
              <span class="vendor">{{ model.vendor.nameZh || model.vendor.name }}</span>
              <span class="status" :class="model.status">{{ statusLabel(model.status) }}</span>
              <span v-if="model.vendor.cnDirect" class="cn">国内直连</span>
            </div>
            <h2 class="name">{{ model.displayName }}</h2>
            <div class="head-sub">
              <code class="api-id">{{ model.apiModelId }}</code>
              <span v-if="model.familyPositioning" class="positioning">
                {{ model.family }} · {{ model.familyPositioning }}
              </span>
            </div>
          </template>
          <p v-else-if="loading" class="head-loading">加载中…</p>
          <p v-else-if="error" class="head-loading error">{{ error }}</p>
        </div>

        <button type="button" class="close" title="关闭（Esc）" @click="emit('close')">✕</button>
      </header>

      <div v-if="model" class="modal-body">
        <!-- 左栏：信息 -->
        <div class="col">
          <section class="block">
            <h3 class="block-title">能力</h3>
            <div class="cap-grid">
              <div class="cap">
                <span class="cap-label">视觉</span>
                <span class="cap-val" :class="triTone(model.supportsVision)">
                  {{ triLabel(model.supportsVision) }}
                </span>
              </div>
              <div class="cap">
                <span class="cap-label">工具调用</span>
                <span class="cap-val" :class="triTone(model.supportsToolCall)">
                  {{ triLabel(model.supportsToolCall) }}
                </span>
              </div>
              <div class="cap">
                <span class="cap-label">私有化部署</span>
                <span class="cap-val" :class="triTone(model.supportsSelfHost)">
                  {{ triLabel(model.supportsSelfHost) }}
                </span>
              </div>
              <div class="cap">
                <span class="cap-label">类型</span>
                <span class="cap-val">{{ typeLabel(model.modelType) }}</span>
              </div>
            </div>

            <div v-if="model.capabilities.length" class="tags">
              <span v-for="c in model.capabilities" :key="c" class="tag">{{ c }}</span>
            </div>
          </section>

          <section class="block">
            <h3 class="block-title">规格</h3>
            <dl class="specs">
              <div><dt>上下文窗口</dt><dd>{{ fmtContext(model.contextWindow) }}</dd></div>
              <div><dt>最大输出</dt><dd>{{ fmtContext(model.maxOutputTokens) }}</dd></div>
              <div>
                <dt>参数规模</dt>
                <dd>{{ model.totalParamsB ? `${model.totalParamsB}B` : '—' }}</dd>
              </div>
              <div><dt>发布日期</dt><dd>{{ model.releaseDate || '—' }}</dd></div>
              <div><dt>知识截止</dt><dd>{{ model.knowledgeCutoff || '—' }}</dd></div>
              <div>
                <dt>架构</dt>
                <dd>{{ model.architecture === 'unknown' ? '—' : model.architecture }}</dd>
              </div>
              <div><dt>开放性</dt><dd>{{ opennessLabel(model.openness) }}</dd></div>
              <div>
                <dt>推理模式</dt>
                <dd>{{ model.reasoningMode === 'unknown' ? '—' : model.reasoningMode }}</dd>
              </div>
            </dl>
          </section>

          <section class="block">
            <h3 class="block-title">许可协议</h3>
            <p v-if="!model.license" class="muted">未收集</p>
            <template v-else>
              <p class="license-name">{{ model.license.name }}</p>
              <p class="muted">
                允许商用：{{ triLabel(model.license.allowsCommercial) }}
                · 允许修改：{{ triLabel(model.license.allowsModify) }}
              </p>
              <a
                v-if="model.weightsUrl"
                class="inline-link"
                :href="model.weightsUrl"
                target="_blank"
                rel="noreferrer"
              >
                权重下载地址 ↗
              </a>
            </template>
          </section>

          <!-- 桥表反查：这个模型能被哪些 Agent 用 -->
          <section class="block">
            <h3 class="block-title">可用 Agent</h3>
            <p v-if="!agentSupport" class="muted">查询中…</p>
            <p v-else-if="agentSupport.failed" class="muted">查询失败</p>
            <p v-else-if="!agentSupport.items.length" class="muted">
              知识库中尚未登记能运行该模型的 Agent。
            </p>
            <ul v-else class="agent-support">
              <li v-for="s in agentSupport.items" :key="s.agentId">
                <div class="as-row">
                  <span class="as-name">{{ s.name }}</span>
                  <span class="as-binding" :class="`b-${s.binding}`">
                    {{ BINDING_LABEL[s.binding] ?? s.binding }}
                  </span>
                </div>
                <p v-if="s.note" class="muted small">{{ s.note }}</p>
              </li>
            </ul>
          </section>

          <!-- 官网：放在备注之前 -->
          <section v-if="model.officialUrl" class="block">
            <h3 class="block-title">官网</h3>
            <a class="official" :href="model.officialUrl" target="_blank" rel="noreferrer">
              <span class="official-url">{{ model.officialUrl }}</span>
              <span class="official-go">前往 ↗</span>
            </a>
            <p v-if="!model.docUrl" class="muted small">
              当前指向厂商官网。采集到该模型的专属文档页后会优先使用。
            </p>
          </section>

          <section v-if="model.notes" class="block">
            <h3 class="block-title">备注</h3>
            <p class="notes">{{ model.notes }}</p>
          </section>
        </div>

        <!-- 右栏：价格（最长的部分，单独占一栏） -->
        <div class="col">
          <section class="block first">
            <h3 class="block-title">
              价格
              <span class="block-note">全部档位，含已失效的历史价</span>
            </h3>

            <p v-if="!priceGroups.length" class="muted">未收集</p>

            <div v-for="g in priceGroups" :key="g.item" class="price-group">
              <p class="price-group-title">{{ g.name }}</p>
              <table class="price-table">
                <tbody>
                  <tr v-for="(p, i) in g.rows" :key="i" :class="{ expired: isExpired(p) }">
                    <td class="c-variant">{{ variantLabel(p) }}</td>
                    <td class="c-price">
                      {{ fmtUsd(p.priceUsd) }}
                      <span v-if="isForeignCurrency(p.currency)" class="native">
                        {{ fmtNative(p.price, p.currency) }}
                      </span>
                    </td>
                    <td class="c-unit">{{ unitLabel(p.unit) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="muted small">
              单价按美元折算显示，下方小字为厂商原币种计价。
            </p>
          </section>
        </div>
      </div>
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
  background: rgba(27, 20, 37, 0.42);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/*
  弹窗约占视口的 80%。
  用 vw/vh 而不是百分比 —— 百分比是相对父级（.mask 已是全屏，结果一样），
  但 vw/vh 更直观地表达"占页面多少"。
*/
.modal {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 84vw;
  max-width: 1500px;
  height: 84vh;
  max-height: 1000px;
  overflow: hidden;
  border-radius: var(--radius);
  background: #fff;
  box-shadow: 0 24px 70px rgba(5, 1, 10, 0.38);
}

/* ---- 头部：固定在顶部，滚动时关闭按钮始终可见 ---- */
.modal-head {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.4rem 0.9rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.09);
}

.head-main {
  min-width: 0;
}

.head-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.vendor {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
}

.status {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.06);
  color: var(--ink-dim);
  font-size: 0.72rem;
}

.status.ga {
  background: rgba(34, 160, 90, 0.12);
  color: #1c7a45;
}

.status.retired {
  background: rgba(217, 58, 86, 0.12);
  color: var(--danger);
}

.cn {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(34, 160, 90, 0.1);
  color: #1c7a45;
  font-size: 0.72rem;
}

.name {
  margin: 0.5rem 0 0.35rem;
  font-size: 1.4rem;
  font-weight: 650;
}

.head-sub {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.api-id {
  padding: 0.15rem 0.5rem;
  border-radius: 7px;
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink-dim);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.78rem;
}

.positioning {
  color: var(--ink-dim);
  font-size: 0.82rem;
}

.close {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
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

.head-loading {
  margin: 0;
  color: var(--ink-dim);
}

.head-loading.error {
  color: var(--danger);
}

/* ---- 主体：两栏 ---- */
.modal-body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 0 2rem;
  min-height: 0;
  padding: 0 1.4rem 1.4rem;
  overflow-y: auto;
}

.col {
  min-width: 0;
}

.block {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(27, 20, 37, 0.08);
}

/* 每栏第一个区块不需要顶部分隔线 */
.block.first,
.col > .block:first-child {
  border-top: none;
}

.block-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0 0 0.65rem;
  font-size: 0.92rem;
  font-weight: 650;
}

.block-note {
  color: var(--ink-dim);
  font-size: 0.72rem;
  font-weight: 400;
}

.muted {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
}

.muted.small {
  margin-top: 0.5rem;
  font-size: 0.74rem;
  opacity: 0.8;
}

/* ---- 能力 ---- */
.cap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.5rem;
}

.cap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.5rem 0.65rem;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
}

.cap-label {
  color: var(--ink-dim);
  font-size: 0.72rem;
}

.cap-val {
  font-size: 0.86rem;
  font-weight: 600;
}

.cap-val.yes {
  color: #1c7a45;
}

.cap-val.no {
  color: var(--ink-dim);
}

.cap-val.unknown {
  color: #a08b3f;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.6rem;
}

.tag {
  padding: 0.15rem 0.55rem;
  border: 1px solid var(--accent-ring);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.74rem;
}

/* ---- 规格 ---- */
.specs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0 1.2rem;
  margin: 0;
}

.specs > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.32rem 0;
  border-bottom: 1px dashed rgba(27, 20, 37, 0.08);
}

.specs dt {
  color: var(--ink-dim);
  font-size: 0.78rem;
}

.specs dd {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
}

/* ---- 许可 ---- */
.license-name {
  margin: 0 0 0.2rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.inline-link {
  display: inline-block;
  margin-top: 0.4rem;
  color: var(--accent);
  font-size: 0.82rem;
}

/* ---- 官网 ---- */
.official {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--accent-ring);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  text-decoration: none;
  transition: background 0.16s var(--ease);
}

.official:hover {
  background: rgba(139, 63, 214, 0.18);
}

.official-url {
  overflow: hidden;
  color: var(--accent);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.official-go {
  flex-shrink: 0;
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 600;
}

/* ---- 价格 ---- */
.price-group + .price-group {
  margin-top: 0.9rem;
}

.price-group-title {
  margin: 0 0 0.3rem;
  color: var(--ink-dim);
  font-size: 0.76rem;
  font-weight: 600;
}

.price-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.price-table tr + tr {
  border-top: 1px dashed rgba(27, 20, 37, 0.08);
}

.price-table tr.expired {
  opacity: 0.45;
}

.price-table td {
  padding: 0.32rem 0;
  vertical-align: baseline;
}

.c-variant {
  color: var(--ink-dim);
  font-size: 0.78rem;
}

.c-price {
  text-align: right;
  font-weight: 650;
  white-space: nowrap;
}

.native {
  margin-left: 0.35rem;
  color: var(--ink-dim);
  font-size: 0.72rem;
  font-weight: 400;
}

.c-unit {
  padding-left: 0.7rem;
  color: var(--ink-dim);
  font-size: 0.74rem;
  text-align: right;
  white-space: nowrap;
}

.notes {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.82rem;
  line-height: 1.75;
}

/* 可用 Agent 列表 */
.agent-support {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.as-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.as-name {
  font-size: 0.84rem;
  font-weight: 600;
}

.as-binding {
  padding: 0.06rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
}

.b-default {
  background: var(--accent-soft);
  color: var(--accent);
}

.b-supported {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.b-self_host_only {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.b-not_supported {
  background: rgba(217, 58, 86, 0.1);
  color: var(--danger);
}

/* 窄屏收成单栏，弹窗仍占大部分屏幕 */
@media (max-width: 900px) {
  .modal {
    width: 94vw;
    height: 92vh;
  }

  .modal-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
