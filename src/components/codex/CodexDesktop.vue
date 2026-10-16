<script setup>
/**
 * ChatGPT Codex 桌面端的复刻件（**可试用**）。
 *
 * 界面按项目目录 codex/ 下的截图 1:1 复刻，文案逐字照抄。
 * 对话是真的：走本项目后端转发到 DeepSeek（模型固定 deepseek-flash，
 * 见 server/routes/agent.js）。原图里模型选择器显示的就是 DeepSeek 提供方，
 * 所以"界面写着 DeepSeek、实际也跑 DeepSeek"对得上，不算挂羊头。
 *
 * 真 / 摆设的边界（与 deepseek HARNESS 复刻件同一套原则）：
 *   真的 —— 输入框、发送/停止、新会话、侧边栏"对话/Scheduled"视图切换、
 *           所有弹出层与设置页的开合、设置页内部的面板切换
 *   摆设 —— 弹出层与设置页里的每一个条目、菜单栏右侧、搜索等
 * 摆设点下去会弹统一提示（"网站试用版部分功能不可用…"），
 * 见 @/composables/stubToast；界面状态不变，提示只解释、不假装功能存在。
 *
 * 试用不做历史持久化，打开即新会话（两个复刻件共用同一个试用 store，
 * 不重置的话上一个复刻件的对话会串到这一个里来）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import HarnessPopover from '@/components/harness/HarnessPopover.vue'
import CodexSettings from '@/components/codex/CodexSettings.vue'
import { showStubToast } from '@/composables/stubToast'
import { useTrialChatStore } from '@/stores/trialChat'

const chat = useTrialChatStore()
const route = useRoute()

/* ============================================================
   弹出层 / 设置页 / 视图 的开合
   ============================================================ */
const openMenu = ref(null)
const settingsOpen = ref(false)

/** 主区当前视图：chat 对话 / scheduled 定时任务页（截图 codex/scheduled页面.png） */
const view = ref('chat')

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

function newChat() {
  chat.newSession()
  view.value = 'chat'
}

function onDocClick() {
  closeMenu()
}

/*
  弹出层里那些"只关菜单"的条目（New project / Show pet / 权限 / 模型 / 加号 /
  插件 / 云端位置…）统一走这里：关菜单 + 给出未实现提示。
*/
function pickStub() {
  closeMenu()
  showStubToast()
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
  chat.newSession() // 打开即新会话，见文件头
  chat.loadModel()

  // ?menu=xxx 用地址直接打开某个弹出层（与 DeepseekHarness 同一约定）
  const m = String(route.query.menu ?? '')
  if (m === 'settings') settingsOpen.value = true
  else if (m === 'scheduled') view.value = 'scheduled'
  else if (m) openMenu.value = m
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydownCapture, true)
})

/* ============================================================
   弹出层内容（纯展示，条目点了只关菜单）
   ============================================================ */

