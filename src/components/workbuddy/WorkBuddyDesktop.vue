<script setup>
/**
 * WorkBuddy AI 桌面端的复刻件（**可试用**）。
 *
 * 界面按项目目录 "workbuddy ai/" 下的 27 张截图 1:1 复刻，文案逐字照抄。
 * 对话是真的：走本项目后端转发到 DeepSeek（模型固定 deepseek-flash，
 * 见 server/routes/agent.js）。
 *
 * ⚠️ 界面上的模型名（主页的 GPT-6-Sol、助理页的 自动、模型菜单里的各家条目）
 * 是按截图照抄的展示文案；实际后端始终是 DeepSeek。这一点由 AgentModal
 * 下方的常驻说明披露，不在这里再挂一层提示破坏还原度。
 *
 * 真 / 摆设的边界（与 deepseek HARNESS、codex 复刻件同一套原则）：
 *   真的 —— 输入框、发送/停止、侧边栏四个视图的切换（新建任务会开新会话）、
 *           所有弹出层与设置页的开合
 *   摆设 —— 弹出层里的每一个条目、菜单栏、搜索、好友卡片、任务/空间列表等
 * 摆设点下去不改变界面状态，只弹一句"网站试用版部分功能不可用…"
 * （见 @/composables/stubToast）—— 完全没动静时用户分不清是没实现还是卡了。
 *
 * 「专家·技能·连接器」导航项没有对应截图，做成摆设不做成空页面 ——
 * 一个点开是空白的视图比没有这个视图更糟（见 agentCatalog.js 文件头）。
 *
 * 「快捷键」设置面板没有截图，面板留空（见 WorkBuddySettings.vue 文件头）。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import HarnessPopover from '@/components/harness/HarnessPopover.vue'
import WorkBuddySettings from '@/components/workbuddy/WorkBuddySettings.vue'
import { showStubToast } from '@/composables/stubToast'
import { useTrialChatStore } from '@/stores/trialChat'

const chat = useTrialChatStore()
const route = useRoute()

/* ============================================================
   弹出层 / 设置页 / 视图 的开合
   ============================================================ */
const openMenu = ref(null)
const settingsOpen = ref(false)

/** 主区视图：home 新建任务 / assistant 助理 / scheduled 定时任务 / library 资料库 */
const view = ref('home')

function toggle(id) {
  openMenu.value = openMenu.value === id ? null : id
}

function closeMenu() {
  openMenu.value = null
}

function openSettings() {
  closeMenu()
  settingsOpen.value = true
}

/* 弹出层里那些"只关菜单"的条目（筛选、菜单项、账号项、加号、模型、权限开关…）
   统一走这里：关菜单 + 未实现提示。 */
function pickStub() {
  closeMenu()
  showStubToast()
}

function newTask() {
  chat.newSession()
  view.value = 'home'
}

function onDocClick() {
  closeMenu()
}

/*
  Esc 分层：先关设置页，再关弹出层，都没有才放行给外层 AgentModal。
  用捕获阶段监听，不依赖监听器注册顺序（原因见 DeepseekHarness.vue）。
*/
function onKeydownCapture(e) {
  if (e.key !== 'Escape') return

  if (settingsOpen.value) {
    e.stopPropagation()
    settingsOpen.value = false
    return
  }
  if (!openMenu.value) return

  e.stopPropagation()
  openMenu.value = null
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydownCapture, true)
  chat.newSession() // 打开即新会话，两个复刻件共用一个 store，不重置会串
  chat.loadModel()

  // ?menu=xxx / ?view=xxx 用地址直接打开某个状态（与另两个复刻件同一约定）
  const m = String(route.query.menu ?? '')
  const v = String(route.query.view ?? '')
  if (['home', 'assistant', 'scheduled', 'library'].includes(v)) view.value = v
  if (m === 'settings') settingsOpen.value = true
  else if (m) openMenu.value = m
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydownCapture, true)
})

/* ============================================================
   弹出层内容（纯展示，条目点了只关菜单）
   ============================================================ */

/** 菜单栏四个菜单。首条的蓝色高亮是 Windows 原生菜单的悬停态，用 CSS :hover 实现 */
const MENUBAR = {
  edit: [
    { label: '撤销(U)', key: 'Ctrl+Z' },
    { label: '重做(R)', key: 'Ctrl+Y' },
    { sep: true },
    { label: '剪切(T)', key: 'Ctrl+X' },
    { label: '复制(C)', key: 'Ctrl+C' },
    { label: '粘贴(P)', key: 'Ctrl+V' },
    { sep: true },
    { label: '全选(A)', key: 'Ctrl+A' },
  ],
  window: [{ label: '关闭窗口(C)', key: 'Ctrl+W' }],
  help: [
    { label: '使用文档' },
    { label: '诊断工具' },
    { label: '资源占用' },
    { sep: true },
    { label: '打开日志目录(L)' },
    { label: '意见反馈' },
  ],
  about: [
    { label: '关于 WorkBuddy AI' },
    { label: '检查更新...' },
    { sep: true },
    { label: '退出 WorkBuddy AI', key: 'Alt+F4' },
  ],
}

/** 左上角漏斗图标的筛选弹出（截图 左上方筛选弹出.png） */
const FILTER_STATUS = ['全部状态', '进行中', '已完成', '失败', '待处理', '规划中']
const FILTER_TIME = ['全部时间', '今天', '最近 7 天', '最近 30 天']

/** 模型菜单（截图 模型选择.png）。free: 红色 Free now 徽标；rate: 右侧倍率 */
const MODELS = [
  { id: 'auto', name: '自动', icon: 'auto' },
  { id: 'fast', name: '快速', icon: 'bolt', rate: '0.34x' },
  { id: 'balance', name: '均衡', icon: 'check', rate: '0.59x' },
  { id: 'best', name: '优选', icon: 'sparkle', rate: '3.31x' },
  { id: 'hy4', name: 'Hy4 preview', icon: 'swirl', rate: '0.29x' },
  { id: 'hy3', name: 'Hy3', icon: 'swirl', free: true, rate: '0.00x' },
  { id: 'step5', name: 'Step-5-Preview', icon: 'grid', free: true, rate: '0.00x' },
  { id: 'ds', name: 'Deepseek-V4.1-Flash', icon: 'whale', free: true, rate: '0.00x', on: true },
  { id: 'gpt6sol', name: 'GPT-6-Sol', icon: 'openai', rate: '1.33x' },
  { id: 'gpt6luna', name: 'GPT-6-Luna', icon: 'openai', rate: '0.07x' },
]

/** 输入框左侧加号弹出（截图 输入框左侧加号弹出.png） */
const PLUS_ITEMS = [
  { icon: 'paperclip', name: '添加文件' },
  { icon: 'mode', name: '模式' },
  { icon: 'expert', name: '专家' },
  { icon: 'skill', name: '技能' },
  { icon: 'link', name: '连接器' },
]

