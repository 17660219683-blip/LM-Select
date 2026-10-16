/**
 * 模型库查询 API。
 *
 * 与 /api/sessions 那套 JSON 文件存储完全独立 —— 这里读的是 MySQL 里的模型知识库。
 * 会话数据将来要不要也搬进 MySQL，是另一件事，先不混在一起。
 */
import { Router } from 'express'

import { pool } from '../db.js'

const router = Router()

/**
 * 价格子查询：每个模型取一份「标准档 + 当前生效」的价格，折算成 USD。
 *
 * 拆成子查询而不是在外部 GROUP BY，有两个原因：
 *   1. 外部就不用再 GROUP BY 了，避免 ONLY_FULL_GROUP_BY 下要把一堆列都塞进 GROUP BY；
 *   2. 用 MIN 而不是 MAX —— 有上下文档分档的模型（OpenAI、豆包）取最短档的基准价，
 *      否则会把最贵的 Long 档当成"标价"，比价会失真。
 */
const PRICE_SUBQUERY = `
  SELECT mp.model_version_id,
         MIN(CASE WHEN i.code = 'input'      THEN u.price_usd END) AS input_usd,
         MIN(CASE WHEN i.code = 'output'     THEN u.price_usd END) AS output_usd,
         MIN(CASE WHEN i.code = 'cache_read' THEN u.price_usd END) AS cache_read_usd,
         MIN(CASE WHEN i.code = 'input'      THEN u.price_native END) AS input_native,
         MIN(CASE WHEN i.code = 'output'     THEN u.price_native END) AS output_native,
         MAX(u.currency) AS currency
    FROM model_price mp
    JOIN v_price_usd u ON u.id = mp.id
    JOIN price_item  i ON i.id = mp.price_item_id
   WHERE mp.variant = 'standard'
     AND (mp.effective_from IS NULL OR mp.effective_from <= CURDATE())
     AND (mp.effective_to   IS NULL OR mp.effective_to   >= CURDATE())
   GROUP BY mp.model_version_id
`

/*
  导出给 agent 路由复用。
  agent 循环要按同一口径算成本并执行成本上限，两边各写一份计价 SQL
  迟早会走偏 —— 而"口径一致"正是这个项目的立身之本。
*/
export { PRICE_SUBQUERY }

/** 列表与详情共用的列，保证两边字段完全一致 */
const MODEL_COLUMNS = `
  mv.id, mv.api_model_id, mv.display_name, mv.version_tag, mv.status,
  mv.model_type, mv.context_window, mv.max_output_tokens, mv.release_date,
  mv.knowledge_cutoff, mv.total_params_b, mv.active_params_b, mv.architecture,
  mv.openness, mv.supports_vision, mv.supports_tool_call,
  mv.supports_self_host, mv.supports_finetune, mv.reasoning_mode,
  mv.region_note, mv.weights_url, mv.doc_url, mv.notes, mv.extra,
  mv.data_status, mv.confidence,
  v.code AS vendor_code, v.name AS vendor_name, v.name_zh AS vendor_name_zh,
  v.cn_direct, v.homepage AS vendor_homepage,
  mf.name AS family_name, mf.positioning AS family_positioning,
  l.code AS license_code, l.name AS license_name,
  l.allows_commercial, l.allows_modify,
  pr.input_usd, pr.output_usd, pr.cache_read_usd,
  pr.input_native, pr.output_native, pr.currency
`

const MODEL_FROM = `
  FROM model_version mv
  JOIN model_family mf ON mf.id = mv.family_id
  JOIN vendor       v  ON v.id  = mf.vendor_id
  LEFT JOIN license l  ON l.id  = mv.license_id
  LEFT JOIN (${PRICE_SUBQUERY}) pr ON pr.model_version_id = mv.id
`

/** 数据库 NULL 是"未收集"，和 false 不是一回事，前端要能区分 */
function tri(value) {
  return value === null || value === undefined ? null : Boolean(value)
}