/** 菜单栏四个菜单。dim: true 表示原图里就是灰色不可点 */
const MENUBAR = {
  file: [
    { label: 'New Chat', key: 'Ctrl+N' },
    { label: 'New Temporary Chat', key: 'Ctrl+Shift+N', dim: true },
    { sep: true },
    { label: 'Open Folder…', key: 'Ctrl+O' },
    { sep: true },
    { label: 'Close', key: 'Ctrl+W' },
    { sep: true },
    { label: 'Log Out' },
    { label: 'Quit ChatGPT', key: 'Ctrl+Q' },
  ],
  edit: [
    { label: 'Undo', key: 'Ctrl+Z' },
    { label: 'Redo', key: 'Ctrl+Y' },
    { sep: true },
    { label: 'Cut', key: 'Ctrl+X' },
    { label: 'Copy', key: 'Ctrl+C' },
    { label: 'Paste', key: 'Ctrl+V' },
    { label: 'Delete' },
    { sep: true },
    { label: 'Select All', key: 'Ctrl+A' },
    { sep: true },
    { label: 'Settings…', key: 'Ctrl+,', action: 'settings' },
  ],
  view: [
    { label: 'Toggle Sidebar', key: 'Ctrl+B' },
    { label: 'Toggle Bottom Panel', key: 'Ctrl+J' },
    { label: 'Toggle Pinned Summary' },
    { label: 'Open Terminal', key: 'Ctrl+`' },
    { label: 'Toggle File Tree', key: 'Ctrl+Shift+E' },
    { label: 'Toggle Review Panel', key: 'Alt+Ctrl+B' },
    { sep: true },
    { label: 'Browser', key: '›' },
    { sep: true },
    { label: 'Find', key: 'Ctrl+F' },
    { sep: true },
    { label: 'Previous Chat', key: 'Ctrl+Shift+[' },
    { label: 'Next Chat', key: 'Ctrl+Shift+]' },
    { label: 'Back', key: 'Ctrl+[' },
    { label: 'Forward', key: 'Ctrl+]' },
    { sep: true },
    { label: 'Zoom In', key: 'Ctrl+Shift+=' },
    { label: 'Zoom Out', key: 'Ctrl+-' },
    { label: 'Actual Size', key: 'Ctrl+0' },
    { sep: true },
    { label: 'Toggle Full Screen', key: 'F11' },
  ],
  help: [
    { label: 'Documentation' },
    { label: 'Keyboard Shortcuts', key: 'Ctrl+/' },
    { label: "What's New" },
    { sep: true },
    { label: 'Troubleshooting' },
    { label: 'System Status' },
    { label: 'Send Feedback' },
    { sep: true },
    { label: 'Task Manager' },
    { label: 'Start Performance Trace' },
    { sep: true },
    { label: 'Check for Updates…' },
    { label: 'About ChatGPT' },
  ],
}

function onMenuItem(item) {
  closeMenu()
  if (item.action === 'settings') {
    openSettings()
    return
  }
  // 置灰的项在原产品里也是不可点的，不该弹提示 —— 只有能点的才说明"未实现"
  if (!item.dim) showStubToast()
}

/** 输入框下方加号菜单 */
const PLUS_ADD = [
  { icon: 'paperclip', name: 'Files and folders' },
  { icon: 'folder', name: 'Work in a project', note: 'Start a chat in a project' },
  { icon: 'goal', name: 'Goal', note: 'Set a goal to keep pursuing' },
  { icon: 'bulb', name: 'Plan mode', note: 'Turn plan mode on' },
]
const PLUS_PLUGINS = [
  { icon: 'grid', name: 'Visualize', note: 'Turn ideas and data into interactive visuals' },
]

/** 权限（Ask for approval）菜单 */
const PERMISSIONS = [
  {
    id: 'ask',
    name: 'Ask for approval',
    desc: 'Always ask to edit external files and use the internet',
    icon: 'hand',
  },
  {
    id: 'full',
    name: 'Full access',
    desc: 'Unrestricted access to the internet and any file on your computer',
    icon: 'warning',
    warn: true,
  },
]
const permission = ref('ask')

/** 运行位置（云端选择）菜单 */
const LOCATIONS = [
  {
    id: 'local',
    name: 'On your computer',
    desc: 'Read and edit local files with permission',
    icon: 'monitor',
  },
  {
    id: 'cloud',
    name: 'In the cloud',
    desc: "Can't access local files unless attached",
    icon: 'cloud',
  },
]
// 别叫 location：会把全局 window.location 遮蔽掉，以后谁要用真 location 就踩雷
const runAt = ref('local')

/** Scheduled 页的建议项（截图 codex/scheduled页面.png 逐字照抄） */
const SUGGESTIONS = [
  {
    color: '#4a9cf5',
    name: 'Daily brief',
    when: 'Weekdays at 8:00 AM',
    desc: 'Start each weekday with a summary of your calendar, unread email, and priorities',
  },
  {
    color: '#a371f7',
    name: 'Weekly review',
    when: 'Fridays at 4:00 PM',
    desc: 'Turn your recent work into a concise status update every Friday',
  },
  {
    color: '#3fb27f',
    name: 'Follow-up monitor',
    when: 'Weekdays at 9:00 AM',
    desc: 'Review recent email and calendar activity and flag anything that needs your attention',
  },
]

/** 推理等级。接口里没有这个参数，固定 High，不做成可选项 */
const EFFORT = 'High'