/** 定时任务页的 12 张常用任务卡片（截图 定时任务页.png 逐字照抄） */
const TASK_IDEAS = [
  { icon: 'doc', name: '每日 AI 新闻推送', desc: '关注当天 AI 领域的重要动态，侧…' },
  { icon: 'translate', name: '每日 5 个英语单词', desc: '每天推荐 5 个高频实用英语单词…' },
  { icon: 'bell', name: '每日儿童睡前故事', desc: '生成 3-5 分钟可读的温馨睡前故…' },
  { icon: 'doc', name: '每周工作周报', desc: '每周五汇总仓库 PR 与 Issue 进展…' },
  { icon: 'film', name: '经典电影推荐', desc: '推荐一部高分经典电影，简要介…' },
  { icon: 'calendar', name: '历史上的今天', desc: '从科技、电影、音乐等领域挑选…' },
  { icon: 'bulb', name: '每日一个为什么', desc: '每天抛出一个有趣问题，先提问…' },
  { icon: 'alarm', name: '父母联系提醒', desc: '每周日 10:00 提醒你给家人打电…' },
  { icon: 'calendar', name: '体检预约提醒', desc: '在 2026/10/15 07:00 提醒你确认…' },
  { icon: 'chat', name: '面试准备提醒', desc: '工作日每 2 小时提醒你复习大模…' },
  { icon: 'list', name: '会前准备', desc: '在会议开始前提醒你整理议题、…' },
  { icon: 'image', name: '可爱萌宠手机壁纸', desc: '随机从 7 种不同风格中挑选一种…' },
]

/** 主页快捷入口（截图 主页面.png，最后一个是"视频生成"，原图被裁掉一半） */
const QUICK_CHIPS = ['文档处理', '金融服务', '数据分析及可视化', '个人工作台', '幻灯片', '深度研究', '视频生成']

/** 图标一律存路径数据，不引图标库 */
const ICONS = {
  sidebar: ['M2.6 3.4h10.8a.8.8 0 0 1 .8.8v7.6a.8.8 0 0 1-.8.8H2.6a.8.8 0 0 1-.8-.8V4.2a.8.8 0 0 1 .8-.8Z', 'M6 3.4v9.2'],
  search: ['M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M9.9 9.9 13 13'],
  filter: ['M2.6 3.4h10.8L9.6 8v4.4l-3.2 1.4V8Z'],
  chat: ['M2.6 3.6h10.8v7H6.4L3.6 13v-2.4H2.6z'],
  person: ['M8 7.8a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z', 'M3.4 13c.4-2.1 2.3-3.3 4.6-3.3s4.2 1.2 4.6 3.3'],
  cap: ['M1.8 6 8 3.2 14.2 6 8 8.8Z', 'M4.4 7.4v3c0 .8 1.6 1.6 3.6 1.6s3.6-.8 3.6-1.6v-3'],
  alarm: ['M8 3.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8Z', 'M8 5.8V8l1.5 1.1', 'M2.6 2.8l1.6 1.2M13.4 2.8l-1.6 1.2'],
  book: ['M3 3.4h4a2 2 0 0 1 2 2v7.2a1.6 1.6 0 0 0-1.6-1.6H3Z', 'M13 3.4H9a2 2 0 0 0-2 2v7.2a1.6 1.6 0 0 1 1.6-1.6H13Z'],
  folder: ['M2.2 4.6a1 1 0 0 1 1-1h2.6l1 1.3h6a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V4.6Z'],
  warn: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M8 5.4v3.4M8 10.8h.01'],
  gift: ['M8 2.4c1.4 0 2.2.9 2.2 2 0 .8-.5 1.5-1.2 1.9h2.6a.8.8 0 0 1 .8.8v1.6H2.6V7.1a.8.8 0 0 1 .8-.8H6c-.7-.4-1.2-1.1-1.2-1.9 0-1.1.8-2 2.2-2 .6 0 1 .3 1 .3s.4-.3 1-.3Z', 'M3 8.7h10v4.5H3z'],
  chevDown: ['M4.4 6.4 8 10l3.6-3.6'],
  chevRight: ['M6.4 4.4 10 8l-3.6 3.6'],
  plus: ['M8 3.4v9.2M3.4 8h9.2'],
  send: ['M8 12.4V3.8M4.4 7.2 8 3.6l3.6 3.6'],
  globe: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M2.8 8h10.4M8 2.6c1.5 1.4 2.3 3.3 2.3 5.4S9.5 12 8 13.4C6.5 12 5.7 10.1 5.7 8S6.5 4 8 2.6Z'],
  rocket: ['M4 12 3 13l1-3.4L9.4 4.2a2 2 0 0 1 2.8 2.8L6.8 12Z', 'M3.4 9.2 6.8 12.6'],
  shield: ['M8 2.4 13 4.2v3.4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4.2Z', 'M6 8l1.4 1.4L10 6.8'],
  paperclip: ['M11 8.2 6.9 12.3a2.4 2.4 0 0 1-3.4-3.4l4.6-4.6a1.6 1.6 0 0 1 2.3 2.3L5.8 11.1'],
  mode: ['M3 13l.5-2.5 7-7a1.5 1.5 0 0 1 2 2l-7 7Z', 'M10.5 3.5l2 2'],
  expert: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M5.8 7h.01M10.2 7h.01', 'M5.8 9.8c.6.6 1.4.9 2.2.9s1.6-.3 2.2-.9'],
  skill: ['M9.4 5.2a2.6 2.6 0 0 1 3.4-2.4l-1.8 1.8 1.4 1.4 1.8-1.8a2.6 2.6 0 0 1-3.5 3.3L5.6 12.6a1.3 1.3 0 0 1-1.8-1.8Z'],
  link: ['M6.6 9.4a2.2 2.2 0 0 1 0-3.1l2.2-2.2a2.2 2.2 0 0 1 3.1 3.1l-1.1 1.1', 'M9.4 6.6a2.2 2.2 0 0 1 0 3.1l-2.2 2.2a2.2 2.2 0 0 1-3.1-3.1l1.1-1.1'],
  auto: ['M8 3.2a4.8 4.8 0 0 1 4.2 2.5', 'M12.6 3.6v2.4h-2.4', 'M8 12.8a4.8 4.8 0 0 1-4.2-2.5', 'M3.4 12.4V10h2.4'],
  openai: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z'],
  swirl: ['M8 3a5 5 0 1 1-4.6 3', 'M3 3.4v2.8h2.8'],
  whale: ['M2.6 9.4c2-3.4 5.6-4.8 9-3.6l2-1.4-.6 2.4c.6.8.6 1.8 0 2.6-2.8 2-7.6 2.4-10.4 0Z', 'M10.6 7.6h.01'],
  bolt: ['M8.6 2.6 4.4 9h3l-.8 4.4L10.8 7h-3Z'],
  sparkle: ['M8 2.6l1.3 3.4 3.4 1.3-3.4 1.3L8 12l-1.3-3.4L3.3 7.3l3.4-1.3z'],
  grid: ['M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z'],
  check: ['M3.4 8.4 6.4 11.4 12.6 5'],
  pen: ['M3.2 12.8l.4-2.7 7.4-7.4a1.6 1.6 0 0 1 2.2 0l.1.1a1.6 1.6 0 0 1 0 2.2l-7.4 7.4Z', 'M10.2 3.5l2.3 2.3'],
  doc: ['M4 2.6h5.4L12.4 5.6v7.8H4Z', 'M9.2 2.8v3h3'],
  translate: ['M2.6 4.6h5M5.1 3.4v1.2M6.6 4.6c-.4 2.4-2 4.2-4 5', 'M3.6 6.8c.7 1.5 2 2.7 3.4 3.3', 'M8.2 13.4l2.4-6 2.4 6M9 11.4h3.2'],
  bell: ['M8 3a3.6 3.6 0 0 1 3.6 3.6c0 2.6.8 3.6 1.4 4.2H3c.6-.6 1.4-1.6 1.4-4.2A3.6 3.6 0 0 1 8 3Z', 'M6.8 12.6a1.3 1.3 0 0 0 2.4 0'],
  film: ['M2.6 3.6h10.8v8.8H2.6z', 'M5.4 3.6v8.8M10.6 3.6v8.8M2.6 8h10.8'],
  calendar: ['M3 4.4h10v8.2H3z', 'M3 6.8h10M5.6 2.8v2M10.4 2.8v2'],
  bulb: ['M8 2.4a3.6 3.6 0 0 1 1.8 6.7c-.5.3-.8.6-.8 1.1H7c0-.5-.3-.8-.8-1.1A3.6 3.6 0 0 1 8 2.4Z', 'M7 12h2M7.4 13.6h1.2'],
  list: ['M5 4.6h8M5 8h8M5 11.4h8', 'M3 4.6h.01M3 8h.01M3 11.4h.01'],
  image: ['M2.6 3.6h10.8v8.8H2.6z', 'M5.6 6.6a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z', 'M3 11l3.4-3 2.4 2.2 2.2-1.8 2.4 2.2'],
  megaphone: ['M2.6 6.6v2.8l2 .2 6 2.6V4L4.6 6.4Z', 'M12.6 6.4a2 2 0 0 1 0 3.2'],
  clock: ['M8 3.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z', 'M8 5.8V8l1.6 1.2'],
  db: ['M8 2.8c3 0 5.4.8 5.4 1.8S11 6.4 8 6.4 2.6 5.6 2.6 4.6 5 2.8 8 2.8Z', 'M2.6 4.6v6.8c0 1 2.4 1.8 5.4 1.8s5.4-.8 5.4-1.8V4.6'],
  close: ['M4 4l8 8M12 4l-8 8'],
  gear: ['M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z', 'M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7', 'M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2'],
  palette: ['M8 2.6a5.4 5.4 0 1 0 0 10.8c.9 0 1.2-.6 1-1.2-.3-.9.2-1.6 1.2-1.6h1a2.2 2.2 0 0 0 2.2-2.4A5.5 5.5 0 0 0 8 2.6Z', 'M5.4 7.4h.01M7.4 5.2h.01M10 5.6h.01'],
  bulbOn: ['M8 2.4a3.6 3.6 0 0 1 1.8 6.7c-.5.3-.8.6-.8 1.1H7c0-.5-.3-.8-.8-1.1A3.6 3.6 0 0 1 8 2.4Z', 'M7 12h2'],
  info: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M8 7.4v3.2M8 5.2h.01'],
  logout: ['M6.4 3H3.4v10h3', 'M9 5.4 11.6 8 9 10.6', 'M11.4 8H6'],
  ext: ['M6.4 4h6.6v6.6', 'M13 4 7.5 9.5', 'M11 12.6H3.4V5'],
  chevLeft: ['M9.6 4.4 6 8l3.6 3.6'],
}

