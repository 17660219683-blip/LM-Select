<script setup>
/**
 * 选型推荐页（/recommend）。
 *
 * 题目里「推荐」动词的落点。整页围绕一条原则组织：
 * **每条结论都要能回答「为什么」和「依据哪条数据」**。
 *   - Agent 卡片带 fit 级别 + 人工理由；没有人工评估的人群明说「按门槛推导」；
 *   - 模型卡片带分数 + 分项分解 + 门槛通过情况；弃权维度标「弃权」而不是 0 分；
 *   - 页面底部把权重、门槛口径、数据缺口全部摊开 —— 答辩时这一节就是讲稿。
 *
 * 状态同步到地址栏（?persona=xxx）：结果可分享，也方便按 URL 截图。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchRecommendation, fetchRecommendPersonas } from '@/services/agentApi'

const route = useRoute()
const router = useRouter()

const personas = ref([])
const personasLoading = ref(true)
const personasError = ref('')

const personaCode = ref('')
const result = ref(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const data = await fetchRecommendPersonas()
    personas.value = data.items
    const initial = String(route.query.persona ?? '')
    if (initial && data.items.some((p) => p.code === initial)) {
      select(initial)
    }
  } catch (err) {
    personasError.value = err.message
  } finally {
    personasLoading.value = false
  }
})

async function select(code) {
  personaCode.value = code
  router.replace({ query: { ...route.query, persona: code } })
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await fetchRecommendation(code)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/* ---------------- 展示辅助 ---------------- */

const FIT_CLASS = { best: 'fit-best', good: 'fit-good', ok: 'fit-ok', poor: 'fit-poor' }

const CAP_STATE = {
  supported: { label: '支持', cls: 'st-supported' },
  partial: { label: '部分', cls: 'st-partial' },
  unsupported: { label: '不支持', cls: 'st-unsupported' },
  unknown: { label: '未采集', cls: 'st-unknown' },
}

const MATURITY_LABELS = { preview: '预览版', beta: '公测', ga: '正式版' }

const agents = computed(() => result.value?.agents ?? { mode: 'derived', items: [] })
const models = computed(() => result.value?.models ?? null)
const methodology = computed(() => result.value?.methodology ?? null)

/** 价格展示：USD 为主，保留 3 位小数防止小数值全挤成 0.00 */
function fmtUsd(v) {
  if (v === null || v === undefined) return '未采集'
  return `$${Number(v).toFixed(3)}`
}

function fmtCtx(v) {
  if (v === null || v === undefined) return '未采集'
  return v >= 10000 ? `${(v / 10000).toFixed(v % 10000 ? 1 : 0)} 万` : String(v)
}
</script>