/** 图标一律存路径数据，不引图标库 */
const ICONS = {
  sidebar: [
    'M2.6 3.4h10.8a.8.8 0 0 1 .8.8v7.6a.8.8 0 0 1-.8.8H2.6a.8.8 0 0 1-.8-.8V4.2a.8.8 0 0 1 .8-.8Z',
    'M6 3.4v9.2',
  ],
  back: ['M9.8 3.6 5.4 8l4.4 4.4'],
  forward: ['M6.2 3.6 10.6 8l-4.4 4.4'],
  search: ['M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M9.9 9.9 13 13'],
  newChat: [
    'M3.2 12.8l.4-2.7 7.4-7.4a1.6 1.6 0 0 1 2.2 0l.1.1a1.6 1.6 0 0 1 0 2.2l-7.4 7.4Z',
    'M10.2 3.5l2.3 2.3',
  ],
  clock: ['M8 3.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z', 'M8 5.8V8l1.6 1.2'],
  puzzle: [
    'M6.5 2.8a1.5 1.5 0 0 1 3 0v1.2h2.2a1 1 0 0 1 1 1v2.1a1.5 1.5 0 1 1 0 3v2.1a1 1 0 0 1-1 1H9.5v-2.2a1.5 1.5 0 1 0-3 0v2.2H4.3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.2Z',
  ],
  gear: [
    'M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z',
    'M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7',
    'M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2',
  ],
  help: [
    'M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z',
    'M6.4 6.2a1.7 1.7 0 1 1 2.6 1.4c-.7.4-1 .7-1 1.5',
    'M8 11.4h.01',
  ],
  pet: ['M8 2.6c2.2 0 4 2.6 4 5.6a4 4 0 1 1-8 0c0-3 1.8-5.6 4-5.6Z'],
  paperclip: ['M11 8.2 6.9 12.3a2.4 2.4 0 0 1-3.4-3.4l4.6-4.6a1.6 1.6 0 0 1 2.3 2.3L5.8 11.1'],
  folder: ['M2.2 4.6a1 1 0 0 1 1-1h2.6l1 1.3h6a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V4.6Z'],
  goal: [
    'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4Z',
    'M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z',
    'M8 7.4v1.2',
  ],
  bulb: [
    'M8 2.4a3.6 3.6 0 0 1 1.8 6.7c-.5.3-.8.6-.8 1.1H7c0-.5-.3-.8-.8-1.1A3.6 3.6 0 0 1 8 2.4Z',
    'M7 12h2M7.4 13.6h1.2',
  ],
  grid: ['M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z'],
  cloud: ['M4.5 11.5a2.8 2.8 0 0 1-.4-5.6 3.8 3.8 0 0 1 7.4.7 2.6 2.6 0 0 1-.4 4.9Z'],
  monitor: ['M2.6 3.4h10.8v7.4H2.6z', 'M6 12.8h4'],
  hand: [
    'M5.6 7.2V4.6a1 1 0 0 1 2 0v2.4',
    'M7.6 7V3.4a1 1 0 0 1 2 0V7',
    'M9.6 7V4.2a1 1 0 0 1 2 0v3.6',
    'M11.6 8.4V6.8a1 1 0 0 1 2 0v3a4.6 4.6 0 0 1-4.6 4.6h-.8a4.6 4.6 0 0 1-3.2-1.3l-1.8-2a1.1 1.1 0 0 1 1.6-1.5l.8.9',
  ],
  warning: ['M8 2.6 14 13H2Z', 'M8 6.6v3M8 11.4h.01'],
  plus: ['M8 3.4v9.2M3.4 8h9.2'],
  send: ['M8 12.6V3.6M4.2 7.2 8 3.4l3.8 3.8'],
  chevDown: ['M4.4 6.4 8 10l3.6-3.6'],
  chevRight: ['M6.4 4.4 10 8l-3.6 3.6'],
  check: ['M3.4 8.4 6.4 11.4 12.6 5'],
  bell: ['M8 3a3.6 3.6 0 0 1 3.6 3.6c0 2.6.8 3.6 1.4 4.2H3c.6-.6 1.4-1.6 1.4-4.2A3.6 3.6 0 0 1 8 3Z', 'M6.8 12.6a1.3 1.3 0 0 0 2.4 0'],
  list: ['M3 4.6h10M3 8h10M3 11.4h10'],
}

/* ============================================================
   消息区 / 输入区
   ============================================================ */

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