/** 资料库左栏「我的资料」下的条目。emoji 按截图照抄 */
const LIB_ITEM = { name: 'Using the Library with …', owner: '17660219683@1…' }

function statusOf(m) {
  if (m.error) return m.error
  if (m.stopped) return '已停止'
  if (m.text) return `已完成，用时 ${((m.ms ?? 0) / 1000).toFixed(1)} 秒`
  return '没有返回内容'
}

const inputEl = ref(null)

watch(
  () => chat.input,
  async () => {
    await nextTick()
    const el = inputEl.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  },
)

function onKeydown(e) {
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    chat.send()
  }
}

function fmtTime(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="wb">
    <!-- ================= 菜单栏 ================= -->
    <div class="menubar">
      <span class="mb-icons">
        <span v-stub class="mb-ico" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path v-for="(d, i) in ICONS.sidebar" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span v-stub class="mb-ico" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="anchor">
          <button type="button" class="mb-ico btn" :class="{ on: openMenu === 'filter' }" title="筛选" @click.stop="toggle('filter')">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path :d="ICONS.filter[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <HarnessPopover v-if="openMenu === 'filter'" align="left" :min-width="216">
            <p class="fsec">筛选状态</p>
            <div v-for="(s, i) in FILTER_STATUS" :key="s" class="fitem" @click="pickStub()">
              <span class="fitem-label">{{ s }}</span>
              <svg v-if="i === 0" viewBox="0 0 16 16" width="14" height="14" class="fcheck">
                <path :d="ICONS.check[0]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="csep" />
            <p class="fsec">筛选时间</p>
            <div v-for="(s, i) in FILTER_TIME" :key="s" class="fitem" @click="pickStub()">
              <span class="fitem-label">{{ s }}</span>
              <svg v-if="i === 0" viewBox="0 0 16 16" width="14" height="14" class="fcheck">
                <path :d="ICONS.check[0]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="csep" />
            <div class="fitem dim" @click="pickStub()">
              <span class="fitem-label">重置筛选条件</span>
            </div>
          </HarnessPopover>
        </span>
      </span>

      <span v-for="m in ['edit', 'window', 'help', 'about']" :key="m" class="anchor">
        <button type="button" class="mb-btn" :class="{ on: openMenu === m }" @click.stop="toggle(m)">
          {{ m === 'edit' ? '编辑(E)' : m === 'window' ? '窗口(W)' : m === 'help' ? '帮助(H)' : '关于(A)' }}
        </button>
        <HarnessPopover v-if="openMenu === m" align="left" :min-width="236">
          <template v-for="(item, i) in MENUBAR[m]" :key="i">
            <div v-if="item.sep" class="csep" />
            <div v-else class="ci" @click="pickStub()">
              <span class="ci-label">{{ item.label }}</span>
              <span v-if="item.key" class="ci-key">{{ item.key }}</span>
            </div>
          </template>
        </HarnessPopover>
      </span>

      <span v-stub class="win-controls" aria-hidden="true">
        <span>─</span><span>▢</span><span>✕</span>
      </span>
    </div>

    <!-- ================= 设置弹窗（居中悬浮小窗，主体不被卸载） ================= -->
    <WorkBuddySettings v-if="settingsOpen" @close="settingsOpen = false" />

    <div class="body">
      <!-- ================= 侧边栏 ================= -->
      <aside class="sidebar">
        <div class="brand">
          <p class="brand-name">WorkBuddy AI</p>
          <p class="brand-ver">5.7.6</p>
        </div>

        <nav class="nav">
          <button type="button" class="nav-item" :class="{ on: view === 'home' }" @click="newTask()">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path :d="ICONS.chat[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
              <path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            新建任务
          </button>
          <button type="button" class="nav-item" :class="{ on: view === 'assistant' }" @click="view = 'assistant'">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.person" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            助理
            <span class="beta">BETA</span>
            <svg v-if="view === 'assistant'" viewBox="0 0 16 16" width="13" height="13" class="nav-extra" aria-hidden="true">
              <path :d="ICONS.gear[0]" fill="none" stroke="currentColor" stroke-width="1.1" />
            </svg>
          </button>
          <span v-stub class="nav-item deco">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.cap" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            专家·技能·连接器
          </span>
          <button type="button" class="nav-item" :class="{ on: view === 'scheduled' }" @click="view = 'scheduled'">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.alarm" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            定时任务
          </button>
          <button type="button" class="nav-item" :class="{ on: view === 'library' }" @click="view = 'library'">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.book" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
            资料库
          </button>
        </nav>

        <div class="sec-block">
          <p class="sec-title">任务 (0)</p>
          <p class="sec-empty">暂无任务</p>
        </div>

        <div class="sec-block">
          <p class="sec-title">空间 (1)</p>
          <div v-stub class="space-row">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path :d="ICONS.folder[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
            LM Select
          </div>
          <div v-stub class="space-sub">
            评估毕设并规划后续方向
            <svg viewBox="0 0 16 16" width="13" height="13" class="space-warn" aria-hidden="true">
              <path v-for="(d, i) in ICONS.warn" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- 好友邀请卡片 -->
        <div v-stub class="invite" aria-hidden="true">
          <div class="invite-head">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path :d="ICONS.gift[0]" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
            </svg>
            好友加入，积分上涨
            <svg viewBox="0 0 16 16" width="12" height="12" class="invite-chev">
              <path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="invite-sub">邀请一位好友可获得 <b>100</b> 积分</p>
        </div>

        <!-- 左下角账号 -->
        <div class="side-foot">
          <span class="anchor grow">
            <button type="button" class="acct" :class="{ on: openMenu === 'account' }" @click.stop="toggle('account')">
              <img class="acct-mascot" src="/logos/workbuddy.png" width="20" height="20" alt="" />
              17660219683@163.com
            </button>
            <HarnessPopover v-if="openMenu === 'account'" align="left" side="up" :min-width="264">
              <div class="acct-card">
                <img src="/logos/workbuddy.png" width="34" height="34" alt="" style="border-radius: 8px" />
                <span class="acct-mail">17660219683@163.com</span>
              </div>
              <div class="plan-card">
                <div class="plan-row">
                  <div>
                    <p class="plan-label">套餐</p>
                    <p class="plan-value">Free</p>
                  </div>
                  <div>
                    <p class="plan-label">积分余额</p>
                    <p class="plan-value">349.65</p>
                  </div>
                </div>
                <div class="plan-btns">
                  <span class="plan-btn dark">升级套餐</span>
                  <span class="plan-btn ghost">购买积分</span>
                </div>
              </div>
              <div class="ci" @click="openSettings()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, i) in ICONS.gear" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" /></svg>
                </span>
                <span class="ci-label">设置</span>
                <span class="ci-key">Ctrl+,</span>
              </div>
              <div class="ci">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path :d="ICONS.palette[0]" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" /></svg>
                </span>
                <span class="ci-label">外观</span>
                <span class="seg">
                  <span class="seg-opt on">浅色</span>
                  <span class="seg-opt">深色</span>
                </span>
              </div>
              <div class="ci" @click="pickStub()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path :d="ICONS.bulbOn[0]" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" /></svg>
                </span>
                <span class="ci-label">记忆与进化</span>
              </div>
              <div class="ci" @click="pickStub()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path :d="ICONS.chat[0]" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /></svg>
                </span>
                <span class="ci-label">意见反馈</span>
              </div>
              <div class="ci" @click="pickStub()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, i) in ICONS.auto" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" /></svg>
                </span>
                <span class="ci-label">检查更新</span>
              </div>
              <div class="csep" />
              <div class="ci" @click="pickStub()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="15" height="15"><path :d="ICONS.logout[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
                <span class="ci-label">退出登录</span>
              </div>
            </HarnessPopover>
          </span>
        </div>
      </aside>

      <!-- ================= 主区 ================= -->
      <section class="main">
        <!-- ---------- 定时任务页 ---------- -->
        <template v-if="view === 'scheduled'">
          <div class="sched">
            <div class="sched-top">
              <h1 class="page-title">定时任务</h1>
              <span v-stub class="create-btn">
                <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
                新建
                <svg viewBox="0 0 16 16" width="11" height="11"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </span>
            </div>

            <div class="sched-empty">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
                <circle cx="32" cy="34" r="20" fill="#e4e5e8" />
                <ellipse cx="25" cy="32" rx="4" ry="5" fill="#fff" />
                <ellipse cx="39" cy="32" rx="4" ry="5" fill="#fff" />
                <circle cx="26" cy="33" r="1.8" fill="#9aa0a6" />
                <circle cx="38" cy="33" r="1.8" fill="#9aa0a6" />
                <path d="M26 42c2 1.6 10 1.6 12 0" fill="none" stroke="#9aa0a6" stroke-width="1.6" stroke-linecap="round" />
                <path d="M46 12l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#d5d7db" />
              </svg>
              <p class="sched-empty-text">暂无定时任务</p>
            </div>

            <p class="sched-sec">试试这些常用任务</p>
            <div class="idea-grid">
              <div v-for="t in TASK_IDEAS" :key="t.name" v-stub class="idea">
                <svg viewBox="0 0 16 16" width="16" height="16" class="idea-ico" aria-hidden="true">
                  <path v-for="(d, i) in ICONS[t.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p class="idea-name">{{ t.name }}</p>
                <p class="idea-desc">{{ t.desc }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ---------- 资料库页 ---------- -->
        <template v-else-if="view === 'library'">
          <div class="lib">
            <div class="lib-side">
              <div class="lib-side-head">
                <span class="lib-side-title">资料库</span>
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.megaphone" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
                </svg>
              </div>
              <div v-stub class="lib-search">
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                搜索
              </div>
              <div v-stub class="lib-item on">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.clock" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                最近
              </div>
              <div v-stub class="lib-item">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path :d="ICONS.db[0]" fill="none" stroke="currentColor" stroke-width="1.1" />
                </svg>
                本地资产
              </div>
              <div v-stub class="lib-sec">
                我的资料
                <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span class="lib-plus">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                </span>
              </div>
              <div v-stub class="lib-file">
                <span class="lib-badge">M</span>
                <span class="lib-emoji">🙂</span><span class="lib-emoji">🐵</span>
                <span class="lib-file-name">{{ LIB_ITEM.name }}</span>
              </div>
              <div v-stub class="lib-sec">
                团队空间
                <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span class="lib-plus">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                </span>
              </div>
              <div v-stub class="lib-create">＋ 创建第一个空间</div>

              <div class="lib-foot">
                <p class="lib-usage">已使用 0 B / 5 GB</p>
                <div class="lib-bar"><i /></div>
              </div>
            </div>

            <div class="lib-main">
              <svg v-stub viewBox="0 0 16 16" width="16" height="16" class="lib-toggle" aria-hidden="true">
                <path v-for="(d, i) in ICONS.sidebar" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <h1 class="page-title lib-title">最近</h1>
              <div class="lib-tabs">
                <div class="lib-tabs-l">
                  <span v-stub class="lib-tab on">最近访问</span>
                  <span v-stub class="lib-tab">我分享的</span>
                  <span v-stub class="lib-tab">与我共享</span>
                </div>
                <span v-stub class="lib-type">
                  全部类型
                  <svg viewBox="0 0 16 16" width="11" height="11"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
              </div>
              <div class="lib-table">
                <div class="lib-tr head">
                  <span class="th-name">名称</span><span>所有者</span><span>位置</span><span>最近访问</span>
                </div>
                <div v-stub class="lib-tr">
                  <span class="th-name lib-file-cell">
                    <span class="lib-badge">M</span>
                    <span class="lib-emoji">🙂</span><span class="lib-emoji">🐵</span>
                    Using the Library with …
                  </span>
                  <span>{{ LIB_ITEM.owner }}</span>
                  <span>我的资料</span>
                  <span>刚刚</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ---------- 新建任务 / 助理：同一套对话界面 ---------- -->
        <template v-else>
          <div class="chat-wrap" :class="{ empty: !chat.hasMessages }">
            <!-- 助理页头部 -->
            <div v-if="view === 'assistant'" class="asst-head">
              <span class="asst-title">本地助理</span>
              <span v-stub class="asst-conn">未连接：请点击 <b>配置</b> Slack/Discord/Telegram 等连接，实现远程控制任务</span>
            </div>

            <!-- 空会话的主页：居中标题 + 快捷入口 -->
            <div v-if="view === 'home' && !chat.hasMessages" class="hero">
              <h1 class="hero-title">WorkBuddy, 我帮你</h1>
              <div class="hero-tabs">
                <span class="hero-tab on">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path v-for="(d, i) in ICONS.clock" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                  日常办公
                </span>
                <span v-stub class="hero-tab">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  代码开发
                </span>
              </div>
              <div class="chips">
                <span v-for="c in QUICK_CHIPS" :key="c" v-stub class="chip">
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path :d="ICONS.grid[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                  </svg>
                  {{ c }}
                </span>
                <img class="chips-mascot" src="/logos/workbuddy.png" width="30" height="30" alt="" />
              </div>
            </div>

            <!-- 对话流 -->
            <div v-else-if="chat.hasMessages" class="messages">
              <template v-for="m in chat.messages" :key="m.id">
                <div v-if="m.role === 'user'" class="user-msg">
                  <div class="user-meta">
                    <span class="user-date">{{ fmtTime(m.at) }}</span>
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path v-for="(d, i) in ICONS.list" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                    </svg>
                  </div>
                  <div class="bubble">{{ m.text }}</div>
                </div>
                <template v-else>
                  <div v-if="m.text" class="assistant-msg">{{ m.text }}</div>
                  <div v-if="!m.streaming" class="status">
                    <span class="status-label" :class="{ bad: m.error }">{{ statusOf(m) }}</span>
                  </div>
                </template>
              </template>
            </div>
            <div v-else class="chat-spacer" />

            <!-- 输入区 -->
            <div class="composer-col">
              <div class="composer" :class="{ heroed: view === 'home' && !chat.hasMessages }">
                <textarea
                  ref="inputEl"
                  class="input"
                  :value="chat.input"
                  rows="1"
                  placeholder="今天帮你做些什么？ @ 添加上下文，/调用技能与指令"
                  @input="chat.setInput($event.target.value)"
                  @keydown="onKeydown"
                />

                <!-- 助理页的输入框控制行：+ / 工作模式 / 默认权限 …… 自动 / 发送 -->
                <div v-if="view === 'assistant'" class="controls">
                  <span class="anchor">
                    <button type="button" class="cbtn plus" :class="{ on: openMenu === 'plus' }" title="添加" @click.stop="toggle('plus')">
                      <svg viewBox="0 0 16 16" width="15" height="15">
                        <path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                      </svg>
                    </button>
                    <!-- 加号菜单挂 .composer：要整行宽，不能挂 26px 的圆按钮上 -->
                    <HarnessPopover v-if="openMenu === 'plus'" align="left" side="up" :min-width="300">
                      <template v-for="(a, i) in PLUS_ITEMS" :key="a.name">
                        <div v-if="i === 1" class="csep" />
                        <div class="ci" @click="pickStub()">
                          <span class="ci-ico">
                            <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, j) in ICONS[a.icon]" :key="j" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                          </span>
                          <span class="ci-label">{{ a.name }}</span>
                          <span class="ci-key">›</span>
                        </div>
                      </template>
                    </HarnessPopover>
                  </span>

                  <span v-stub class="cbtn deco">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path v-for="(d, i) in ICONS.rocket" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    工作模式
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>

                  <span class="anchor">
                    <button type="button" class="cbtn" :class="{ on: openMenu === 'perm' }" @click.stop="toggle('perm')">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.shield" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                      </svg>
                      默认权限
                      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>
                    <HarnessPopover v-if="openMenu === 'perm'" align="left" side="up" :min-width="300">
                      <p class="perm-text">当前为默认权限，所有操作都会在安全沙箱约束内进行，超出范围会请求你的允许。</p>
                      <div class="csep" />
                      <div class="perm-row" @click="pickStub()">
                        <span>允许完全访问</span>
                        <span class="toggle"><i /></span>
                      </div>
                    </HarnessPopover>
                  </span>

                  <span class="spacer" />

                  <span v-stub class="cbtn deco">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path v-for="(d, i) in ICONS.globe" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                    </svg>
                    自动
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </span>

                  <button
                    type="button"
                    class="send"
                    :class="{ stop: chat.sending }"
                    :disabled="!chat.sending && !chat.canSend"
                    :title="chat.sending ? '停止生成' : '发送（Enter）'"
                    @click="chat.sending ? chat.stop() : chat.send()"
                  >
                    <svg v-if="chat.sending" viewBox="0 0 16 16" width="12" height="12">
                      <rect x="4" y="4" width="8" height="8" rx="1.4" fill="currentColor" />
                    </svg>
                    <svg v-else viewBox="0 0 16 16" width="15" height="15">
                      <path :d="ICONS.send[0]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>

                <!-- 主页的输入框控制行：+ …… 模型 / 发送 -->
                <div v-else class="controls">
                  <span class="anchor">
                    <button type="button" class="cbtn plus" :class="{ on: openMenu === 'plus' }" title="添加" @click.stop="toggle('plus')">
                      <svg viewBox="0 0 16 16" width="15" height="15">
                        <path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                      </svg>
                    </button>
                    <HarnessPopover v-if="openMenu === 'plus'" align="left" side="up" :min-width="300">
                      <template v-for="(a, i) in PLUS_ITEMS" :key="a.name">
                        <div v-if="i === 1" class="csep" />
                        <div class="ci" @click="pickStub()">
                          <span class="ci-ico">
                            <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, j) in ICONS[a.icon]" :key="j" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                          </span>
                          <span class="ci-label">{{ a.name }}</span>
                          <span class="ci-key">›</span>
                        </div>
                      </template>
                    </HarnessPopover>
                  </span>

                  <span class="spacer" />

                  <span class="anchor">
                    <button type="button" class="cbtn model" :class="{ on: openMenu === 'model' }" @click.stop="toggle('model')">
                      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.swirl" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                      </svg>
                      GPT-6-Sol
                      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>
                    <HarnessPopover v-if="openMenu === 'model'" align="right" side="up" :min-width="330">
                      <div v-for="mo in MODELS" :key="mo.id" class="mi" :class="{ on: mo.on }" @click="pickStub()">
                        <span class="mi-ico">
                          <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, j) in ICONS[mo.icon] ?? ICONS.sparkle" :key="j" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
                        </span>
                        <span class="mi-name">
                          {{ mo.name }}
                          <i v-if="mo.free" class="free-badge">Free now</i>
                        </span>
                        <span class="mi-rate">{{ mo.rate }}</span>
                        <svg v-if="mo.on" viewBox="0 0 16 16" width="14" height="14" class="mi-check">
                          <path :d="ICONS.check[0]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </div>
                      <div class="csep" />
                      <div class="mi" @click="pickStub()">
                        <span class="mi-ico">
                          <svg viewBox="0 0 16 16" width="15" height="15"><path v-for="(d, j) in ICONS.pen" :key="j" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        </span>
                        <span class="mi-name">配置自定义模型</span>
                      </div>
                    </HarnessPopover>
                  </span>

                  <button
                    type="button"
                    class="send"
                    :class="{ stop: chat.sending }"
                    :disabled="!chat.sending && !chat.canSend"
                    :title="chat.sending ? '停止生成' : '发送（Enter）'"
                    @click="chat.sending ? chat.stop() : chat.send()"
                  >
                    <svg v-if="chat.sending" viewBox="0 0 16 16" width="12" height="12">
                      <rect x="4" y="4" width="8" height="8" rx="1.4" fill="currentColor" />
                    </svg>
                    <svg v-else viewBox="0 0 16 16" width="15" height="15">
                      <path :d="ICONS.send[0]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 主页输入框下面那行：选择工作空间 / 默认权限 -->
              <div v-if="view === 'home'" class="subrow">
                <span class="anchor">
                  <button type="button" class="sub-btn" :class="{ on: openMenu === 'ws' }" @click.stop="toggle('ws')">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path :d="ICONS.folder[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                    </svg>
                    选择工作空间
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                  <HarnessPopover v-if="openMenu === 'ws'" align="left" side="up" :min-width="300">
                    <div v-stub class="csearch">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                      </svg>
                      <span class="csearch-ph">搜索工作空间</span>
                    </div>
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico">
                        <svg viewBox="0 0 16 16" width="14" height="14"><path :d="ICONS.folder[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
                      </span>
                      <span class="ci-label">LM Select</span>
                    </div>
                    <div class="csep" />
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico">
                        <svg viewBox="0 0 16 16" width="14" height="14"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                      </span>
                      <span class="ci-label">新建工作空间</span>
                    </div>
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico">
                        <svg viewBox="0 0 16 16" width="14" height="14"><path :d="ICONS.folder[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
                      </span>
                      <span class="ci-label">打开本地文件夹</span>
                    </div>
                  </HarnessPopover>
                </span>

                <span class="anchor">
                  <button type="button" class="sub-btn" :class="{ on: openMenu === 'perm' }" @click.stop="toggle('perm')">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path v-for="(d, i) in ICONS.shield" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                    </svg>
                    默认权限
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  </button>
                  <HarnessPopover v-if="openMenu === 'perm'" align="left" side="up" :min-width="300">
                    <p class="perm-text">当前为默认权限，所有操作都会在安全沙箱约束内进行，超出范围会请求你的允许。</p>
                    <div class="csep" />
                    <div class="perm-row" @click="pickStub()">
                      <span>允许完全访问</span>
                      <span class="toggle"><i /></span>
                    </div>
                  </HarnessPopover>
                </span>
              </div>

              <!-- 助理页底部的 AI 声明 -->
              <p v-if="view === 'assistant'" class="asst-foot">内容由 AI 生成，请核实重要信息</p>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
  配色按截图目测：浅灰侧边栏 + 纯白主区，强调色是品牌绿和 Windows 菜单蓝。
