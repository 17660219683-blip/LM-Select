/**
 * Agent 产品库查询 API（对应 migration_08_agent.sql 建的 6 张表）。
 *
 * 与 /api/models 的关系：模型库回答「这个模型怎么样」，
 * 这里回答「这个 Agent 是什么形态、能干什么、能接哪些模型」。
 * 两套数据经 agent_model_support 桥接，本路由的 /agents/by-model/:id
 * 就是桥的反查方向（模型详情页「哪些 Agent 能跑它」）。
 *
 * 三态原则在这里的体现：
 *   - 能力只有四态（supported/partial/unsupported/unknown），接口原样透出，
 *     不在服务端把 unknown 合并成 unsupported —— 怎么展示是前端的事，
 *     数据完整性不能在传输层丢掉。
 *   - 每个字段尽量带 verified_at / confidence / source，「这句话是什么时候、
 *     根据什么写的」和「这句话本身」同等重要。
 */
import { Router } from 'express'

import { pool } from '../db.js'

const router = Router()

/* ------------------------------------------------------------------ */
/* 共用查询片段                                                         */
/* ------------------------------------------------------------------ */

/** 产品规格列：列表 / 详情 / 矩阵三处共用，保证字段口径只有一处定义 */
const AGENT_COLUMNS = `
  a.id, a.code, a.name, a.vendor_label, a.homepage,
  a.surfaces, a.platforms,
  a.runtime_locality, a.workspace_model, a.concurrency,
  a.permission_model, a.model_binding, a.pricing_model,
  a.maturity, a.data_residency,
  a.self_hostable, a.open_source, a.license_name, a.version_label,
  a.verified_at, a.caveats, a.notes, a.sort_order,
  COALESCE(s.title, s.publisher) AS source_name, s.url AS source_url
`

const AGENT_FROM = `
  FROM agent_product a
  LEFT JOIN source s ON s.id = a.source_id
`

/** JSON 列在 mysql2 下多半已解析成对象，但驱动版本不同可能给字符串，两种情况都兼容 */
function parseJsonArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** NULL 是「未采集」，和 false 不是一回事 */
function tri(value) {
  return value === null || value === undefined ? null : Boolean(value)
}

function toAgent(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    vendorLabel: row.vendor_label,
    homepage: row.homepage,
    surfaces: parseJsonArray(row.surfaces),
    platforms: parseJsonArray(row.platforms),
    runtimeLocality: row.runtime_locality,
    workspaceModel: row.workspace_model,
    concurrency: row.concurrency,
    permissionModel: row.permission_model,
    modelBinding: row.model_binding,
    pricingModel: row.pricing_model,
    maturity: row.maturity,
    dataResidency: row.data_residency,
    selfHostable: tri(row.self_hostable),
    openSource: tri(row.open_source),
    licenseName: row.license_name,
    versionLabel: row.version_label,
    verifiedAt: row.verified_at,
    caveats: row.caveats ?? '',
    notes: row.notes ?? '',
    source: row.source_name
      ? { name: row.source_name, url: row.source_url ?? null }
      : null,
  }
}

/* ------------------------------------------------------------------ */
/* 产品列表                                                             */
/* ------------------------------------------------------------------ */