const modelLabel = computed(() => chat.model?.displayName ?? 'DeepSeek-V4.1-Flash')
</script>

<template>
  <div class="cx">
    <!-- ================= 菜单栏 ================= -->
    <div class="menubar">
      <!-- 设置页里这三个图标不显示（见设置页截图），所以设置时收掉 -->
      <span v-if="!settingsOpen" v-stub class="mb-icons" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="15" height="15">
          <path v-for="(d, i) in ICONS.sidebar" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg viewBox="0 0 16 16" width="15" height="15">
          <path :d="ICONS.back[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg viewBox="0 0 16 16" width="15" height="15">
          <path :d="ICONS.forward[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>

      <span v-for="m in ['file', 'edit', 'view', 'help']" :key="m" class="anchor">
        <button
          type="button"
          class="mb-btn"
          :class="{ on: openMenu === m }"
          @click.stop="toggle(m)"
        >
          {{ m === 'file' ? 'File' : m === 'edit' ? 'Edit' : m === 'view' ? 'View' : 'Help' }}
        </button>
        <HarnessPopover v-if="openMenu === m" align="left" :min-width="m === 'view' ? 246 : 236">
          <template v-for="(item, i) in MENUBAR[m]" :key="i">
            <div v-if="item.sep" class="csep" />
            <div v-else class="ci" :class="{ dim: item.dim }" @click="onMenuItem(item)">
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

    <!-- ================= 设置页（整页替换） ================= -->
    <CodexSettings v-if="settingsOpen" @close="settingsOpen = false" />

    <div v-else class="body">
      <!-- ================= 侧边栏 ================= -->
      <aside class="sidebar">
        <div class="ws-row">
          <span class="anchor">
            <button type="button" class="ws-btn" :class="{ on: openMenu === 'ws' }" @click.stop="toggle('ws')">
              <span class="ws-name">Work</span>
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <HarnessPopover v-if="openMenu === 'ws'" align="left" :min-width="290">
              <div v-stub class="csearch">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                <span class="csearch-ph">Search projects</span>
              </div>
              <div class="cempty">No projects found</div>
              <div class="csep" />
              <div class="ci" @click="pickStub()">
                <span class="ci-ico">
                  <svg viewBox="0 0 16 16" width="14" height="14"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                </span>
                <span class="ci-label">New project</span>
              </div>
            </HarnessPopover>
          </span>

          <span v-stub class="ws-search" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
          </span>
        </div>

        <nav class="nav">
          <button type="button" class="nav-item" :class="{ on: view === 'chat' && !chat.hasMessages }" @click="newChat()">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.newChat" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            New chat
          </button>
          <button type="button" class="nav-item" :class="{ on: view === 'scheduled' }" @click="view = 'scheduled'">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.clock" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Scheduled
          </button>
          <span v-stub class="nav-item deco">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path v-for="(d, i) in ICONS.puzzle" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
            Plugins
          </span>
        </nav>

        <div class="sec-block">
          <p class="sec-title">Projects</p>
          <p class="sec-empty">No projects</p>
          <p v-stub class="sec-title recents">
            Recents
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </p>
        </div>

        <div class="side-foot">
          <button type="button" class="acct" :class="{ on: openMenu === 'account' }" @click.stop="toggle('account')">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path v-for="(d, i) in ICONS.gear" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            deepseek
          </button>
          <span v-stub class="help-ico" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="15" height="15">
              <path v-for="(d, i) in ICONS.help" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
            </svg>
          </span>

          <HarnessPopover v-if="openMenu === 'account'" align="left" side="up" :min-width="240">
            <div class="cacct-head">deepseek</div>
            <div class="csep" />
            <div class="ci" @click="pickStub()">
              <span class="ci-ico">
                <svg viewBox="0 0 16 16" width="15" height="15"><path :d="ICONS.pet[0]" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
              </span>
              <span class="ci-label">Show pet</span>
            </div>
            <div class="ci" @click="openSettings()">
              <span class="ci-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path v-for="(d, i) in ICONS.gear" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="ci-label">Settings</span>
              <span class="ci-key">Ctrl+,</span>
            </div>
          </HarnessPopover>
        </div>
      </aside>

      <!-- ================= 主区 ================= -->
      <section class="main">
        <!-- ---------- Scheduled 页 ---------- -->
        <template v-if="view === 'scheduled'">
          <div class="sched">
            <span v-stub class="create-btn" aria-hidden="true">
              Create
              <svg viewBox="0 0 16 16" width="11" height="11"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
            <h1 class="sched-title">Scheduled tasks</h1>
            <p class="sched-desc">Ask ChatGPT to schedule tasks, set reminders, or monitor for updates</p>

            <div v-stub class="sched-search">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
              </svg>
              <span>Search scheduled tasks</span>
            </div>

            <p class="sched-sec">Suggestions</p>
            <div v-for="s in SUGGESTIONS" :key="s.name" v-stub class="sug">
              <span class="sug-ico" :style="{ color: s.color }" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path v-for="(d, i) in ICONS.bell" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <div class="sug-main">
                <p class="sug-head">
                  <span class="sug-name">{{ s.name }}</span>
                  <span class="sug-when">{{ s.when }}</span>
                </p>
                <p class="sug-desc">{{ s.desc }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ---------- 对话页 ---------- -->
        <template v-else>
          <div class="chat-wrap" :class="{ empty: !chat.hasMessages }">
            <!-- 空会话：居中的 "What should we work on?" -->
            <div v-if="!chat.hasMessages" class="empty-state">
              <h1 class="empty-title">What should we work on?</h1>
            </div>

            <div v-else class="messages">
              <template v-for="m in chat.messages" :key="m.id">
                <div v-if="m.role === 'user'" class="user-msg">
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

            <!-- 输入区。真的能用的：输入框、发送/停止，以及弹出层的开合 -->
            <div class="composer-col">
              <div class="composer">
                <textarea
                  ref="inputEl"
                  class="input"
                  :value="chat.input"
                  rows="1"
                  placeholder="Work with ChatGPT"
                  @input="chat.setInput($event.target.value)"
                  @keydown="onKeydown"
                />

                <div class="controls">
                  <button type="button" class="cbtn plus" :class="{ on: openMenu === 'plus' }" title="Add" @click.stop="toggle('plus')">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </button>

                  <span class="anchor">
                    <button type="button" class="cbtn perm" :class="{ on: openMenu === 'perm' }" @click.stop="toggle('perm')">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.hand" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      Ask for approval
                    </button>
                    <HarnessPopover v-if="openMenu === 'perm'" align="left" side="up" :min-width="420">
                      <div class="citem-head">
                        <span>How should ChatGPT actions be approved?</span>
                        <span v-stub class="clink">Learn more</span>
                      </div>
                      <div v-for="p in PERMISSIONS" :key="p.id" class="citem" :class="{ warn: p.warn }" @click="pickStub()">
                        <span class="ci-ico big">
                          <svg viewBox="0 0 16 16" width="16" height="16">
                            <path v-for="(d, i) in ICONS[p.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </span>
                        <div class="citem-main">
                          <p class="citem-name">{{ p.name }}</p>
                          <p class="citem-desc">{{ p.desc }}</p>
                        </div>
                        <span v-if="p.id === permission" class="ci-check">✓</span>
                      </div>
                    </HarnessPopover>
                  </span>

                  <span class="spacer" />

                  <span class="anchor">
                    <button type="button" class="cbtn model" :class="{ on: openMenu === 'model' }" @click.stop="toggle('model')">
                      <span class="model-name">{{ modelLabel }}</span>
                      <span class="model-effort">{{ EFFORT }}</span>
                    </button>
                    <HarnessPopover v-if="openMenu === 'model'" align="right" side="up" :min-width="270">
                      <div class="mrow" @click="pickStub()">
                        <span class="mrow-label">Model</span>
                        <span class="mrow-value">{{ modelLabel }} <i>›</i></span>
                      </div>
                      <div class="mrow" @click="pickStub()">
                        <span class="mrow-label">Effort</span>
                        <span class="mrow-value">{{ EFFORT }} <i>›</i></span>
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

                <!-- 加号菜单挂 .composer：要整行宽，不能挂 26px 的圆按钮上 -->
                <HarnessPopover v-if="openMenu === 'plus'" align="left" side="up" :min-width="380">
                  <div class="csec">Add</div>
                  <div v-for="a in PLUS_ADD" :key="a.name" class="citem" @click="pickStub()">
                    <span class="ci-ico big">
                      <svg viewBox="0 0 16 16" width="16" height="16">
                        <path v-for="(d, i) in ICONS[a.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <div class="citem-main">
                      <p class="citem-name">{{ a.name }}</p>
                      <p v-if="a.note" class="citem-desc">{{ a.note }}</p>
                    </div>
                  </div>
                  <div class="csec">Plugins</div>
                  <div v-for="a in PLUS_PLUGINS" :key="a.name" class="citem" @click="pickStub()">
                    <span class="ci-ico big blue">
                      <svg viewBox="0 0 16 16" width="16" height="16">
                        <path v-for="(d, i) in ICONS[a.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <div class="citem-main">
                      <p class="citem-name">{{ a.name }}</p>
                      <p class="citem-desc">{{ a.note }}</p>
                    </div>
                  </div>
                </HarnessPopover>
              </div>

              <!-- 输入框下面那行辅助按钮：Choose project / Plugins / 云端选择 -->
              <div class="subrow">
                <span class="anchor">
                  <button type="button" class="sub-btn" :class="{ on: openMenu === 'project' }" @click.stop="toggle('project')">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path :d="ICONS.folder[0]" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                    </svg>
                    Choose project
                  </button>
                  <HarnessPopover v-if="openMenu === 'project'" align="left" side="up" :min-width="290">
                    <div v-stub class="csearch">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                      </svg>
                      <span class="csearch-ph">Search projects</span>
                    </div>
                    <div class="cempty">No projects found</div>
                    <div class="csep" />
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico">
                        <svg viewBox="0 0 16 16" width="14" height="14"><path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                      </span>
                      <span class="ci-label">New project</span>
                    </div>
                  </HarnessPopover>
                </span>

                <span class="anchor">
                  <button type="button" class="sub-btn" :class="{ on: openMenu === 'plugins' }" @click.stop="toggle('plugins')">
                    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                      <path :d="ICONS.plus[0]" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="blue">
                      <path v-for="(d, i) in ICONS.grid" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
                    </svg>
                    Plugins
                  </button>
                  <HarnessPopover v-if="openMenu === 'plugins'" align="left" side="up" :min-width="280">
                    <div v-stub class="csearch">
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                      </svg>
                      <span class="csearch-ph">Search plugins…</span>
                    </div>
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico blue">
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path v-for="(d, i) in ICONS.grid" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
                        </svg>
                      </span>
                      <span class="ci-label">Visualize</span>
                    </div>
                    <div class="csep" />
                    <div class="ci" @click="pickStub()">
                      <span class="ci-ico">
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path v-for="(d, i) in ICONS.puzzle" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
                        </svg>
                      </span>
                      <span class="ci-label">Connect plugins</span>
                      <span class="ci-key">›</span>
                    </div>
                  </HarnessPopover>
                </span>

                <span class="spacer" />

                <span class="anchor">
                  <button type="button" class="sub-btn icon" :class="{ on: openMenu === 'cloud' }" title="Where this chat runs" @click.stop="toggle('cloud')">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS.monitor" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                  <HarnessPopover v-if="openMenu === 'cloud'" align="right" side="up" :min-width="360">
                    <div class="citem-head"><span>Where should this chat run?</span></div>
                    <div v-for="l in LOCATIONS" :key="l.id" class="citem" @click="pickStub()">
                      <span class="ci-ico big">
                        <svg viewBox="0 0 16 16" width="16" height="16">
                          <path v-for="(d, i) in ICONS[l.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </span>
                      <div class="citem-main">
                        <p class="citem-name">{{ l.name }}</p>
                        <p class="citem-desc">{{ l.desc }}</p>
                      </div>
                      <span v-if="l.id === runAt" class="ci-check">✓</span>
                    </div>
                  </HarnessPopover>
                </span>
              </div>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
/*
  配色按截图目测：整体比 deepseek HARNESS 更"灰白平"，几乎不用品牌色，
  强调色只有黑色按钮和插件蓝。
*/
.cx {
  --cx-side: #f7f7f7;
  --cx-line: #ececec;
  --cx-text: #1f1f23;
  --cx-dim: #8e8e93;
  --cx-hover: #efefef;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  color: var(--cx-text);
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
  padding: 0 10px;
  border-bottom: 1px solid var(--cx-line);
  background: #f7f7f7;
  color: #4c4c52;
  font-size: 12.5px;
}

.mb-icons {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-right: 8px;
  color: #6f6f75;
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

.mb-btn:hover {
  background: #efefef;
  color: var(--cx-text);
}

.mb-btn.on {
  background: #e8e8e9;
  color: var(--cx-text);
}

.win-controls {
  display: flex;
  gap: 16px;
  margin-left: auto;
  color: var(--cx-dim);
  font-size: 11px;
  cursor: pointer;
}

/* ---------- 弹出层条目（插槽内容跟着调用方的作用域走，样式写在这里） ---------- */
.ci {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--cx-text);
  font-size: 13.5px;
  cursor: default;
}

.ci:hover {
  background: #f3f3f4;
}

.ci.dim {
  color: #b8b8bc;
}

.ci-ico {
  display: flex;
  width: 17px;
  flex-shrink: 0;
  justify-content: center;
  color: #6f6f75;
}

.ci-ico.big {
  width: 20px;
}

.ci-ico.blue,
.blue {
  color: #2f9cf4;
}

.ci-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ci-key {
  flex-shrink: 0;
  color: var(--cx-dim);
  font-size: 12.5px;
}

.ci-check {
  flex-shrink: 0;
  font-size: 13px;
}

.csep {
  height: 1px;
  margin: 5px -5px;
  background: var(--cx-line);
}

.csec {
  padding: 7px 10px 3px;
  color: var(--cx-dim);
  font-size: 12px;
}

/* 弹出层里的搜索框与"没有结果" */
.csearch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 3px 3px 7px;
  padding: 7px 10px;
  border: 1px solid var(--cx-line);
  border-radius: 8px;
  color: var(--cx-dim);
}