*/
.wb {
  --wb-side: #f5f5f6;
  --wb-line: #ececee;
  --wb-text: #1f1f23;
  --wb-dim: #9aa0a6;
  --wb-hover: #ebebed;
  --wb-blue: #1f6cd6;
  --wb-green: #12b76a;

  display: flex;
  position: relative;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  color: var(--wb-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC',
    'Hiragino Sans GB', sans-serif;
  font-size: 13px;
}

.anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* ---------- 菜单栏 ---------- */
.menubar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  flex-shrink: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--wb-line);
  background: #f7f7f8;
  color: #4c4c52;
  font-size: 12.5px;
}

.mb-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 10px;
  color: #5c5c62;
}

.mb-ico {
  display: flex;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
}

.mb-ico.btn {
  cursor: pointer;
  font: inherit;
}

.mb-ico.btn:hover,
.mb-ico.btn.on {
  background: #e8e8e9;
  color: var(--wb-text);
}

.mb-btn {
  padding: 4px 9px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.mb-btn:hover,
.mb-btn.on {
  background: #e8e8e9;
  color: var(--wb-text);
}

.win-controls {
  display: flex;
  gap: 16px;
  margin-left: auto;
  color: var(--wb-dim);
  font-size: 11px;
  cursor: pointer;
}

/* ---------- 弹出层条目 ---------- */
.ci {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--wb-text);
  font-size: 13.5px;
  cursor: default;
}

