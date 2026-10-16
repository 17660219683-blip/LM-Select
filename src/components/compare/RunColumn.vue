<script setup>
/**
 * 对比结果中的一列（一个模型）。
 *
 * 布局按"先看答案、再看指标"排：输出正文占满剩余高度，
 * 指标固定贴在列底部。这样多列并排时正文区域能对齐，
 * 指标也自然形成一条可横向扫读的对比带。
 */
import { computed, ref } from 'vue'

import VendorLogo from '@/components/models/VendorLogo.vue'

const props = defineProps({
  run: { type: Object, required: true },
  /** 同批里最快的输出速度，用来给这一列打相对值 */
  fastestTps: { type: Number, default: null },
})

const showReasoning = ref(false)

const STATUS_LABEL = {
  idle: '待运行',
  running: '生成中',
  done: '已完成',
  stopped: '已停止',
  error: '出错',
}

/** 毫秒转人话：186 -> 186ms，21363 -> 21.4s */
function fmtMs(ms) {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`
}

/** 相对最快速度的百分比，用于画条形 */
const speedRatio = computed(() => {
  if (!props.run.tokensPerSec || !props.fastestTps) return 0
  return Math.max(4, Math.round((props.run.tokensPerSec / props.fastestTps) * 100))
})

/**
 * 思考耗时 = 首字 - 首帧。
 * 推理模型会先流式吐思考过程，这段时间和"写答案"是两回事，拆开才有意义：
 * 它直接决定这个模型能不能用于实时场景。
 */
const reasoningMs = computed(() => {
  const { ttftMs, firstTokenMs } = props.run
  if (ttftMs === null || firstTokenMs === null) return null

  const v = ttftMs - firstTokenMs
  return v > 0 ? v : null
})

/** 输入 token 占模型上下文窗口的比例 —— 还剩多少余量 */
const contextUsage = computed(() => {
  const win = props.run.model?.contextWindow
  const used = props.run.promptTokens

  if (!win || used === null || used === undefined) return null
  return (used / win) * 100
})

/** 撞上长度上限被截断。截断的输出更短更快更便宜，必须显眼标出来 */
const truncated = computed(() => props.run.finishReason === 'length')
/** 被内容审核拦下 */
const filtered = computed(() => props.run.finishReason === 'content_filter')

/** 单次调用成本很小，小数位要够，否则一律显示成 $0.00 */
function fmtCost(usd) {
  if (usd === null || usd === undefined) return '—'
  if (usd === 0) return '$0'
  if (usd < 0.001) return `$${usd.toFixed(6)}`
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function fmtPercent(p) {
  if (p === null || p === undefined) return '—'
  if (p < 0.01) return `${p.toFixed(4)}%`
  if (p < 1) return `${p.toFixed(3)}%`
  return `${p.toFixed(1)}%`
}
</script>

<template>
  <article class="col" :class="run.status">
    <!-- 头部：模型标识 -->
    <header class="col-head">
      <VendorLogo :code="run.model.vendor.code" :size="20" />
      <span class="name">
        <span class="n">{{ run.model.displayName }}</span>
        <code class="id">{{ run.model.apiModelId }}</code>
      </span>
      <span class="status" :class="run.status">{{ STATUS_LABEL[run.status] ?? run.status }}</span>
    </header>

    <!-- 截断 / 内容审核提示：不说清楚的话，短输出会被误当成"简洁高效" -->
    <p v-if="truncated" class="flag warn">
      ⚠️ 输出被截断（撞到长度上限），下面的耗时与成本偏低，不可直接比较
    </p>
    <p v-else-if="filtered" class="flag warn">⚠️ 输出被内容审核拦截</p>

    <!-- 思考过程：推理模型才有，折叠着不抢正文的地方 -->
    <div v-if="run.reasoning" class="reasoning">
      <button type="button" class="reasoning-toggle" @click="showReasoning = !showReasoning">
        {{ showReasoning ? '收起' : '展开' }}思考过程（{{ run.reasoning.length }} 字）
      </button>
      <pre v-if="showReasoning" class="reasoning-body">{{ run.reasoning }}</pre>
    </div>

    <!-- 正文：占满剩余高度，自己滚 -->
    <div class="body">
      <p v-if="run.error" class="err">{{ run.error }}</p>
      <template v-else-if="run.text">{{ run.text }}</template>
      <p v-else-if="run.status === 'running'" class="dim">
        {{ run.reasoning ? '思考中…' : '等待首个 token…' }}
      </p>
      <p v-else class="dim">尚未运行</p>
      <span v-if="run.status === 'running'" class="caret"></span>
    </div>

    <!--
      指标贴在列底，多列之间形成一条横向对比带。
      行数在所有列里保持一致（不适用的显示 —），否则并列时指标带会错位。
    -->
    <dl class="metrics">
      <div class="metric">
        <dt title="推理模型会先流式输出思考过程，这段等待也算在内">首字延迟</dt>
        <dd>{{ fmtMs(run.ttftMs) }}</dd>
      </div>
      <div class="metric">
        <dt>总耗时</dt>
        <dd>{{ fmtMs(run.wallMs) }}</dd>
      </div>

      <div class="metric">
        <dt title="从开始流式返回到正文出现之间的时间">思考耗时</dt>
        <dd>{{ fmtMs(reasoningMs) }}</dd>
      </div>
      <div class="metric">
        <dt title="本次输出里用于思考的 token 数">思考 token</dt>
        <dd>{{ run.reasoningTokens ?? '—' }} <span class="dim">tok</span></dd>
      </div>

      <div class="metric">
        <dt>输入</dt>
        <dd>{{ run.promptTokens ?? '—' }} <span class="dim">tok</span></dd>
      </div>
      <div class="metric">
        <dt>输出</dt>
        <dd>{{ run.outputTokens ?? '—' }} <span class="dim">tok</span></dd>
      </div>

      <div class="metric">
        <dt title="输入 token 占该模型上下文窗口的比例，越小余量越大">上下文占用</dt>
        <dd>{{ fmtPercent(contextUsage) }}</dd>
      </div>
      <div class="metric">
        <dt>正文字数</dt>
        <dd>{{ run.text.length }}</dd>
      </div>

      <div class="metric cost-row">
        <dt title="按模型库标准档单价估算；有缓存明细时已区分命中与未命中">本次成本</dt>
        <dd class="cost">{{ fmtCost(run.costUsd) }}</dd>
      </div>
    </dl>

    <div class="speed">
      <div class="speed-head">
        <span class="speed-label">输出速度 <span class="dim">（估算）</span></span>
        <span class="speed-val">
          {{ run.tokensPerSec ?? '—' }}
          <span class="dim">tok/s</span>
        </span>
      </div>
      <div class="bar"><span class="bar-fill" :style="{ width: `${speedRatio}%` }"></span></div>
    </div>
  </article>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0; /* 关键：不设的话内部滚动区会被内容撑开，列高不齐 */
  overflow: hidden;
  border: 1px solid rgba(27, 20, 37, 0.1);
  border-radius: var(--radius);
  background: #fff;
}

/* ---- 头部 ---- */
.col-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid rgba(27, 20, 37, 0.08);
}

.name {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.05rem;
}

.n {
  overflow: hidden;
  font-size: 0.86rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.id {
  overflow: hidden;
  color: var(--ink-dim);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  flex-shrink: 0;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(27, 20, 37, 0.06);
  color: var(--ink-dim);
  font-size: 0.7rem;
}

.status.running {
  background: var(--accent-soft);
  color: var(--accent);
}

.status.done {
  background: rgba(34, 160, 90, 0.12);
  color: #1c7a45;
}

.status.error {
  background: rgba(217, 58, 86, 0.12);
  color: var(--danger);
}

/* ---- 截断 / 审核提示 ---- */
.flag {
  flex-shrink: 0;
  margin: 0.5rem 0.85rem 0;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.74rem;
  line-height: 1.6;
}

.flag.warn {
  border: 1px solid rgba(196, 158, 42, 0.5);
  background: rgba(214, 176, 60, 0.18);
  color: #6f5a10;
}

/* ---- 思考过程 ---- */
.reasoning {
  flex-shrink: 0;
  padding: 0.45rem 0.85rem 0;
}

.reasoning-toggle {
  padding: 0.22rem 0.6rem;
  border: 1px dashed rgba(27, 20, 37, 0.22);
  border-radius: 999px;
  background: transparent;
  color: var(--ink-dim);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
}

.reasoning-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.reasoning-body {
  max-height: 9rem;
  margin: 0.4rem 0 0;
  padding: 0.5rem 0.6rem;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.04);
  color: var(--ink-dim);
  font-family: inherit;
  font-size: 0.74rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---- 正文：占满剩余高度 ---- */
.body {
  flex: 1;
  min-height: 6rem;
  margin: 0.6rem 0.85rem;
  padding: 0.6rem 0.7rem;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  background: rgba(27, 20, 37, 0.03);
  color: var(--ink);
  font-size: 0.84rem;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.body::-webkit-scrollbar {
  width: 6px;
}

.body::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgba(27, 20, 37, 0.16);
}

.body .dim {
  font-size: 0.8rem;
}

.err {
  margin: 0;
  color: var(--danger);
  font-size: 0.82rem;
}

.caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  margin-left: 2px;
  background: var(--accent);
  vertical-align: text-bottom;
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}

/* ---- 指标带 ---- */
.metrics {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1rem;
  margin: 0;
  padding: 0.6rem 0.85rem 0.2rem;
  border-top: 1px solid rgba(27, 20, 37, 0.08);
  background: rgba(27, 20, 37, 0.015);
}

.metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.22rem 0;
}

.metric dt {
  color: var(--ink-dim);
  font-size: 0.72rem;
  white-space: nowrap;
}

.metric dd {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 650;
  white-space: nowrap;
}

/* 成本单独占一行 —— 它是选型时最常被扫的一格 */
.metric.cost-row {
  grid-column: 1 / -1;
  margin-top: 0.15rem;
  padding-top: 0.4rem;
  border-top: 1px dashed rgba(27, 20, 37, 0.1);
}

.metric dd.cost {
  color: var(--accent);
  font-size: 0.92rem;
}

.dim {
  color: var(--ink-dim);
  font-size: 0.68rem;
  font-weight: 400;
}

/* ---- 速度条 ---- */
.speed {
  flex-shrink: 0;
  padding: 0.3rem 0.85rem 0.7rem;
  background: rgba(27, 20, 37, 0.015);
}

.speed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.28rem;
}

.speed-label {
  color: var(--ink-dim);
  font-size: 0.72rem;
}

.speed-val {
  color: var(--accent);
  font-size: 0.88rem;
  font-weight: 700;
}

.bar {
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(27, 20, 37, 0.07);
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.3s var(--ease);
}
</style>
