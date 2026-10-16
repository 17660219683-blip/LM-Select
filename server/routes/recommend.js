/**
 * 选型推荐 API。
 *
 * 这是题目里「推荐」两个字的落点。设计刻意保持「规则可解释、结论可溯源」，
 * 不上机器学习 —— 本科毕设里一个说不清的模型，不如一套能逐条讲理的规则。
 *
 * 两条主线的口径：
 *
 *   Agent 侧：优先用 agent_persona_fit 的人工评估（fit_level + reason）；
 *   该人群没录评估时，退回「按硬门槛推导」，并在 mode 字段里明说 ——
 *   推导结果和人工评估不能混着展示，否则答辩说不清哪个是哪个。
 *
 *   模型侧：persona.hard_gates 做门槛过滤，剩下的按可得维度加权打分。
 *   两条铁律（都是模型侧踩过的坑）：
 *     1. 三态字段为 NULL 是「未采集」，不能让门槛把它当成「不支持」过滤掉 ——
 *        放行，但在 gateFlags 里标记 unknown，让看的人自己判断。
 *     2. 没数据的维度（基准分、模型-人群适配）不参与加权，权重在
 *        「实际可用维度」上重新归一 —— 缺数据就明说缺，绝不用 0 分冒充。
 */
import { Router } from 'express'

import { pool } from '../db.js'
import { PRICE_SUBQUERY } from './models.js'

const router = Router()

/* ------------------------------------------------------------------ */
/* 人群列表                                                             */
/* ------------------------------------------------------------------ */