.ci:hover {
  background: var(--wb-blue);
  color: #fff;
}

.ci:hover .ci-ico,
.ci:hover .ci-key {
  color: #fff;
}

.ci-ico {
  display: flex;
  width: 17px;
  flex-shrink: 0;
  justify-content: center;
  color: #6f6f75;
}

.ci-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ci-key {
  flex-shrink: 0;
  color: var(--wb-dim);
  font-size: 12.5px;
}

.csep {
  height: 1px;
  margin: 5px -5px;
  background: var(--wb-line);
}

.csearch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 3px 3px 7px;
  padding: 7px 10px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  color: var(--wb-dim);
}

.csearch-ph {
  font-size: 13px;
}

/* 筛选弹出 */
.fsec {
  margin: 0;
  padding: 7px 10px 3px;
  color: var(--wb-dim);
  font-size: 12px;
}

.fitem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13.5px;
  cursor: default;
}

.fitem:hover {
  background: #f3f3f4;
}

.fitem-label {
  flex: 1;
}

.fitem:first-of-type .fitem-label,
.fitem.on .fitem-label {
  font-weight: 600;
}

.fcheck {
  color: var(--wb-green);
  flex-shrink: 0;
}

.fitem.dim {
  color: #b8b8bc;
}

/* 账号弹出层 */
.acct-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid var(--wb-line);
}