<template>
  <div class="rec-page">
    <header class="page-head">
      <h1>选型推荐</h1>
      <p class="lead">
        选一个最接近你的使用场景。规则全部可解释：模型侧 = <strong>硬门槛过滤 + 加权打分</strong>，
        Agent 侧 = <strong>人工适配评估</strong>；没有数据的维度一律标「弃权」， 不会用 0
        分冒充。完整口径见页面底部。
      </p>
    </header>

    <!-- ================= 人群选择 ================= -->
    <p v-if="personasLoading" class="state">加载人群中…</p>
    <p v-else-if="personasError" class="state err">{{ personasError }}</p>

    <section v-else class="personas">
      <button
        v-for="p in personas"
        :key="p.code"
        type="button"
        class="persona-card"
        :class="{ on: personaCode === p.code }"
        @click="select(p.code)"
      >
        <strong>{{ p.name }}</strong>
        <span v-if="p.summary" class="p-summary">{{ p.summary }}</span>
        <span v-if="p.needs.length" class="p-needs">{{ p.needs.join(' · ') }}</span>
      </button>
    </section>

    <p v-if="loading" class="state">计算推荐中…</p>
    <p v-else-if="error" class="state err">{{ error }}</p>

    <template v-else-if="result">
      <!-- ================= 门槛说明 ================= -->
      <section v-if="models && models.gates.length" class="panel gates">
        <h2>「{{ result.persona.name }}」的硬门槛</h2>
        <ul>
          <li v-for="g in models.gates" :key="g.key" :class="{ unverifiable: !g.verifiable }">
            <span class="g-dot" :class="g.verifiable ? 'ok' : 'no'" aria-hidden="true" />
            {{ g.description }}
            <em v-if="!g.verifiable">（无法校验，未参与过滤）</em>
          </li>
        </ul>
        <p class="g-stat">
          共 {{ models.totalBefore }} 个模型，门槛过滤掉 {{ models.filteredOut }} 个， 剩余
          {{ models.passedCount }} 个进入打分。 门槛数据为「未采集」的模型按放行处理并单独标注 ——
          未采集不等于不支持。
        </p>
      </section>

      <!-- ================= Agent 推荐 ================= -->
      <section class="panel">
        <h2>Agent 推荐</h2>
        <p v-if="agents.mode === 'derived'" class="mode-note">
          该人群暂无人工适配评估，以下按硬门槛推导得出（与人工评估严格区分展示）。
        </p>

        <div class="agent-list">
          <article v-for="(it, i) in agents.items" :key="it.agent.id" class="agent-row">
            <span class="rank">#{{ i + 1 }}</span>
            <div class="agent-main">
              <header>
                <strong>{{ it.agent.name }}</strong>
                <span v-if="it.fitLabel" class="fit" :class="FIT_CLASS[it.fitLevel]">{{
                  it.fitLabel
                }}</span>
                <span
                  v-else-if="it.derived"
                  class="fit"
                  :class="it.derived.pass ? 'fit-ok' : 'fit-poor'"
                >
                  {{ it.derived.pass ? '门槛通过' : '门槛不通过' }}
                </span>
                <span v-else class="fit fit-none">未评估</span>
                <span v-if="it.agent.maturity" class="meta">{{
                  MATURITY_LABELS[it.agent.maturity]
                }}</span>
              </header>
              <p v-if="it.reason" class="reason">{{ it.reason }}</p>
              <p v-else-if="it.derived" class="reason dim">{{ it.derived.note }}</p>
              <p v-if="it.agent.caveats" class="caveats">⚠ {{ it.agent.caveats }}</p>
              <div v-if="it.keyCapabilities.length" class="caps">
                <span
                  v-for="c in it.keyCapabilities"
                  :key="c.code"
                  class="cap"
                  :class="CAP_STATE[c.state].cls"
                  :title="c.detail || CAP_STATE[c.state].label"
                >
                  {{ c.name }} · {{ CAP_STATE[c.state].label }}
                </span>
              </div>
            </div>
            <a
              v-if="it.agent.homepage"
              class="site"
              :href="it.agent.homepage"
              target="_blank"
              rel="noopener noreferrer"
              >官网 ↗</a
            >
          </article>
        </div>
      </section>

      <!-- ================= 模型推荐 ================= -->
      <section v-if="models" class="panel">
        <h2>
          模型推荐 <span class="h2-sub">Top {{ models.items.length }}</span>
        </h2>

        <div class="model-list">
          <article v-for="(m, i) in models.items" :key="m.id" class="model-row">
            <span class="rank">#{{ i + 1 }}</span>
            <div class="model-main">
              <header>
                <strong>{{ m.displayName }}</strong>
                <span class="meta">{{ m.vendorName }}</span>
                <span v-if="m.score !== null" class="score">{{ m.score }}</span>
                <span v-else class="meta">无法打分</span>
              </header>

              <div v-if="m.score !== null" class="scorebar">
                <div class="fill" :style="{ width: `${m.score}%` }" />
              </div>

              <div class="breakdown">
                <span
                  v-for="b in m.breakdown"
                  :key="b.dimension"
                  class="bd"
                  :class="{ abstain: b.score === null }"
                >
                  {{ b.label }}
                  <template v-if="b.score !== null">{{ b.score }} 分</template>
                  <template v-else>弃权</template>
                  <i>({{ Math.round(b.weight * 100) }}%)</i>
                </span>
                <span class="bd info">上下文 {{ fmtCtx(m.contextWindow) }}</span>
                <span class="bd info">输出 {{ fmtUsd(m.outputUsd) }}/1M</span>
              </div>

              <div v-if="m.gateFlags.some((f) => f.result === 'unknown')" class="gate-flags">
                <span v-for="f in m.gateFlags.filter((f) => f.result === 'unknown')" :key="f.key">
                  ⚠ {{ f.label }}：数据未采集，按放行处理
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- ================= 口径与数据缺口 ================= -->
      <section v-if="methodology" class="panel methodology">
        <h2>口径说明</h2>
        <p class="weights">
          权重（按人群预算等级「{{ result.persona.budgetLevel }}」取值）：
          <span v-for="b in models.items[0]?.breakdown ?? []" :key="b.dimension">
            {{ b.label }} {{ Math.round(b.weight * 100) }}%
          </span>
        </p>
        <ul>
          <li v-for="(n, i) in methodology.notes" :key="i">{{ n }}</li>
        </ul>
        <template v-if="models.dataGaps.length">
          <h3>数据缺口（这些维度未参与打分）</h3>
          <ul class="gaps">
            <li v-for="g in models.dataGaps" :key="g.table">
              <code>{{ g.table }}</code> —— {{ g.message }}
            </li>
          </ul>
        </template>
      </section>
    </template>

    <p v-else-if="!personasLoading && !personasError" class="state">从上面选一个场景开始。</p>
  </div>