.csearch-ph {
  font-size: 13px;
}

.cempty {
  padding: 6px 10px;
  color: var(--cx-dim);
  font-size: 13px;
}

/* 带说明文字的两行条目 */
.citem {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 7px;
  cursor: default;
}

.citem:hover {
  background: #f3f3f4;
}

.citem-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 10px 9px;
  color: var(--cx-dim);
  font-size: 12.5px;
}

.clink {
  color: var(--cx-dim);
  font-size: 12.5px;
  text-decoration: underline;
}

.citem-main {
  min-width: 0;
  flex: 1;
}

.citem-name {
  margin: 0;
  font-size: 13.5px;
}

.citem-desc {
  margin: 3px 0 0;
  color: var(--cx-dim);
  font-size: 12px;
  line-height: 1.5;
}

/* 权限菜单里 Full access 是警示橙 */
.citem.warn .citem-name {
  color: #c2410c;
}

.citem.warn .citem-desc {
  color: #d97706;
}

.citem.warn .ci-ico {
  color: #d97706;
}

/* 账号弹层的头部 */
.cacct-head {
  padding: 7px 10px;
  font-size: 13.5px;
}

/* 模型菜单：左标题右值 */
.mrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: default;
}

.mrow:hover {
  background: #f3f3f4;
}

