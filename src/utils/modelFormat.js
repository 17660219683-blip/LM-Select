/**
 * 模型库的文案与格式化。列表和详情抽屉共用，避免两边显示规则不一致。
 */

export const TYPE_LABEL = {
  chat: '对话',
  reasoning: '推理',
  coder: '编程',
  vision: '视觉',
  omni: '全模态',
  decision: '决策',
  embedding: '向量',
  rerank: '重排',
  audio: '语音',
  image: '图像',
  video: '视频',
}

export const STATUS_LABEL = {
  ga: '在售',
  preview: '预览',
  deprecated: '弃用',
  retired: '已下线',
}

export const OPENNESS_LABEL = {
  closed_api: '仅 API',
  open_weights: '开放权重',
  both: 'API + 权重',
  unknown: '未核实',
}

export function typeLabel(code) {
  return TYPE_LABEL[code] ?? code
}

export function statusLabel(code) {
  return STATUS_LABEL[code] ?? code
}

export function opennessLabel(code) {
  return OPENNESS_LABEL[code] ?? code
}

/** 上下文窗口：1050000 -> 1.05M，262144 -> 262K */
export function fmtContext(v) {
  if (v === null || v === undefined) return '—'
  if (v >= 1_000_000) {
    const n = v / 1_000_000
    return `${Number.isInteger(n) ? n : n.toFixed(2)}M`
  }
  if (v >= 1000) return `${Math.round(v / 1000)}K`
  return String(v)
}

/**
 * 美元价。
 * 小数值必须多留几位 —— 豆包 Mini 的输出价是 $0.298，
 * 用两位小数会显示成 $0.30，而 GPT-6 Astra 是 $50.00，两者量级差 170 倍。
 */
export function fmtUsd(v) {
  if (v === null || v === undefined) return '—'
  if (v === 0) return '免费'

  const abs = Math.abs(v)
  if (abs < 0.01) return `$${v.toFixed(4)}`
  if (abs < 1) return `$${v.toFixed(3)}`
  if (abs < 100) return `$${v.toFixed(2)}`
  return `$${v.toFixed(0)}`
}

/** 原币种价，用于在美元价旁边标出厂商实际计价 */
export function fmtNative(v, currency) {
  if (v === null || v === undefined || !currency) return null
  if (v === 0) return '免费'

  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${v.toFixed(Math.abs(v) < 1 ? 3 : 2)}`
}

/** 原币种是否与美元不同，决定要不要显示副标题 */
export function isForeignCurrency(currency) {
  return Boolean(currency) && currency !== 'USD'
}

/**
 * 三态能力。
 * null 是"未收集"，绝不能显示成"不支持" —— 那是在替厂商下结论。
 */
export function triLabel(v) {
  if (v === null || v === undefined) return '未收集'
  return v ? '支持' : '不支持'
}

/** 三态能力的样式类，未收集用灰、支持用绿、不支持用红 */
export function triTone(v) {
  if (v === null || v === undefined) return 'unknown'
  return v ? 'yes' : 'no'
}