</template>

<style scoped>
.rec-page {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
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

.state {
  padding: 2.5rem 0;
  color: var(--ink-dim);
  text-align: center;
}

.state.err {
  color: var(--danger);
}

/* ---------- 人群选择 ---------- */

.personas {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
}

.persona-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s var(--ease),
    transform 0.15s var(--ease);
}

.persona-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent-ring);
}

.persona-card.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.persona-card strong {
  font-size: 0.88rem;
}

.p-summary {
  color: var(--ink-dim);
  font-size: 0.76rem;
}

.p-needs {
  color: var(--accent);
  font-size: 0.72rem;
}

/* ---------- 通用面板 ---------- */

.panel {
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--glass);
  backdrop-filter: blur(18px);
}

.panel h2 {
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
}

.h2-sub {
  color: var(--ink-dim);
  font-size: 0.76rem;
  font-weight: 400;
}

/* ---------- 门槛 ---------- */

.gates ul {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.84rem;
}

.gates li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.gates li.unverifiable {
  color: var(--ink-dim);
}

.gates em {
  font-size: 0.76rem;
  font-style: normal;
}

.g-dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.g-dot.ok {
  background: #16a34a;
}

.g-dot.no {
  background: #b8b2c4;
}

.g-stat {
  margin: 0.7rem 0 0;
  color: var(--ink-dim);
  font-size: 0.78rem;
  line-height: 1.7;
}

/* ---------- Agent / 模型行 ---------- */

.mode-note {
  margin: 0 0 0.8rem;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-sm);
  background: rgba(217, 119, 6, 0.08);
  color: #92400e;
  font-size: 0.78rem;
}

.agent-list,
.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.agent-row,
.model-row {
  display: flex;
  gap: 0.9rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(27, 20, 37, 0.08);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.55);
}

.rank {
  flex-shrink: 0;
  width: 2rem;
  color: var(--accent);
  font-weight: 700;
}

.agent-main,
.model-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.agent-main header,
.model-main header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.fit {
  padding: 0.08rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
}

.fit-best {
  background: rgba(139, 63, 214, 0.14);
  color: var(--accent);
  font-weight: 700;
}

.fit-good {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.fit-ok {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.fit-poor {
  background: rgba(217, 58, 86, 0.1);
  color: var(--danger);
}

.fit-none {
  border: 1px dashed rgba(109, 101, 128, 0.4);
  color: var(--ink-dim);
}

.meta {
  color: var(--ink-dim);
  font-size: 0.76rem;
}

.reason {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.7;
}

.reason.dim {
  color: var(--ink-dim);
}

.caveats {
  margin: 0;
  color: #92400e;
  font-size: 0.76rem;
}

.caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.cap {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
}

.st-supported {
  background: rgba(22, 163, 74, 0.1);
  color: #15803d;
}

.st-partial {
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}

.st-unsupported {
  background: rgba(217, 58, 86, 0.08);
  color: var(--danger);
}

.st-unknown {
  border: 1px dashed rgba(109, 101, 128, 0.4);
  color: var(--ink-dim);
}

.site {
  flex-shrink: 0;
  align-self: flex-start;
  color: var(--accent);
  font-size: 0.78rem;
  text-decoration: none;
}

.site:hover {
  text-decoration: underline;
}

/* ---------- 模型打分 ---------- */

.score {
  color: var(--accent);
  font-size: 1rem;
  font-weight: 700;
}

.scorebar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.08);
}

.scorebar .fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), #b678f0);
}

.breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.bd {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(139, 63, 214, 0.08);
  color: var(--ink);
  font-size: 0.72rem;
}

.bd i {
  color: var(--ink-dim);
  font-style: normal;
}

.bd.abstain {
  border: 1px dashed rgba(109, 101, 128, 0.4);
  background: transparent;
  color: var(--ink-dim);
}

.bd.info {
  background: rgba(27, 20, 37, 0.05);
  color: var(--ink-dim);
}

.gate-flags {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  color: #92400e;
  font-size: 0.74rem;
}

/* ---------- 口径说明 ---------- */

.methodology {
  font-size: 0.82rem;
}

.methodology h3 {
  margin: 0.9rem 0 0.4rem;
  font-size: 0.88rem;
}

.methodology ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--ink-dim);
  line-height: 1.8;
}

.weights {
  margin: 0 0 0.6rem;
}

.weights span {
  margin-right: 0.9rem;
  color: var(--accent);
  font-weight: 600;
}

.gaps code {
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: rgba(217, 119, 6, 0.1);
  color: #92400e;
  font-size: 0.76rem;
}
</style>