router.get('/agents', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${AGENT_COLUMNS} ${AGENT_FROM} ORDER BY a.sort_order, a.id`,
    )

    // 每个产品的能力四态计数：列表页用来一眼看出「这款查得有多全」
    const [counts] = await pool.query(`
      SELECT agent_id,
             SUM(state = 'supported')   AS supported,
             SUM(state = 'partial')     AS partial,
             SUM(state = 'unsupported') AS unsupported,
             SUM(state = 'unknown')     AS unknown
        FROM agent_capability_state
       GROUP BY agent_id
    `)
    const countByAgent = new Map(counts.map((c) => [c.agent_id, c]))

    res.json({
      total: rows.length,
      items: rows.map((r) => ({
        ...toAgent(r),
        capabilityCounts: countByAgent.get(r.id) ?? null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 能力矩阵                                                             */
/* ------------------------------------------------------------------ */

/**
 * 能力字典 × 产品 的全量矩阵。
 * 一次返回整张表而不是按单元格查：25×3 的数据量很小，
 * 换来前端筛选开关（只看有区分度 / 隐藏未采集）可以纯本地切换，不发请求。
 */
router.get('/agents/matrix', async (req, res, next) => {
  try {
    const [agents] = await pool.query(
      `SELECT ${AGENT_COLUMNS} ${AGENT_FROM} ORDER BY a.sort_order, a.id`,
    )

    const [caps] = await pool.query(`
      SELECT c.id, c.code, c.name, c.category, c.description, c.why_it_matters,
             c.sort_order,
             sp.n_supported, sp.n_partial, sp.n_unsupported, sp.n_unknown
        FROM agent_capability c
        LEFT JOIN v_agent_capability_spread sp ON sp.capability_id = c.id
       ORDER BY c.sort_order, c.id
    `)

    const [states] = await pool.query(`
      SELECT s.agent_id, s.capability_id, s.state, s.detail,
             s.confidence, s.verified_at,
             COALESCE(src.title, src.publisher) AS source_name, src.url AS source_url
        FROM agent_capability_state s
        LEFT JOIN source src ON src.id = s.source_id
    `)

    // (agentId, capabilityId) -> 事实；前端按键直取，不用每次 filter
    const cellMap = {}
    for (const s of states) {
      cellMap[`${s.agent_id}:${s.capability_id}`] = {
        state: s.state,
        detail: s.detail ?? '',
        confidence: s.confidence,
        verifiedAt: s.verified_at,
        source: s.source_name
          ? { name: s.source_name, url: s.source_url ?? null }
          : null,
      }
    }

    res.json({
      agents: agents.map(toAgent),
      capabilities: caps.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        category: c.category,
        description: c.description ?? '',
        whyItMatters: c.why_it_matters ?? '',
        // 区分度计数来自视图；NULL 说明这个能力还没人录过任何事实
        spread: {
          supported: c.n_supported ?? 0,
          partial: c.n_partial ?? 0,
          unsupported: c.n_unsupported ?? 0,
          unknown: c.n_unknown ?? 0,
        },
      })),
      cells: cellMap,
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 单个产品详情                                                         */
/* ------------------------------------------------------------------ */

router.get('/agents/by-model/:modelVersionId', async (req, res, next) => {
  try {
    const mvId = Number(req.params.modelVersionId)
    if (!Number.isInteger(mvId) || mvId <= 0) {
      return res.status(400).json({ error: 'invalid model version id' })
    }

    /*
      反查桥表：这个模型能被哪些 Agent 用。
      model_version_id 为 NULL 的行是「支持某类接入但没点名具体模型」，
      那种行不能在这里匹配 —— 否则会得出「它支持所有模型」的假结论。
    */
    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.name, ams.binding, ams.note, ams.verified_at
         FROM agent_model_support ams
         JOIN agent_product a ON a.id = ams.agent_id
        WHERE ams.model_version_id = ?
        ORDER BY a.sort_order, a.id`,
      [mvId],
    )

    res.json({
      modelVersionId: mvId,
      items: rows.map((r) => ({
        agentId: r.id,
        code: r.code,
        name: r.name,
        binding: r.binding,
        note: r.note ?? '',
        verifiedAt: r.verified_at,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/agents/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid agent id' })
    }

    const [rows] = await pool.query(
      `SELECT ${AGENT_COLUMNS} ${AGENT_FROM} WHERE a.id = ?`,
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'agent not found' })

    const [capRows] = await pool.query(
      `SELECT c.code, c.name, c.category, s.state, s.detail,
              s.confidence, s.verified_at,
              COALESCE(src.title, src.publisher) AS source_name
         FROM agent_capability_state s
         JOIN agent_capability c ON c.id = s.capability_id
         LEFT JOIN source src ON src.id = s.source_id
        WHERE s.agent_id = ?
        ORDER BY c.sort_order, c.id`,
      [id],
    )

    // 可接模型：点名的具体型号在前，「只说了支持某类接入」的兜底行在后
    const [modelRows] = await pool.query(
      `SELECT ams.binding, ams.note, ams.verified_at,
              mv.id AS model_version_id, mv.display_name, mv.api_model_id
         FROM agent_model_support ams
         LEFT JOIN model_version mv ON mv.id = ams.model_version_id
        WHERE ams.agent_id = ?
        ORDER BY (ams.model_version_id IS NULL), mv.display_name`,
      [id],
    )

    const [fitRows] = await pool.query(
      `SELECT p.code AS persona_code, p.name AS persona_name,
              f.fit_level, f.reason
         FROM agent_persona_fit f
         JOIN persona p ON p.id = f.persona_id
        WHERE f.agent_id = ?
        ORDER BY p.sort_order`,
      [id],
    )

    res.json({
      ...toAgent(rows[0]),
      capabilities: capRows.map((c) => ({
        code: c.code,
        name: c.name,
        category: c.category,
        state: c.state,
        detail: c.detail ?? '',
        confidence: c.confidence,
        verifiedAt: c.verified_at,
        sourceName: c.source_name ?? null,
      })),
      modelSupport: modelRows.map((m) => ({
        binding: m.binding,
        note: m.note ?? '',
        verifiedAt: m.verified_at,
        model: m.model_version_id
          ? {
              id: m.model_version_id,
              displayName: m.display_name,
              apiModelId: m.api_model_id,
            }
          : null,
      })),
      personaFit: fitRows.map((f) => ({
        personaCode: f.persona_code,
        personaName: f.persona_name,
        fitLevel: f.fit_level,
        reason: f.reason,
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
