<script setup>
/**
 * Agent 规格对比页（/agent/spec）。
 *
 * 和 /agent 的分工：那里回答「这种形态用起来什么感觉」（界面复刻件），
 * 这里回答「这三款在规格与能力上到底差在哪」（数据库里的结构化事实）。
 *
 * 页面的两个设计锚点，都是论文「可信性标注」主张在界面上的兑现：
 *   1. 能力只有四态，且「未采集」用灰虚线框 + 「?」—— 一眼看上去绝不能
 *      让人把「没查过」当成「不支持」。这不是审美选择，是数据诚实。
 *   2. 每个单元格可点开看证据：detail + 来源 + 核查日期 + 置信度。
 *      「可溯源」从一个数据库字段变成一个真实交互。
 */
import { computed, onMounted, ref } from 'vue'

import { fetchAgentMatrix } from '@/services/agentApi'

const loading = ref(true)
const error = ref('')
const agents = ref([])
const capabilities = ref([])
const cells = ref({})

/** 当前选中查看证据的单元格 { agentId, capabilityId } */
const selected = ref(null)

/** 「只看有区分度的」：三款取值不全相同的行才有排序价值 */
const onlyDivergent = ref(false)
/** 「隐藏全未采集」：三款都还没查的行先收起来 */
const hideAllUnknown = ref(false)

/* ---------------- 枚举 → 中文标签 ---------------- */

const LABELS = {
  runtimeLocality: { local: '本地', cloud: '云端', hybrid: '混合' },
  workspaceModel: {
    local_folder: '本地文件夹',
    git_worktree: 'Git 工作树',
    cloud_repo: '云端仓库',
    none: '无',
  },
  concurrency: { single: '单会话', parallel_sessions: '并行会话', multi_agent: '多智能体' },
  permissionModel: {
    ask_every_time: '逐次询问',
    allowlist: '白名单',
    full_access: '完全访问',
    sandbox_only: '仅沙箱',
  },
  modelBinding: {
    vendor_locked: '绑定自家模型',
    any_compatible_api: '任意兼容 API',
    local_model_ok: '可接本地模型',
  },
  pricingModel: {
    free: '免费',
    subscription: '订阅制',
    credits: '积分制',
    api_metered: 'API 计量',
    bundled: '随套餐捆绑',
  },
  maturity: { preview: '预览版', beta: '公测', ga: '正式版' },
  dataResidency: { local_only: '仅本地', vendor_cloud: '厂商云', hybrid: '混合' },
  surfaces: {
    desktop: '桌面端',
    cli: '命令行',
    ide_extension: 'IDE 插件',
    web: '网页',
    mini_program: '小程序',
    mobile: '移动端',
    api: 'API',
  },
  platforms: {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    harmonyos: '鸿蒙',
    ios: 'iOS',
    android: 'Android',
  },
}

const CATEGORY_LABELS = {
  execution: '执行',
  safety: '安全',
  extensibility: '扩展性',
  collaboration: '协作',
  memory: '记忆',
  observability: '可观测性',
  integration: '集成',
}

const STATE_META = {
  supported: { label: '支持', icon: '✓' },
  partial: { label: '部分', icon: '◐' },
  unsupported: { label: '不支持', icon: '✕' },
  unknown: { label: '未采集', icon: '?' },
}

const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' }

/* ---------------- 规格对照卡的分组 ---------------- */

const SPEC_GROUPS = [
  {
    title: '形态',
    fields: [
      { key: 'surfaces', label: '交付形态', list: 'surfaces' },
      { key: 'platforms', label: '平台', list: 'platforms' },
      { key: 'versionLabel', label: '版本' },
    ],
  },
  {
    title: '运行',
    fields: [
      { key: 'runtimeLocality', label: '运行位置' },
      { key: 'workspaceModel', label: '工作区' },
      { key: 'concurrency', label: '并发' },
      { key: 'dataResidency', label: '数据驻留' },
    ],
  },
  {
    title: '边界',
    fields: [
      { key: 'permissionModel', label: '权限模型' },
      { key: 'modelBinding', label: '模型绑定' },
      { key: 'selfHostable', label: '可私有化', tri: true },
      { key: 'openSource', label: '开源', tri: true },
    ],
  },
  {
    title: '商业',
    fields: [
      { key: 'pricingModel', label: '计费' },
      { key: 'maturity', label: '成熟度' },
      { key: 'licenseName', label: '许可证' },
    ],
  },
]

