/**
 * 可试玩的 agent 目录。
 *
 * 每一条对应一个"界面复刻件"组件。加一家就补一条 + 一个复刻组件。
 *
 * ⚠️ 原则：**没有复刻件的不要放进来**。
 * 一个点开是空白或"敬请期待"的卡片，比没有这张卡片更糟 ——
 * 用户会以为是自己点错了，而不是这东西还没做。
 *
 * `site` 是官网地址，卡片底部会显示成一行外链。
 * 这些地址是逐个访问确认过的（2026-10-15），不是照印象填的：
 * 选型系统里一个失效的官网链接，比没有这个链接更丢分。
 * 另外 DeepSeek Harness 有一堆第三方包装站（dsh-desktop.com 之类，
 * 首页自己写着"independent community project, not an official product"），
 * 这里只填官方域 deepseek.com，不填那些。
 */
import { defineAsyncComponent } from 'vue'

export const AGENTS = [
  {
    id: 'deepseek-harness',
    name: 'deepseek HARNESS',
    vendor: 'DeepSeek',
    tagline: '桌面端智能体，左侧工作区文件树，对话与轨迹双视图，底部实时显示用量与上下文占用',
    /** 用于卡片角标，说明这个形态跑在哪里 */
    form: '本地桌面',
    /**
     * 卡片图标。用完整应用图标（自带圆角底色），不再另加一层白底方块 ——
     * 那会变成"图标套方块"，多一层没必要的边。
     */
    iconSrc: '/logos/deepseek-harness.png',
    site: 'https://www.deepseek.com/harness',
    component: defineAsyncComponent(
      () => import('@/components/harness/DeepseekHarness.vue'),
    ),
  },
  {
    id: 'codex',
    name: 'ChatGPT Codex',
    vendor: 'OpenAI',
    tagline: '桌面端智能体，左侧会话与项目导航，居中输入框，支持定时任务、插件与 Git 工作树',
    form: '本地桌面',
    iconSrc: '/logos/codex.png',
    site: 'https://openai.com/codex/',
    component: defineAsyncComponent(
      () => import('@/components/codex/CodexDesktop.vue'),
    ),
  },
  {
    id: 'workbuddy',
    name: 'WorkBuddy AI',
    vendor: 'WorkBuddy',
    tagline: '桌面端个人助理，任务 / 助理 / 定时任务 / 资料库四视图，带积分体系与远程通道配置',
    form: '本地桌面',
    /** 截图窗口是 1080×720，比例与 deepseek/codex 的 1603:1028 不同 */
    aspect: 1.5,
    iconSrc: '/logos/workbuddy.png',
    site: 'https://www.workbuddy.cn',
    component: defineAsyncComponent(
      () => import('@/components/workbuddy/WorkBuddyDesktop.vue'),
    ),
  },
]

export function findAgent(id) {
  return AGENTS.find((a) => a.id === id) ?? null
}