.acct-mail {
  font-size: 14.5px;
  font-weight: 700;
}

.plan-card {
  margin: 8px;
  padding: 12px;
  border-radius: 10px;
  background: #f5f5f6;
}

.plan-row {
  display: flex;
  gap: 28px;
}

.plan-label {
  margin: 0 0 4px;
  color: var(--wb-dim);
  font-size: 12px;
}

.plan-value {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.plan-btns {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.plan-btn {
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 6px 0;
  border-radius: 8px;
  font-size: 12.5px;
}

.plan-btn.dark {
  background: #1f1f23;
  color: #fff;
}

.plan-btn.ghost {
  border: 1px solid var(--wb-line);
  background: #fff;
  color: #b8b8bc;
}

.seg {
  display: flex;
  flex-shrink: 0;
  border-radius: 7px;
  background: #ececee;
  padding: 2px;
}

.seg-opt {
  padding: 3px 10px;
  border-radius: 5px;
  color: var(--wb-dim);
  font-size: 12px;
}

.seg-opt.on {
  background: #fff;
  color: var(--wb-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

/* 权限弹出层：说明文字 + 开关行 */
.perm-text {
  margin: 0;
  padding: 9px 10px;
  color: var(--wb-text);
  font-size: 13px;
  line-height: 1.65;
}

.perm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 10px;
  font-size: 13.5px;
  cursor: default;
}

.perm-row:hover {
  background: #f3f3f4;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 19px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #d8d8dc;
}

.toggle i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #fff;
}

/* 模型菜单 */
.mi {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13.5px;
  cursor: default;
}

.mi:hover {
  background: #f3f3f4;
}

.mi.on {
  background: #f0f0f1;
}

.mi-ico {
  display: flex;
  width: 17px;
  flex-shrink: 0;
  justify-content: center;
  color: #3c3c42;
}

.mi-name {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.free-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fde8e8;
  color: #d92d20;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
}

.mi-rate {
  flex-shrink: 0;
  color: var(--wb-dim);
  font-size: 12.5px;
}

.mi-check {
  flex-shrink: 0;
  color: var(--wb-green);
}

/* ---------- 主体 ---------- */
.body {
  display: flex;
  min-height: 0;
  flex: 1;
}

/* ---------- 侧边栏 ---------- */
.sidebar {
  display: flex;
  width: 216px;
  flex-shrink: 0;
  flex-direction: column;
  padding: 12px 10px 10px;
  background: var(--wb-side);
}

.brand-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.brand-ver {
  margin: 2px 0 0;
  color: var(--wb-dim);
  font-size: 11px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--wb-text);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
}

.nav-item.on,
.nav-item:not(.deco):hover {
  background: #e9e9eb;
}

.nav-item.deco {
  cursor: default;
}

.beta {
  padding: 1px 5px;
  border-radius: 4px;
  background: #e2e2e5;
  color: #7c7c82;
  font-size: 9.5px;
  font-weight: 600;
}

.nav-extra {
  margin-left: auto;
  color: #6f6f75;
}

.sec-block {
  padding: 16px 8px 0;
}

.sec-title {
  margin: 0;
  color: var(--wb-dim);
  font-size: 12px;
}

.sec-empty {
  margin: 8px 0 0 2px;
  color: #bababe;
  font-size: 12.5px;
}

.space-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 4px 2px;
  color: var(--wb-text);
  font-size: 13px;
}