.mrow-label {
  font-size: 13.5px;
}

.mrow-value {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cx-dim);
  font-size: 13px;
}

.mrow-value i {
  font-style: normal;
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
  width: 200px;
  flex-shrink: 0;
  flex-direction: column;
  padding: 8px;
  background: var(--cx-side);
}

.ws-row {
  display: flex;
  align-items: center;
  padding: 2px 2px 8px;
}

.ws-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 5px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--cx-text);
  cursor: pointer;
  font: inherit;
}

.ws-btn:hover,
.ws-btn.on {
  background: var(--cx-hover);
}

.ws-name {
  font-size: 15px;
  font-weight: 700;
}

.ws-search {
  display: flex;
  margin-left: auto;
  padding: 3px;
  color: #6f6f75;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--cx-text);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
}

.nav-item.on,
.nav-item:not(.deco):hover {
  background: var(--cx-hover);
}

/* 摆设项：不给悬停反馈（与 deepseek 复刻件同一原则） */
.nav-item.deco {
  color: var(--cx-text);
  cursor: default;
}

.sec-block {
  padding: 14px 8px 0;
}

.sec-title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--cx-dim);
  font-size: 12px;
}

.sec-empty {
  margin: 8px 0 14px;
  color: #bababe;
  font-size: 12.5px;
}

