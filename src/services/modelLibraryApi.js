/**
 * 模型库接口（对应 server/routes/models.js）。
 *
 * 数据来自 MySQL 里的模型知识库，和 sessionApi.js 那套 JSON 会话存储互不相干，
 * 只是共用同一个 Express 服务和同一个 /api 前缀。
 */
import { API_BASE } from '@/config'

/**
 * 把筛选条件拼成查询串。
 * 空值一律不发 —— 后端靠「参数存在与否」判断是否加这个条件，
 * 发 ?vision='' 会被当成一个无效值而不是"不筛"。
 */
function toQuery(filters = {}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === false) continue

    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else {
      params.append(key, String(value))
    }
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function request(path) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`)
  } catch {
    throw new Error(
      '连不上后端服务。请确认它已启动（npm run server，或 npm run dev:all 一起起前后端）。',
    )
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      /* 后端没返回 JSON，就用状态文本 */
    }
    throw new Error(`模型库接口返回 ${res.status}：${detail}`)
  }

  return res.json()
}

/** 筛选项：厂商、类型、状态、许可，各自带模型数量 */
export function fetchModelFilters() {
  return request('/models/filters')
}

/** 模型列表，支持多维度筛选与排序 */
export function fetchModels(filters) {
  return request(`/models${toQuery(filters)}`)
}

/** 单个模型详情，含全部价格点（缓存 / 批量 / 峰谷 / 各上下文档） */
export function fetchModelDetail(id) {
  return request(`/models/${encodeURIComponent(id)}`)
}