.space-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 0 23px;
  color: #4c4c52;
  font-size: 12.5px;
}

.space-warn {
  flex-shrink: 0;
  color: #d92d20;
}

.invite {
  margin-top: auto;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--wb-line);
}

.invite-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
}

.invite-chev {
  margin-left: auto;
  color: var(--wb-dim);
}

.invite-sub {
  margin: 5px 0 0;
  color: var(--wb-dim);
  font-size: 11.5px;
}

.invite-sub b {
  color: var(--wb-green);
  font-weight: 600;
}

.side-foot {
  display: flex;
  margin-top: 12px;
}

.grow {
  flex: 1;
  min-width: 0;
}

.acct {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--wb-text);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
}

.acct:hover,
.acct.on {
  background: #e9e9eb;
}

.acct-mascot {
  flex-shrink: 0;
}

.acct span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 主区 ---------- */
.main {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
  background: #fff;
}

.page-title {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
}

/* ---------- 定时任务页 ---------- */
.sched {
  position: relative;
  max-width: 56rem;
  margin: 0 auto;
  padding: 26px 36px 40px;
}

.sched-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 9px;
  background: #1f1f23;
  color: #fff;
  font-size: 13px;
}

.sched-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 46px 0 40px;
}

.sched-empty-text {
  margin: 14px 0 0;
  color: var(--wb-dim);
  font-size: 13.5px;
}

.sched-sec {
  margin: 0 0 14px;
  color: var(--wb-text);
  font-size: 14.5px;
  font-weight: 600;
}

.idea-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.idea {
  padding: 14px 16px;
  border: 1px solid var(--wb-line);
  border-radius: 12px;
  background: #fff;
  cursor: default;
}

.idea:hover {
  background: #fafafa;
}

.idea-ico {
  color: #3c3c42;
}

.idea-name {
  margin: 9px 0 0;
  font-size: 13.5px;
  font-weight: 600;
}

.idea-desc {
  margin: 5px 0 0;
  color: var(--wb-dim);
  font-size: 12px;
  line-height: 1.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 资料库页 ---------- */
.lib {
  display: flex;
  height: 100%;
  min-height: 0;
}

.lib-side {
  display: flex;
  width: 216px;
  flex-shrink: 0;
  flex-direction: column;
  padding: 18px 12px 14px;
  border-right: 1px solid var(--wb-line);
}

.lib-side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.lib-side-title {
  font-size: 16px;
  font-weight: 700;
}

.lib-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 10px;
  padding: 7px 10px;
  border-radius: 8px;
  background: #f2f2f3;
  color: var(--wb-dim);
  font-size: 13px;
}

.lib-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  font-size: 13.5px;
  cursor: default;
}