function specText(agent, field) {
  const v = agent[field.key]
  if (field.tri) return v === null ? '未采集' : v ? '是' : '否'
  if (v === null || v === undefined || v === '') return '未采集'
  if (field.list) {
    const map = LABELS[field.list]
    return v.length ? v.map((x) => map[x] ?? x).join('、') : '未采集'
  }
  const map = LABELS[field.key]
  return map ? (map[v] ?? v) : v
}

/* ---------------- 矩阵行 ---------------- */

function cellOf(agentId, capId) {
  return cells.value[`${agentId}:${capId}`] ?? { state: 'unknown', detail: '' }
}

/** 「分叉」徽章：三款已采集的取值里出现两种及以上 —— 对排序才有意义 */
function isDivergent(capId) {
  const states = agents.value
    .map((a) => cellOf(a.id, capId).state)
    .filter((s) => s !== 'unknown')
  return new Set(states).size > 1
}

/*
  筛选开关用的是更宽的口径：三款取值不全相同（含「未采集」的差异）。
  三家全 supported 的行（插件、MCP 这类）没有对比价值，全未采集的也没有 ——
  但「A 支持、B 未采集」值得留下来：它说明的是覆盖度差异，本身也是信息。
*/
function hasAnyDifference(capId) {
  return new Set(agents.value.map((a) => cellOf(a.id, capId).state)).size > 1
}

function isAllUnknown(capId) {
  return agents.value.every((a) => cellOf(a.id, capId).state === 'unknown')
}

const visibleCapabilities = computed(() =>
  capabilities.value.filter((c) => {
    if (onlyDivergent.value && !hasAnyDifference(c.id)) return false
    if (hideAllUnknown.value && isAllUnknown(c.id)) return false
    return true
  }),
)

/** 按类别分组渲染，类别顺序按首次出现 */
const groupedCapabilities = computed(() => {
  const groups = []
  for (const cap of visibleCapabilities.value) {
    const last = groups[groups.length - 1]
    if (last && last.category === cap.category) last.items.push(cap)
    else groups.push({ category: cap.category, items: [cap] })
  }
  return groups
})

const selectedCell = computed(() => {
  if (!selected.value) return null
  const { agentId, capabilityId } = selected.value
  const agent = agents.value.find((a) => a.id === agentId)
  const cap = capabilities.value.find((c) => c.id === capabilityId)
  if (!agent || !cap) return null
  return { agent, cap, cell: cellOf(agentId, capabilityId) }
})

function selectCell(agentId, capabilityId) {
  const key = selected.value
  if (key && key.agentId === agentId && key.capabilityId === capabilityId) {
    selected.value = null
  } else {
    selected.value = { agentId, capabilityId }
  }
}

