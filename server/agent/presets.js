/**
 * 脚手架（scaffold）参数定义与预设。
 *
 * 这个文件是整个 agent 模块的地基，也是本项目的一个核心主张所在：
 *
 *   「agent 之间的差异，主要来自脚手架，而不是模型。」
 *
 * 要让这句话能被验证，脚手架就必须是**显式、可枚举、可调**的参数，
 * 而不是散落在循环各处的魔法值。所以这里把参数集中定义一次，
 * 循环、提示词、审批、UI 全部读同一份定义。
 *
 * ⚠️ 关于预设的诚实声明：
 * 下面的预设是**行为近似**，不是任何厂商产品的原版实现。
 * 厂商的脚手架是闭源的，这些配置来自公开文档与可观测行为。
 * 因此界面上必须标明"近似 XX 的行为特征"，不能冒充原产品。
 */

/**
 * 参数定义。
 * options 里每项含 value / label / hint，前端"可展开调参"直接渲染它，
 * 不必再维护一份 UI 侧的文案。
 */
export const PARAM_DEFS = [
  {
    key: 'planning',
    label: '规划方式',
    hint: '先复述目标与计划再动手，还是边做边想',
    options: [
      { value: 'react', label: '边做边想', hint: '直接开始，不先给计划' },
      { value: 'plan-first', label: '先规划', hint: '先复述目标、列出步骤，再执行' },
    ],
  },
  {
    key: 'approval',
    label: '人工确认',
    hint: '哪些操作要先问过用户。这是各家 agent 最明显的分水岭',
    options: [
      { value: 'never', label: '从不确认', hint: '全自动跑完（任务委托型）' },
      { value: 'on-destructive', label: '仅破坏性操作', hint: '覆盖已有文件等才问' },
      { value: 'on-write', label: '写入前确认', hint: '每次写文件都问（强确认型）' },
      { value: 'always', label: '每步都确认', hint: '每个工具调用都问' },
    ],
  },
  {
    key: 'guard',
    label: '危险拦截',
    hint: '不问人、直接拒绝的操作。与「人工确认」分工不同：拦截是确定危险（路径越界、非法文件名），确认是合法但有风险（覆盖已有文件）',
    options: [
      { value: 'none', label: '不拦截', hint: '不做额外检查' },
      {
        value: 'block-destructive',
        label: '拦截越界写入',
        hint: '路径越界、非法文件名一律拒绝；覆盖已有文件交给「人工确认」处理',
      },
    ],
  },
  {
    key: 'verify',
    label: '自检',
    hint: '写完之后是否要求模型回头读一遍确认',
    options: [
      { value: 'none', label: '不校验', hint: '写完即结束' },
      { value: 'self-check', label: '写完自检', hint: '要求重新读回并核对' },
    ],
  },
  {
    key: 'onToolError',
    label: '工具失败处理',
    hint: '工具报错后怎么办。agent 的成色往往在失败时才显出来',
    options: [
      { value: 'retry', label: '重试', hint: '原样重试，次数由下面控制' },
      { value: 'replan', label: '重新规划', hint: '把错误喂回模型，让它换个做法' },
      { value: 'continue', label: '忽略继续', hint: '错误照样往下走' },
    ],
  },
  {
    key: 'contextStrategy',
    label: '上下文策略',
    hint: '多轮之后历史消息怎么处理',
    options: [
      { value: 'full', label: '全量保留', hint: '不裁剪，token 消耗更大' },
      { value: 'sliding', label: '滑动窗口', hint: '只保留最近若干轮' },
    ],
  },
  {
    key: 'maxSteps',
    label: '最大步数',
    type: 'number',
    min: 1,
    max: 30,
    hint: '防止无限循环。撞上这个上限本身就是一条可对比的信息',
  },
  {
    key: 'maxRetries',
    label: '重试次数',
    type: 'number',
    min: 0,
    max: 5,
    hint: '同一个工具连续失败几次后放弃',
  },
  {
    key: 'maxSeconds',
    label: '时长上限（秒）',
    type: 'number',
    min: 30,
    max: 600,
    hint: '超时即中止，避免一次运行挂太久',
  },
  {
    key: 'maxCostUsd',
    label: '成本上限（美元）',
    type: 'number',
    min: 0.001,
    max: 5,
    step: 0.001,
    hint: '累计估算成本超过即中止',
  },
]

/** 所有参数的合法取值，用于校验前端传来的配置 */
export const PARAM_VALUES = Object.fromEntries(
  PARAM_DEFS.filter((d) => d.options).map((d) => [d.key, d.options.map((o) => o.value)]),
)

/** 数值参数的边界 */
export const PARAM_RANGES = Object.fromEntries(
  PARAM_DEFS.filter((d) => d.type === 'number').map((d) => [
    d.key,
    { min: d.min, max: d.max, step: d.step ?? 1 },
  ]),
)

export const DEFAULT_CONFIG = {
  planning: 'react',
  approval: 'never',
  guard: 'none',
  verify: 'none',
  onToolError: 'replan',
  contextStrategy: 'full',
  maxSteps: 8,
  maxRetries: 2,
  maxSeconds: 180,
  maxCostUsd: 0.5,
}

/*
  预设。

  每组都在 note 里写清"近似谁的行为特征"——这个说明会一路带到界面上，
  避免生成一个看不出是近似的假产品。
*/
export const PRESETS = [
  {
    id: 'autonomous',
    name: '任务委托型',
    note: '近似 Manus 一类"交出去就不打断"的形态：自己跑完，中途不问你',
    config: {
      ...DEFAULT_CONFIG,
      planning: 'react',
      approval: 'never',
      guard: 'none',
      verify: 'none',
      maxSteps: 10,
    },
  },
  {
    id: 'strict',
    name: '强确认型',
    note: '近似 Kimi Work 一类"改文件前弹窗授权"的形态：能干活，但每一步写入都要你点头',
    config: {
      ...DEFAULT_CONFIG,
      planning: 'plan-first',
      approval: 'on-write',
      guard: 'block-destructive',
      verify: 'self-check',
      maxSteps: 12,
    },
  },
  {
    id: 'engineering',
    name: '工程型',
    note: '近似 Claude Code / Codex 一类"先读后改、改完自检"的形态：只拦破坏性操作，不打断常规写入',
    config: {
      ...DEFAULT_CONFIG,
      planning: 'plan-first',
      approval: 'on-destructive',
      guard: 'block-destructive',
      verify: 'self-check',
      onToolError: 'replan',
      maxSteps: 15,
    },
  },
]

/**
 * 把前端传来的配置收敛成一份合法配置。
 * 非法值一律回落到默认值，不抛错 —— 前端调参面板不该因为一个坏值就跑不起来。
 */
export function normalizeConfig(input) {
  const out = { ...DEFAULT_CONFIG }
  const src = input ?? {}

  for (const [key, allowed] of Object.entries(PARAM_VALUES)) {
    if (allowed.includes(src[key])) out[key] = src[key]
  }

  for (const [key, range] of Object.entries(PARAM_RANGES)) {
    const n = Number(src[key])
    if (Number.isFinite(n)) {
      out[key] = Math.min(range.max, Math.max(range.min, n))
    }
  }

  return out
}

/** 给前端用的定义（参数 + 预设） */
export function describeScaffold() {
  return { params: PARAM_DEFS, presets: PRESETS, defaults: DEFAULT_CONFIG }
}