.recents {
  color: var(--cx-dim);
}

.side-foot {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: auto;
  padding: 6px 2px 0;
}

.acct {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--cx-text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.acct:hover,
.acct.on {
  background: var(--cx-hover);
}

.help-ico {
  display: flex;
  margin-left: auto;
  padding: 3px;
  color: #6f6f75;
}

/* ---------- 主区 ---------- */
.main {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
  background: #fff;
}

/* ---------- Scheduled 页 ---------- */
.sched {
  position: relative;
  max-width: 46rem;
  margin: 0 auto;
  padding: 64px 32px;
}

.create-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  background: #1f1f23;
  color: #fff;
  font-size: 13px;
}

.sched-title {
  margin: 0;
  font-size: 21px;
  font-weight: 600;
}

.sched-desc {
  margin: 8px 0 20px;
  color: var(--cx-dim);
  font-size: 13px;
}

.sched-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--cx-line);
  border-radius: 10px;
  color: var(--cx-dim);
  font-size: 13px;
}

.sched-sec {
  margin: 22px 0 4px;
  color: var(--cx-dim);
  font-size: 12.5px;
}

.sug {
  display: flex;
  gap: 12px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--cx-line);
}

.sug-ico {
  display: flex;
  padding-top: 2px;
}

.sug-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
}

