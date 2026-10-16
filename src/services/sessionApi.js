/**
 * 会话存储服务的前端封装（对应 server/index.js 的 /api/sessions）。
 * 将来换成真正的数据库时，只需要改这个文件里的实现。
 */
import { SESSION_API_BASE } from '@/config'

/**
 * 把「后端没启动」翻译成能直接照做的提示。
 * 502/504 是 Vite 代理转发失败的特征：请求发出去了，但 3001 上没有服务在听。
 * 直接把这句 Bad Gateway 抛给用户等于没说。
 */
function describeFailure(status, detail) {
  if (status === 502 || status === 504) {
    return (
      '会话服务没有启动。请另开一个终端在项目目录运行 npm run server；' +
      '或者直接用 npm run dev:all，一条命令同时启动前后端。'
    )
  }
  return `会话服务返回 ${status}：${detail}`
}

async function request(url, options) {
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error('连不上会话服务。请确认它正在运行（npm run server）。')
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      /* 后端没返回 JSON，就用状态文本 */
    }
    throw new Error(describeFailure(res.status, detail))
  }

  return res.status === 204 ? null : res.json()
}

/** 会话摘要列表，按时间倒序 */
export function listSessions() {
  return request(`${SESSION_API_BASE}/sessions`)
}

/** 读取单个会话的完整内容 */
export function loadSession(id) {
  return request(`${SESSION_API_BASE}/sessions/${encodeURIComponent(id)}`)
}

/**
 * 保存会话（不存在则创建）。
 * 不传 title：后端会保留已有标题，所以保存消息不会把重命名结果冲掉。
 */
export function saveSession({ id, nickname, character, messages }) {
  return request(`${SESSION_API_BASE}/sessions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, character, messages }),
  })
}

/** 只改标题，不碰消息 */
export function renameSession(id, title) {
  return request(`${SESSION_API_BASE}/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

/** 删除会话 */
export function deleteSession(id) {
  return request(`${SESSION_API_BASE}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