/** extra 列取 capabilities 数组；驱动版本不同可能给字符串，两种情况都兼容 */
function parseCapabilities(extra) {
  if (!extra) return []
  let obj = extra
  if (typeof extra === 'string') {
    try {
      obj = JSON.parse(extra)
    } catch {
      return []
    }
  }
  const caps = obj?.capabilities
  return Array.isArray(caps) ? caps : []
}

function toModel(row) {
  return {
    id: row.id,
    apiModelId: row.api_model_id,
    displayName: row.display_name,
    versionTag: row.version_tag,
    status: row.status,
    modelType: row.model_type,

    vendor: {
      code: row.vendor_code,
      name: row.vendor_name,
      nameZh: row.vendor_name_zh,
      cnDirect: Boolean(row.cn_direct),
      homepage: row.vendor_homepage ?? null,
    },
    family: row.family_name,
    familyPositioning: row.family_positioning,

    /*
      模型官网链接。
      优先用模型级 doc_url；没采集到就退回厂商官网 —— 链接立刻可用，
      不必等把 46 个模型的文档页都补齐。
    */
    officialUrl: row.doc_url || row.vendor_homepage || null,
    docUrl: row.doc_url ?? null,

    contextWindow: row.context_window,
    maxOutputTokens: row.max_output_tokens,
    releaseDate: row.release_date,
    knowledgeCutoff: row.knowledge_cutoff,
    totalParamsB: row.total_params_b,
    activeParamsB: row.active_params_b,
    architecture: row.architecture,
    reasoningMode: row.reasoning_mode,
    regionNote: row.region_note,
    weightsUrl: row.weights_url,

    openness: row.openness,
    supportsVision: tri(row.supports_vision),
    supportsToolCall: tri(row.supports_tool_call),
    supportsSelfHost: tri(row.supports_self_host),
    supportsFinetune: tri(row.supports_finetune),

    license: row.license_code
      ? {
          code: row.license_code,
          name: row.license_name,
          allowsCommercial: tri(row.allows_commercial),
          allowsModify: tri(row.allows_modify),
        }
      : null,

    capabilities: parseCapabilities(row.extra),

    price: {
      currency: row.currency ?? null,
      input: row.input_native,
      output: row.output_native,
      inputUsd: row.input_usd,
      outputUsd: row.output_usd,
      cacheReadUsd: row.cache_read_usd,
    },

    dataStatus: row.data_status,
    confidence: row.confidence,
    notes: row.notes ?? '',
  }
}