.sug-name {
  font-size: 13.5px;
  font-weight: 600;
}

.sug-when {
  color: var(--cx-dim);
  font-size: 12px;
}

.sug-desc {
  margin: 4px 0 0;
  color: var(--cx-dim);
  font-size: 12.5px;
  line-height: 1.5;
}

/* ---------- 对话页 ---------- */
.chat-wrap {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}

.chat-wrap.empty {
  justify-content: center;
}

/* 空会话：标题与输入框作为一个整体居中 */
.empty-state {
  display: flex;
  justify-content: center;
  padding: 0 32px 18px;
}

.empty-title {
  margin: 0;
  font-size: 21px;
  font-weight: 500;
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
  justify-content: flex-end;
}

.bubble {
  max-width: 78%;
  padding: 8px 14px;
  border-radius: 18px;
  background: #f0f0f1;
  color: var(--cx-text);
  font-size: 13.5px;
  line-height: 1.6;
}

.assistant-msg {
  color: var(--cx-text);
  font-size: 13.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.status {
  color: var(--cx-dim);
  font-size: 12px;
}

.status-label.bad {
  color: #c0392b;
}

.composer-col {
  max-width: 34rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 14px;
}

/* 有对话时输入框贴底，不再跟着居中块走 */
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
  color: var(--cx-text);
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

.cbtn.plus {
  padding: 5px;
}

.spacer {
  flex: 1;
}

.model-name {
  color: #6f6f75;
  font-size: 13px;
}

.model-effort {
  color: #a8a8ad;
  font-size: 13px;
}

.send {
  display: grid;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: #1f1f23;
  color: #fff;
  cursor: pointer;
}

.send:disabled {
  background: #c9c9cd;
  cursor: not-allowed;
}

.send.stop {
  background: #d9534f;
}

/* 输入框下面那行辅助按钮 */
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

.sub-btn.icon {
  padding: 4px 6px;
}

/* ---------- 看着能点、但没实现的那些元素 ----------
   它们点下去会弹统一提示（"网站试用版部分功能不可用…"），
   所以必须有指针光标 —— 光标不变手型，用户根本不会去点，那句提示也就白写了。
   悬停反馈保持很轻：这些不是真功能，不该看起来像真功能。 */
.mb-icons,
.ws-search,
.nav-item.deco,
.sec-title.recents,
.help-ico,
.create-btn,
.sched-search,
.sug,
.clink,
.csearch,
.win-controls {
  cursor: pointer;
}

.nav-item.deco:hover,
.help-ico:hover,
.csearch:hover,
.create-btn:hover,
.sug:hover,
.clink:hover,
.win-controls:hover {
  background: #f4f4f5;
}

.sug:hover {
  border-radius: 8px;
}
</style>