router.get('/recommend/personas', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, name, summary, budget_level, needs, hard_gates
         FROM persona ORDER BY sort_order, id`,
    )
    res.json({
      items: rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        summary: p.summary ?? '',
        budgetLevel: p.budget_level,
        needs: parseJson(p.needs) ?? [],
        hardGates: parseJson(p.hard_gates) ?? {},
      })),
    })
  } catch (err) {
    next(err)
  }
})

function parseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* 模型侧：门槛定义                                                     */
/* ------------------------------------------------------------------ */

/*
  每个门槛三部分：
    verifiable —— 这个门槛有没有数据可以校验。没有的（如「免费额度」根本没采集）
                 不能假装过滤了，要在页面上摆出「无法校验」。
    check(row) —— 返回 true(通过) / false(不通过) / null(该模型此项未采集)。
    describe(value) —— 把 hard_gates 里的原始值翻译成人话。
*/
const MODEL_GATES = {
  need_self_host: {
    label: '可私有化部署',
    verifiable: true,
    describe: () => '要求支持私有化部署',
    check: (m) => (m.supports_self_host === null ? null : m.supports_self_host === 1),
  },
  min_context_window: {
    label: '上下文长度下限',
    verifiable: true,
    describe: (v) => `上下文窗口 ≥ ${Number(v).toLocaleString()} tokens`,
    check: (m, v) => (m.context_window === null ? null : m.context_window >= v),
  },
  max_output_price: {
    label: '输出价格上限',
    verifiable: true,
    describe: (v) => `输出价格 ≤ $${v} / 1M tokens`,
    check: (m, v) => (m.output_usd === null ? null : m.output_usd <= v),
  },
  need_open_weights: {
    label: '开放权重',
    verifiable: true,
    describe: () => '要求开放权重（可下载自部署）',
    // openness: both=权重与 API 都开放；unknown 按未采集处理
    check: (m) => (m.openness === 'unknown' ? null : m.openness === 'both'),
  },
  need_batch_api: {
    label: '批量 API',
    verifiable: true,
    describe: () => '要求提供批量（batch）计价档',
    // 价格表里 variant='batch' 存在即支持；没有价格行时按未采集放行
    check: (m) => (m.has_any_price === 0 ? null : m.has_batch === 1),
  },
  need_structured_output: {
    label: '结构化输出',
    verifiable: true,
    describe: () => '要求支持结构化输出',
    // 能力清单存在 extra.capabilities 里；extra 为空按未采集放行
    check: (m) =>
      m.capabilities === null ? null : m.capabilities.some((c) => String(c).includes('结构化输出')),
  },
  /* ---- 以下门槛没有对应数据，如实标注「无法校验」 ---- */
  need_free_tier: {
    label: '免费额度',
    verifiable: false,
    describe: () => '要求有免费可用额度（本库未采集免费额度数据）',
  },
  need_enterprise_support: {
    label: '企业级支持',
    verifiable: false,
    describe: () => '要求企业级 SLA 与技术支持（本库未采集该数据）',
  },
  max_min_vram_gb: {
    label: '本地显存上限',
    verifiable: false,
    describe: (v) =>
      `本地部署显存 ≤ ${v} GB（deployment_requirement 表尚未采集，无法校验）`,
  },
}

/* ------------------------------------------------------------------ */
/* 模型侧：打分                                                         */
/* ------------------------------------------------------------------ */

/*
  权重按预算等级分档：预算是人群表里唯一对「价格该多重要」的直接信号。
  权重会随响应返回并在页面上展示 —— 不透明的权重等于没有结论。
*/
const WEIGHTS_BY_BUDGET = {
  zero: { price: 0.45, context: 0.2, capability: 0.25, maturity: 0.1 },
  low: { price: 0.4, context: 0.2, capability: 0.25, maturity: 0.15 },
  medium: { price: 0.3, context: 0.25, capability: 0.25, maturity: 0.2 },
  high: { price: 0.15, context: 0.3, capability: 0.35, maturity: 0.2 },
  any: { price: 0.25, context: 0.25, capability: 0.3, maturity: 0.2 },
}

const DIMENSION_LABELS = {
  price: '价格',
  context: '上下文',
  capability: '能力',
  maturity: '成熟度',
}

/** 各维度 0~100 分；数据缺失返回 null（该维度弃权，权重重新归一） */
function scoreDimensions(m, priceRange) {
  const dims = {}

  if (m.output_usd === null || !priceRange) {
    dims.price = null
  } else {
    const { min, max } = priceRange
    dims.price = max === min ? 100 : Math.round(100 * (1 - (m.output_usd - min) / (max - min)))
  }

  if (m.context_window === null) {
    dims.context = null
  } else {
    // 对数刻度：32k→128k 的差距和 128k→1M 的差距在体验上不是线性关系
    const LOG_MIN = Math.log2(8192)
    const LOG_MAX = Math.log2(1048576)
    const v = Math.min(Math.max(Math.log2(m.context_window), LOG_MIN), LOG_MAX)
    dims.context = Math.round((100 * (v - LOG_MIN)) / (LOG_MAX - LOG_MIN))
  }

  // 能力分 = 三个已采集标志位的均值；全未采集才弃权
  const flags = [
    m.supports_tool_call === null ? null : m.supports_tool_call === 1,
    m.supports_vision === null ? null : m.supports_vision === 1,
    m.reasoning_mode ? true : null,
  ].filter((f) => f !== null)
  dims.capability = flags.length
    ? Math.round((100 * flags.filter(Boolean).length) / flags.length)
    : null

  dims.maturity = m.status === 'ga' ? 100 : m.status === 'preview' ? 50 : null

  return dims
}

/* ------------------------------------------------------------------ */
/* Agent 侧                                                             */
/* ------------------------------------------------------------------ */

/** 各人群最该看的 Agent 能力：推荐卡片上只展示这几项，25 项全摆出来反而读不动 */
const PERSONA_KEY_CAPS = {
  regulated: ['self_host', 'compliance_cert', 'sandbox_isolation', 'high_risk_block'],
  engineer: ['shell_exec', 'file_write', 'git_worktree', 'trajectory_replay'],
  agent_builder: ['subagent', 'mcp_support', 'plugin_system', 'scheduled_task'],
  local_hobbyist: ['local_model', 'self_host', 'usage_meter'],
  enterprise: ['self_host', 'compliance_cert', 'parallel_sessions', 'cross_session_memory'],
}
const DEFAULT_KEY_CAPS = ['self_host', 'model_switch', 'scheduled_task', 'usage_meter']

const FIT_RANK = { best: 3, good: 2, ok: 1, poor: 0 }
const FIT_LABELS = { best: '强烈推荐', good: '推荐', ok: '可用', poor: '不推荐' }

/* ------------------------------------------------------------------ */
/* 推荐主接口                                                           */
/* ------------------------------------------------------------------ */

router.get('/recommend', async (req, res, next) => {
  try {
    const personaCode = String(req.query.persona ?? '')
    if (!personaCode) return res.status(400).json({ error: 'missing persona' })

    const [personaRows] = await pool.query(
      `SELECT id, code, name, summary, budget_level, needs, hard_gates
         FROM persona WHERE code = ?`,
      [personaCode],
    )
    if (!personaRows.length) return res.status(404).json({ error: 'persona not found' })
    const p = personaRows[0]
    const persona = {
      id: p.id,
      code: p.code,
      name: p.name,
      summary: p.summary ?? '',
      budgetLevel: p.budget_level,
      needs: parseJson(p.needs) ?? [],
      hardGates: parseJson(p.hard_gates) ?? {},
    }

    /* ---------------- Agent 侧 ---------------- */

    const [agents] = await pool.query(
      `SELECT a.id, a.code, a.name, a.homepage, a.maturity, a.self_hostable,
              a.runtime_locality, a.model_binding, a.caveats
         FROM agent_product a ORDER BY a.sort_order, a.id`,
    )

    const [fitRows] = await pool.query(
      `SELECT agent_id, fit_level, reason FROM agent_persona_fit WHERE persona_id = ?`,
      [persona.id],
    )
    const fitByAgent = new Map(fitRows.map((f) => [f.agent_id, f]))

    // 关键能力状态（按人群挑出来的几项）
    const capCodes = PERSONA_KEY_CAPS[persona.code] ?? DEFAULT_KEY_CAPS
    const [capRows] = await pool.query(
      `SELECT s.agent_id, c.code, c.name, s.state, s.detail
         FROM agent_capability_state s
         JOIN agent_capability c ON c.id = s.capability_id
        WHERE c.code IN (${capCodes.map(() => '?').join(',')})`,
      capCodes,
    )
    const capsByAgent = new Map()
    for (const row of capRows) {
      if (!capsByAgent.has(row.agent_id)) capsByAgent.set(row.agent_id, [])
      capsByAgent.get(row.agent_id).push({
        code: row.code,
        name: row.name,
        state: row.state,
        detail: row.detail ?? '',
      })
    }

    const evaluated = fitRows.length > 0
    const agentItems = agents.map((a) => {
      const fit = fitByAgent.get(a.id)
      /*
        无人工评估时的兜底推导：唯一对 Agent 有意义的硬门槛是私有化部署。
        self_hostable 为 NULL 时不推导（未采集 ≠ 不支持）。
      */
      let derived = null
      if (!fit && persona.hardGates.need_self_host) {
        if (a.self_hostable === 1) derived = { pass: true, note: '按硬门槛推导：支持私有化部署' }
        else if (a.self_hostable === 0)
          derived = { pass: false, note: '按硬门槛推导：不支持私有化部署' }
      }
      return {
        agent: {
          id: a.id,
          code: a.code,
          name: a.name,
          homepage: a.homepage,
          maturity: a.maturity,
          runtimeLocality: a.runtime_locality,
          modelBinding: a.model_binding,
          caveats: a.caveats ?? '',
        },
        fitLevel: fit?.fit_level ?? null,
        fitLabel: fit ? FIT_LABELS[fit.fit_level] : null,
        reason: fit?.reason ?? '',
        derived,
        keyCapabilities: capsByAgent.get(a.id) ?? [],
      }
    })

    agentItems.sort((x, y) => {
      const fx = x.fitLevel ? FIT_RANK[x.fitLevel] : x.derived?.pass ? 0.5 : -1
      const fy = y.fitLevel ? FIT_RANK[y.fitLevel] : y.derived?.pass ? 0.5 : -1
      return fy - fx
    })

    /* ---------------- 模型侧 ---------------- */

    const gates = Object.entries(persona.hardGates)
      .filter(([key]) => MODEL_GATES[key])
      .map(([key, value]) => ({
        key,
        value,
        label: MODEL_GATES[key].label,
        verifiable: MODEL_GATES[key].verifiable,
        description: MODEL_GATES[key].describe(value),
      }))
    const verifiableGates = gates.filter((g) => g.verifiable)

    const [modelRows] = await pool.query(`
      SELECT mv.id, mv.display_name, mv.api_model_id, mv.status,
             mv.context_window, mv.openness, mv.reasoning_mode,
             mv.supports_vision, mv.supports_tool_call, mv.supports_self_host,
             mv.extra,
             v.name AS vendor_name, v.name_zh AS vendor_name_zh,
             pr.input_usd, pr.output_usd,
             EXISTS(SELECT 1 FROM model_price mp2
                     WHERE mp2.model_version_id = mv.id)              AS has_any_price,
             EXISTS(SELECT 1 FROM model_price mp3
                     WHERE mp3.model_version_id = mv.id
                       AND mp3.variant = 'batch')                     AS has_batch
        FROM model_version mv
        JOIN model_family mf ON mf.id = mv.family_id
        JOIN vendor       v  ON v.id  = mf.vendor_id
        LEFT JOIN (${PRICE_SUBQUERY}) pr ON pr.model_version_id = mv.id
       WHERE mv.status != 'retired'
    `)

    // 价格区间只在「通过门槛的候选集」上算 —— 全集里的极端值会把分压扁
    const candidates = []
    let filteredOut = 0
    for (const m of modelRows) {
      m.capabilities = parseCapabilities(m.extra)
      const gateFlags = verifiableGates.map((g) => ({
        key: g.key,
        label: g.label,
        result: gateResult(MODEL_GATES[g.key].check(m, g.value)),
      }))
      if (gateFlags.some((f) => f.result === 'fail')) {
        filteredOut += 1
        continue
      }
      candidates.push({ ...m, gateFlags })
    }

    const prices = candidates.map((c) => c.output_usd).filter((v) => v !== null)
    const priceRange = prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null

    const weights = WEIGHTS_BY_BUDGET[persona.budgetLevel] ?? WEIGHTS_BY_BUDGET.any

    const scored = candidates.map((m) => {
      const dims = scoreDimensions(m, priceRange)
      // 弃权维度不占权重：把它的权重按比例分给有数据的维度
      const available = Object.entries(dims).filter(([, s]) => s !== null)
      const weightSum = available.reduce((acc, [k]) => acc + weights[k], 0)
      const score = weightSum
        ? Math.round(
            available.reduce((acc, [k, s]) => acc + (weights[k] / weightSum) * s, 0),
          )
        : null
      return {
        id: m.id,
        displayName: m.display_name,
        apiModelId: m.api_model_id,
        vendorName: m.vendor_name_zh || m.vendor_name,
        status: m.status,
        contextWindow: m.context_window,
        outputUsd: m.output_usd,
        score,
        breakdown: Object.entries(dims).map(([k, s]) => ({
          dimension: k,
          label: DIMENSION_LABELS[k],
          weight: weights[k],
          score: s,
        })),
        gateFlags: m.gateFlags,
      }
    })

    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

    // 数据缺口：查出来是空的维度如实上报，不打分也不装不存在
    const [[gapCounts]] = await pool.query(`
      SELECT (SELECT COUNT(*) FROM model_benchmark_score) AS benchmark,
             (SELECT COUNT(*) FROM model_persona_fit)     AS persona_fit,
             (SELECT COUNT(*) FROM deployment_requirement) AS deployment
    `)
    const dataGaps = []
    if (!gapCounts.benchmark)
      dataGaps.push({ table: 'model_benchmark_score', message: '基准分未采集，未参与打分' })
    if (!gapCounts.persona_fit)
      dataGaps.push({ table: 'model_persona_fit', message: '模型-人群适配未采集，未参与打分' })
    if (!gapCounts.deployment)
      dataGaps.push({
        table: 'deployment_requirement',
        message: '部署资源需求未采集，显存类门槛无法校验',
      })

    res.json({
      persona,
      agents: {
        // evaluated=人工评估 / derived=按门槛推导，两种模式不能混着展示
        mode: evaluated ? 'evaluated' : 'derived',
        items: agentItems,
      },
      models: {
        gates,
        totalBefore: modelRows.length,
        filteredOut,
        passedCount: candidates.length,
        items: scored.slice(0, 10),
        dataGaps,
      },
      methodology: {
        weights,
        notes: [
          '门槛为 NULL（未采集）的模型按放行处理并单独标注，不按「不支持」过滤',
          '某维度无数据时该维度弃权，权重在可用维度上重新归一',
          '价格分在通过门槛的候选集内归一；上下文按对数刻度计分',
          'Agent 推荐优先人工评估；无评估人群按硬门槛推导并显式标注',
        ],
      },
    })
  } catch (err) {
    next(err)
  }
})

/** true/false → pass/fail；null（未采集）→ unknown，门槛不参与过滤 */
function gateResult(value) {
  return value === null ? 'unknown' : value ? 'pass' : 'fail'
}

function parseCapabilities(extra) {
  if (!extra) return null
  let obj = extra
  if (typeof extra === 'string') {
    try {
      obj = JSON.parse(extra)
    } catch {
      return null
    }
  }
  const caps = obj?.capabilities
  return Array.isArray(caps) ? caps : null
}

export default router