/** query 参数可能是 'a' 也可能是 ['a','b']，统一成数组 */
function toArray(value) {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

/* ------------------------------------------------------------------ */
/* 筛选项                                                              */
/* ------------------------------------------------------------------ */

router.get('/models/filters', async (req, res, next) => {
  try {
    const [vendors] = await pool.query(`
      SELECT v.code, v.name, v.name_zh, v.cn_direct,
             COUNT(mv.id) AS model_count
        FROM vendor v
        LEFT JOIN model_family  mf ON mf.vendor_id = v.id
        LEFT JOIN model_version mv ON mv.family_id = mf.id
       GROUP BY v.id, v.code, v.name, v.name_zh, v.cn_direct
       HAVING model_count > 0
       ORDER BY v.id
    `)

    const [types] = await pool.query(`
      SELECT model_type AS code, COUNT(*) AS model_count
        FROM model_version
       GROUP BY model_type
       ORDER BY model_count DESC
    `)

    const [statuses] = await pool.query(`
      SELECT status AS code, COUNT(*) AS model_count
        FROM model_version
       GROUP BY status
       ORDER BY model_count DESC
    `)

    const [licenses] = await pool.query(`
      SELECT l.code, l.name, l.allows_commercial, COUNT(mv.id) AS model_count
        FROM license l
        LEFT JOIN model_version mv ON mv.license_id = l.id
       GROUP BY l.id, l.code, l.name, l.allows_commercial
       HAVING model_count > 0
       ORDER BY model_count DESC
    `)

    res.json({
      vendors: vendors.map((r) => ({
        code: r.code,
        name: r.name,
        nameZh: r.name_zh,
        cnDirect: Boolean(r.cn_direct),
        count: r.model_count,
      })),
      types: types.map((r) => ({ code: r.code, count: r.model_count })),
      statuses: statuses.map((r) => ({ code: r.code, count: r.model_count })),
      licenses: licenses.map((r) => ({
        code: r.code,
        name: r.name,
        allowsCommercial: tri(r.allows_commercial),
        count: r.model_count,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 列表                                                                */
/* ------------------------------------------------------------------ */

router.get('/models', async (req, res, next) => {
  try {
    const where = []
    const params = []

    const vendors = toArray(req.query.vendor)
    if (vendors.length) {
      where.push(`v.code IN (${vendors.map(() => '?').join(',')})`)
      params.push(...vendors)
    }

    if (req.query.status && req.query.status !== 'all') {
      where.push('mv.status = ?')
      params.push(req.query.status)
    }

    const types = toArray(req.query.type)
    if (types.length) {
      where.push(`mv.model_type IN (${types.map(() => '?').join(',')})`)
      params.push(...types)
    }

    if (req.query.vision === '1' || req.query.vision === '0') {
      where.push('mv.supports_vision = ?')
      params.push(Number(req.query.vision))
    }

    if (req.query.selfHost === '1') where.push('mv.supports_self_host = 1')
    if (req.query.commercial === '1') where.push('l.allows_commercial = 1')

    if (req.query.minContext) {
      where.push('mv.context_window >= ?')
      params.push(Number(req.query.minContext))
    }

    if (req.query.maxOutputUsd) {
      where.push('pr.output_usd <= ?')
      params.push(Number(req.query.maxOutputUsd))
    }

    if (req.query.q) {
      const like = `%${req.query.q}%`
      where.push(`(
        mv.display_name LIKE ? OR mv.api_model_id LIKE ?
        OR v.name LIKE ? OR v.name_zh LIKE ? OR mf.name LIKE ?
      )`)
      params.push(like, like, like, like, like)
    }

    // 排序列必须白名单，不能直接拼用户输入
    const SORTS = {
      output_usd: 'pr.output_usd',
      input_usd: 'pr.input_usd',
      context: 'mv.context_window',
      release: 'mv.release_date',
      name: 'mv.display_name',
    }
    const sortCol = SORTS[req.query.sort] ?? SORTS.output_usd
    const dir = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    // 开头的 IS NULL 让"没有这个数据"的模型永远沉底，不会混在便宜档里冒充低价
    const orderBy = `${sortCol} IS NULL, ${sortCol} ${dir}, mv.display_name ASC`

    const sql = `
      SELECT ${MODEL_COLUMNS}
      ${MODEL_FROM}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${orderBy}
    `

    const [rows] = await pool.query(sql, params)

    res.json({
      total: rows.length,
      items: rows.map(toModel),
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* 详情                                                                */
/* ------------------------------------------------------------------ */

router.get('/models/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid model id' })
    }

    const [rows] = await pool.query(
      `SELECT ${MODEL_COLUMNS} ${MODEL_FROM} WHERE mv.id = ?`,
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'model not found' })

    // 全部价格点：不只标准档，缓存 / 批量 / 峰谷 / 各上下文档都要给出来
    const [priceRows] = await pool.query(
      `SELECT i.code AS item_code, i.name AS item_name, i.role AS item_role,
              mp.variant, mp.variant2, mp.unit,
              mp.price AS price_native, mp.currency,
              u.price_usd,
              mp.effective_from, mp.effective_to, mp.note
         FROM model_price mp
         JOIN price_item  i ON i.id = mp.price_item_id
         JOIN v_price_usd u ON u.id = mp.id
        WHERE mp.model_version_id = ?
        ORDER BY i.sort_order, mp.variant, mp.variant2, mp.effective_from`,
      [id],
    )

    res.json({
      ...toModel(rows[0]),
      prices: priceRows.map((r) => ({
        item: r.item_code,
        itemName: r.item_name,
        role: r.item_role,
        variant: r.variant,
        variant2: r.variant2,
        unit: r.unit,
        price: r.price_native,
        priceUsd: r.price_usd,
        currency: r.currency,
        effectiveFrom: r.effective_from,
        effectiveTo: r.effective_to,
        note: r.note,
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