onMounted(async () => {
  try {
    const data = await fetchAgentMatrix()
    agents.value = data.agents
    capabilities.value = data.capabilities
    cells.value = data.cells
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="spec-page">
    <header class="page-head">
      <h1>Agent 规格对比</h1>
      <p class="lead">
        数据来自知识库的 Agent 侧（{{ agents.length }} 款产品 × {{ capabilities.length }} 项能力）。
        能力分四态：<span class="lg st-supported">✓ 支持</span>、
        <span class="lg st-partial">◐ 部分</span>、<span class="lg st-unsupported">✕ 不支持</span>、
        <span class="lg st-unknown">? 未采集</span>。<strong>「未采集」不等于「不支持」</strong
        >——点任意单元格可看证据与核查日期。
      </p>
    </header>

    <p v-if="loading" class="state">加载中…</p>
    <p v-else-if="error" class="state err">{{ error }}</p>

    <template v-else>
      <!-- ================= 规格对照卡 ================= -->
      <section class="spec-cards">
        <article v-for="a in agents" :key="a.id" class="spec-card">
          <header class="spec-card-head">
            <h2>{{ a.name }}</h2>
            <span class="maturity" :class="`m-${a.maturity}`">
              {{ LABELS.maturity[a.maturity] ?? a.maturity ?? '未采集' }}
            </span>
          </header>

          <dl v-for="g in SPEC_GROUPS" :key="g.title" class="spec-group">
            <dt>{{ g.title }}</dt>
            <dd v-for="f in g.fields" :key="f.key">
              <span class="k">{{ f.label }}</span>
              <span class="v" :class="{ uncoll: specText(a, f) === '未采集' }">
                {{ specText(a, f) }}
              </span>
            </dd>
          </dl>

          <p v-if="a.caveats" class="caveats">⚠ {{ a.caveats }}</p>
          <p class="verified">
            核查于 {{ a.verifiedAt ?? '未标注'
            }}<template v-if="a.source"> · 来源：{{ a.source.name }}</template>
          </p>
        </article>
      </section>

      <!-- ================= 能力矩阵 ================= -->
      <section class="matrix">
        <div class="matrix-head">
          <h2>能力矩阵</h2>
          <label class="toggle">
            <input v-model="onlyDivergent" type="checkbox" />
            只看有差异的
          </label>
          <label class="toggle">
            <input v-model="hideAllUnknown" type="checkbox" />
            隐藏全未采集
          </label>
          <span class="row-count">{{ visibleCapabilities.length }} / {{ capabilities.length }} 项</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="cap-col">能力</th>
                <th v-for="a in agents" :key="a.id">{{ a.name }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="g in groupedCapabilities" :key="g.category">
                <tr class="cat-row">
                  <td :colspan="agents.length + 1">{{ CATEGORY_LABELS[g.category] ?? g.category }}</td>
                </tr>
                <tr v-for="cap in g.items" :key="cap.id">
                  <td class="cap-col">
                    <span class="cap-name">{{ cap.name }}</span>
                    <span
                      v-if="isDivergent(cap.id)"
                      class="div-badge"
                      title="三款已采集的取值不同，对排序有意义"
                      >分叉</span
                    >
                  </td>
                  <td v-for="a in agents" :key="a.id">
                    <button
                      type="button"
                      class="cell"
                      :class="[
                        `st-${cellOf(a.id, cap.id).state}`,
                        {
                          sel:
                            selected &&
                            selected.agentId === a.id &&
                            selected.capabilityId === cap.id,
                        },
                      ]"
                      @click="selectCell(a.id, cap.id)"
                    >
                      {{ STATE_META[cellOf(a.id, cap.id).state].icon }}
                      {{ STATE_META[cellOf(a.id, cap.id).state].label }}
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- 单元格证据 -->
        <transition name="ev">
          <aside v-if="selectedCell" class="evidence">
            <header>
              <strong>{{ selectedCell.cap.name }}</strong>
              <span class="ev-agent">{{ selectedCell.agent.name }}</span>
              <span class="cell" :class="`st-${selectedCell.cell.state}`">
                {{ STATE_META[selectedCell.cell.state].icon }}
                {{ STATE_META[selectedCell.cell.state].label }}
              </span>
              <button type="button" class="ev-close" @click="selected = null">✕</button>
            </header>
            <p v-if="selectedCell.cell.detail" class="ev-detail">{{ selectedCell.cell.detail }}</p>
            <p v-else class="ev-detail dim">暂无细节说明。</p>
            <p class="ev-meta">
              <span v-if="selectedCell.cap.whyItMatters" class="why"
                >为什么影响选型：{{ selectedCell.cap.whyItMatters }}</span
              >
              <span>置信度：{{ CONFIDENCE_LABELS[selectedCell.cell.confidence] ?? '中' }}</span>
              <span>核查日期：{{ selectedCell.cell.verifiedAt ?? '未标注' }}</span>
              <span v-if="selectedCell.cell.source">
                来源：<a
                  v-if="selectedCell.cell.source.url"
                  :href="selectedCell.cell.source.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ selectedCell.cell.source.name }}</a
                ><template v-else>{{ selectedCell.cell.source.name }}</template>
              </span>
            </p>
          </aside>
        </transition>
      </section>
    </template>
  </div>
</template>

<style scoped>
.spec-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 76rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}

.page-head h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.lead {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.86rem;
  line-height: 1.85;
}

.lg {
  padding: 0 0.3rem;
  border-radius: 4px;
  font-size: 0.78rem;
  white-space: nowrap;
}

.state {
  padding: 3rem 0;
  color: var(--ink-dim);
  text-align: center;
}

.state.err {
  color: var(--danger);
}

/* ---------- 规格对照卡 ---------- */

.spec-cards {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}

.spec-card {
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--glass);
  box-shadow: 0 1px 10px rgba(5, 1, 10, 0.06);
  backdrop-filter: blur(18px);
}

.spec-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.spec-card-head h2 {
  margin: 0;
  font-size: 1.05rem;
}

.maturity {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
}

.m-ga {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.m-preview,
.m-beta {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.spec-group {
  margin: 0 0 0.6rem;
}

.spec-group dt {
  margin: 0.55rem 0 0.25rem;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.spec-group dd {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
  padding: 0.16rem 0;
  font-size: 0.82rem;
}

.spec-group .k {
  flex-shrink: 0;
  color: var(--ink-dim);
}

.spec-group .v {
  text-align: right;
}

.spec-group .v.uncoll {
  color: var(--ink-dim);
  font-style: italic;
  opacity: 0.75;
}

.caveats {
  margin: 0.7rem 0 0;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-sm);
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
  font-size: 0.78rem;
  line-height: 1.6;
}

.verified {
  margin: 0.6rem 0 0;
  color: var(--ink-dim);
  font-size: 0.72rem;
}

/* ---------- 能力矩阵 ---------- */

.matrix {
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--glass);
  backdrop-filter: blur(18px);
}

.matrix-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.matrix-head h2 {
  margin: 0;
  margin-right: auto;
  font-size: 1.05rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--ink-dim);
  font-size: 0.8rem;
  cursor: pointer;
}

.toggle input {
  accent-color: var(--accent);
}

.row-count {
  color: var(--ink-dim);
  font-size: 0.76rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

th,
td {
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.07);
  text-align: left;
}

thead th {
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.cap-col {
  min-width: 12rem;
}

.cap-name {
  font-weight: 500;
}

.div-badge {
  margin-left: 0.45rem;
  padding: 0.02rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.68rem;
}

.cat-row td {
  padding-top: 0.8rem;
  border-bottom: none;
  color: var(--ink-dim);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

/* 四态徽章：「未采集」必须是灰虚线框 —— 视觉上绝不能像「不支持」 */
.cell {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font: inherit;
  font-size: 0.76rem;
  cursor: pointer;
  transition: transform 0.12s var(--ease);
}

.cell:hover {
  transform: translateY(-1px);
}

.cell.sel {
  outline: 2px solid var(--accent-ring);
}

.st-supported {
  border-color: rgba(22, 163, 74, 0.35);
  background: rgba(22, 163, 74, 0.1);
  color: #15803d;
}

.st-partial {
  border-color: rgba(217, 119, 6, 0.35);
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}

.st-unsupported {
  border-color: rgba(217, 58, 86, 0.35);
  background: rgba(217, 58, 86, 0.08);
  color: var(--danger);
}

.st-unknown {
  border-color: rgba(109, 101, 128, 0.4);
  border-style: dashed;
  background: transparent;
  color: var(--ink-dim);
}

/* ---------- 证据面板 ---------- */

.evidence {
  margin-top: 1rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--accent-ring);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.75);
}

.evidence header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.ev-agent {
  color: var(--ink-dim);
  font-size: 0.82rem;
}

.ev-close {
  margin-left: auto;
  padding: 0.1rem 0.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
}

.ev-close:hover {
  background: rgba(27, 20, 37, 0.06);
}

.ev-detail {
  margin: 0.55rem 0 0;
  font-size: 0.84rem;
  line-height: 1.7;
}

.ev-detail.dim {
  color: var(--ink-dim);
}

.ev-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  margin: 0.55rem 0 0;
  color: var(--ink-dim);
  font-size: 0.74rem;
}

.ev-meta .why {
  flex-basis: 100%;
}

.ev-meta a {
  color: var(--accent);
}

.ev-enter-active,
.ev-leave-active {
  transition:
    opacity 0.18s var(--ease),
    transform 0.18s var(--ease);
}

.ev-enter-from,
.ev-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