.lib-item.on {
  background: #e9e9eb;
  font-weight: 600;
}

.lib-sec {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  padding: 0 2px;
  color: #4c4c52;
  font-size: 12.5px;
}

.lib-plus {
  margin-left: auto;
  display: flex;
  color: #6f6f75;
}

.lib-file {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 6px 0 0 8px;
  padding: 5px 8px;
  border-radius: 7px;
  font-size: 12.5px;
  cursor: default;
  overflow: hidden;
  white-space: nowrap;
}

.lib-file:hover {
  background: #f3f3f4;
}

.lib-badge {
  display: grid;
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  place-items: center;
  border-radius: 4px;
  background: #2f9cf4;
  color: #fff;
  font-size: 9.5px;
  font-weight: 700;
}

.lib-emoji {
  font-size: 11px;
}

.lib-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.lib-create {
  margin: 8px 0 0 8px;
  padding: 6px 8px;
  color: var(--wb-dim);
  font-size: 12.5px;
}

.lib-foot {
  margin-top: auto;
}

.lib-usage {
  margin: 0 0 6px;
  color: #4c4c52;
  font-size: 12px;
}

.lib-bar {
  height: 4px;
  border-radius: 999px;
  background: #e9e9eb;
}

.lib-bar i {
  display: block;
  width: 0%;
  height: 100%;
  border-radius: 999px;
  background: var(--wb-green);
}

.lib-main {
  min-width: 0;
  flex: 1;
  padding: 18px 28px;
}

.lib-toggle {
  color: #4c4c52;
}

.lib-title {
  margin-top: 14px;
}

.lib-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.lib-tabs-l {
  display: flex;
  gap: 4px;
}

.lib-tab {
  padding: 6px 12px;
  border-radius: 8px;
  color: #4c4c52;
  font-size: 13px;
  cursor: default;
}

.lib-tab.on {
  background: #ececee;
  color: var(--wb-text);
  font-weight: 600;
}

.lib-type {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  font-size: 12.5px;
}

.lib-table {
  margin-top: 12px;
}

.lib-tr {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 1fr 1fr 1fr;
  gap: 12px;
  align-items: center;
  padding: 9px 4px;
  border-bottom: 1px solid #f1f1f3;
  color: var(--wb-text);
  font-size: 13px;
}

.lib-tr.head {
  border-bottom: 1px solid var(--wb-line);
  color: var(--wb-dim);
  font-size: 12px;
}

.lib-file-cell {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---------- 对话页（新建任务 / 助理共用） ---------- */
.chat-wrap {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.chat-wrap.empty {
  justify-content: flex-end;
}

.asst-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 20px 28px 0;
}

.asst-title {
  font-size: 15px;
  font-weight: 700;
}

.asst-conn {
  color: #4c4c52;
  font-size: 12.5px;
}

.asst-conn b {
  color: #2f6bd8;
  font-weight: 600;
  cursor: pointer;
}

/* 空会话主页：标题、快捷入口、输入框整体居中 */
.hero {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 32px 8px;
}

.hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.hero-tabs {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.hero-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  color: #4c4c52;
  font-size: 12.5px;
}

.hero-tab.on {
  border-color: #1f1f23;
  background: #1f1f23;
  color: #fff;
}

.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 34rem;
  margin-top: 34px;
  overflow: hidden;
}

.chip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  color: #4c4c52;
  font-size: 12px;
  white-space: nowrap;
}

.chips-mascot {
  flex-shrink: 0;
  margin-left: 2px;
}

.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  max-width: 46rem;
  width: 100%;
  margin: 0 auto;
  padding: 24px 32px;
}

.user-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  color: var(--wb-dim);
  font-size: 11.5px;
}

.bubble {
  max-width: 78%;
  padding: 8px 14px;
  border-radius: 16px;
  background: #f0f0f1;
  color: var(--wb-text);
  font-size: 13.5px;
  line-height: 1.6;
}

.assistant-msg {
  color: var(--wb-text);
  font-size: 13.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.status {
  color: var(--wb-dim);
  font-size: 12px;
}

.status-label.bad {
  color: #c0392b;
}

.chat-spacer {
  flex: 1;
}

.composer-col {
  max-width: 34rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 14px;
}

.chat-wrap:not(.empty) .composer-col {
  max-width: 46rem;
  padding-right: 32px;
  padding-left: 32px;
}

.composer {
  position: relative;
  padding: 10px 12px 8px;
  border: 1px solid #e4e4e6;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.input {
  display: block;
  width: 100%;
  min-height: 22px;
  max-height: 132px;
  padding: 4px 2px 12px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--wb-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  overflow-y: auto;
}

.input::placeholder {
  color: #b0b0b5;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cbtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #6f6f75;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.cbtn:hover,
.cbtn.on {
  background: #f0f0f1;
}

/* 摆设按钮：不给悬停反馈（与另两个复刻件同一原则） */
.cbtn.deco {
  cursor: default;
}

.cbtn.deco:hover {
  background: none;
}

.cbtn.plus {
  padding: 5px;
}

.spacer {
  flex: 1;
}

.send {
  display: grid;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #35d49a, #0e9f6e);
  color: #fff;
  cursor: pointer;
}

.send:disabled {
  background: #e3e3e6;
  color: #a8a8ad;
  cursor: not-allowed;
}

.send.stop {
  background: #d9534f;
}

.subrow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 2px 0;
}

.sub-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #6f6f75;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.sub-btn:hover,
.sub-btn.on {
  background: #f0f0f1;
}

.asst-foot {
  margin: 8px 0 0;
  color: #b8b8bc;
  font-size: 11.5px;
  text-align: center;
}

/* ---------- 看着能点、但其实没实现的那批元素 ----------
   它们点下去会弹统一提示（"网站试用版部分功能不可用…"，见 @/composables/stubToast），
   所以必须有指针光标：光标不变手型，用户根本不会去点，那句提示也就白写了。
   悬停反馈一律保持很轻 —— 这些不是真功能，不该看起来像真功能。 */
.mi,
.ci,
.fitem,
.perm-row,
.mb-ico,
.nav-item.deco,
.space-row,
.space-sub,
.invite,
.create-btn,
.chip,
.hero-tab,
.asst-conn,
.cbtn.deco,
.lib-search,
.lib-item,
.lib-sec,
.lib-file,
.lib-create,
.lib-toggle,
.lib-tab,
.lib-type,
.lib-tr,
.csearch {
  cursor: pointer;
}

.mb-ico:hover,
.space-row:hover,
.space-sub:hover,
.invite:hover,
.create-btn:hover,
.chip:hover,
.hero-tab:hover,
.lib-item:hover,
.lib-sec:hover,
.lib-create:hover,
.lib-type:hover,
.lib-tr:hover,
.csearch:hover {
  background: #f4f4f5;
}

.space-sub {
  border-radius: 6px;
}

.chip,
.hero-tab,
.lib-tab,
.lib-item,
.lib-tr {
  border-radius: 7px;
}
</style>
