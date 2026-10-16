/**
 * Agent 产品库与选型推荐接口（对应 server/routes/agents.js 与 recommend.js）。
 *
 * 数据同样来自 MySQL 知识库，只是读的是 Agent 侧那 6 张表（migration_08）。
 */
import { API_BASE } from '@/config'

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
    throw new Error(`接口返回 ${res.status}：${detail}`)
  }

  return res.json()
}

/** Agent 产品列表（规格 + 能力四态计数） */
export function fetchAgents() {
  return request('/agents')
}

/** 能力矩阵：字典 + 全量单元格（含溯源），前端筛选纯本地切换 */
export function fetchAgentMatrix() {
  return request('/agents/matrix')
}

/** 单个 Agent 详情：规格 + 能力 + 可接模型 + 人群适配 */
export function fetchAgentDetail(id) {
  return request(`/agents/${encodeURIComponent(id)}`)
}

/** 反查桥表：这个模型能被哪些 Agent 用 */
export function fetchAgentsByModel(modelVersionId) {
  return request(`/agents/by-model/${encodeURIComponent(modelVersionId)}`)
}

/** 人群列表（推荐页的入口） */
export function fetchRecommendPersonas() {
  return request('/recommend/personas')
}

/** 某个人群的推荐结果：Agent 评估 + 模型打分 + 口径说明 */
export function fetchRecommendation(personaCode) {
  return request(`/recommend?persona=${encodeURIComponent(personaCode)}`)
}
