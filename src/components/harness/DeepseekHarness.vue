<script setup>
/**
 * deepseek HARNESS 主页的复刻件（**可试用**）。
 *
 * 界面按项目目录 deepseekharness/ 下的截图 1:1 复刻，文案逐字照抄。
 * 但上面那层已经不是静态外壳了 —— 输入框真的能对话，走的是本项目后端
 * 转发到 DeepSeek（模型固定为 deepseek-flash，见 server/routes/agent.js）。
 *
 * 哪些是真的、哪些是摆设，这里划清界限：
 *   真的 —— 输入框、发送/停止、新会话、**十个弹出层的开与关**、设置弹窗的面板切换
 *   摆设 —— 菜单里的条目、插件、搜索/排序图标、标签页、模型/权限/工作区选择、附件按钮
 *
 * 摆设的反馈策略：
 *   - **弹出层本身能开能关**，菜单条目点了会关掉菜单，并弹出一条统一提示
 *     （"网站试用版部分功能不可用…"，见 @/composables/stubToast）——
 *     打开一个"死的"菜单比点一个"死的"按钮更让人困惑，所以菜单必须能开能关。
 *   - **弹出层之外的摆设按钮同样给这条提示**：点下去完全没动静时，
 *     用户分不清是"这里没实现"还是"页面卡了"，一句提示把这件事说清楚。
 *   两种情况下界面状态都不变 —— 提示只解释，不假装功能存在。
 *
 * 试用不做历史会话持久化，刷新即清空；侧边栏因此只剩当前这一轮。
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import HarnessMark from '@/components/harness/HarnessMark.vue'
import HarnessPopover from '@/components/harness/HarnessPopover.vue'
import HarnessSettings from '@/components/harness/HarnessSettings.vue'
import { showStubToast } from '@/composables/stubToast'
import { useTrialChatStore } from '@/stores/trialChat'

const chat = useTrialChatStore()
const route = useRoute()

/* ============================================================
   弹出层的开合
   ============================================================
   同时只允许开一个：原产品也是这个行为，而且不做这个约束时，
   点开第二个菜单会留下第一个在后面，看起来像界面花了。
*/
const openMenu = ref(null)
const settingsOpen = ref(false)

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

/*
  弹出层里那些"只关菜单"的条目（菜单项、选项、编辑器列表…）统一走这里：
  关菜单 + 给出未实现提示。界面状态一点不改，只把"这里是复刻件"说明白。
*/
function pickStub() {
  closeMenu()
  showStubToast()
}

/*
  点界面任意处关掉菜单。
  触发元素上用的是 @click.stop —— 不拦的话这一下会先冒泡到这里关掉，
  再执行 toggle 打开，净效果是"点了没反应"。
*/
function onDocClick() {
  closeMenu()
}

/*
  Esc 的优先级：先关弹出层/设置弹窗，再关整个复刻弹窗。
  用**捕获阶段**监听，并且没东西可关时直接放行 ——
  这样既保证"菜单开着时按 Esc 只关菜单"，也不影响外层 AgentModal 的 Esc 关闭。
  （依赖监听器注册顺序来抢事件太脆，捕获阶段与注册先后无关。）
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
  /*
    打开即新会话。两个复刻件共用同一个试用 store，不重置的话，
    上一个复刻件里的对话会原样出现在这一个的界面里 ——
    在 ChatGPT 的界面里看到 deepseek HARNESS 的对话，那就穿帮了。
  */
  chat.newSession()
  chat.loadModel()

  /*
    用地址直接打开某个弹出层：?menu=plus 之类。
    和 AgentView 的 ?open= 是同一个理由 —— 这页没有可交互测试，
    能不能"按 URL 复现某个状态"就决定了它能不能被自动截图核对。
    取值非法时不开，不报错。
  */
  const m = String(route.query.menu ?? '')
  if (m === 'settings') settingsOpen.value = true
  else if (m) openMenu.value = m
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydownCapture, true)
})

/* ============================================================
   弹出层的内容（纯展示，条目点了不做任何事，只关菜单）
   ============================================================ */

/**
 * 侧边栏工作区树。
 *
 * 原截图里列了一堆工作区与历史会话，但试用页不做历史存储，
 * 列出来的只能是我们编的 —— 所以只留当前这一轮，如实反映"这里有什么"。
 * 下面的工作区选择器同理，只有 "试用" 一个选项。
 */
const tree = computed(() => [
  {
    name: '试用',
    open: true,
    active: true,
    items: [{ name: chat.title, on: true }],
  },
])

const WORKSPACES = [{ name: '试用', on: true }]

/** 输入框上方的模式选择器 */
const MODES = [
  {
    id: 'standard',
    name: '标准模式',
    desc: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检察、编辑和终端等工具。',
  },
  {
    id: 'ptc',
    name: 'PTC 模式',
    desc: '包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。',
  },
  {
    id: 'minimal',
    name: '极简模式',
    desc: 'Agent 仅使用终端工具完成任务，适合测试和对比其基础表现。',
  },
  {
    id: 'cordis',
    name: '创造模式',
    desc: '用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',
  },
]
const mode = ref('standard')

/** 输入框左下角的权限选择器 */
const PERMISSIONS = [
  { id: 'read', name: '仅可查看', icon: 'shield' },
  { id: 'modify', name: '工作区内修改', icon: 'shieldCheck' },
  { id: 'full', name: '完全权限', icon: 'shieldAlert' },
]
const permission = ref('modify')
const permissionName = computed(
  () => PERMISSIONS.find((p) => p.id === permission.value)?.name ?? '',
)

/** 推理等级。接口里没有这个参数，是纯展示 —— 所以固定 High，不做成可选项 */
const REASONING = 'High'

/** 输入框下方加号菜单：分「添加」和「指令」两块 */
const PLUS_ADD = [
  { icon: 'file', name: '文件', key: 'file', note: '' },
  { icon: 'goal', name: '目标', key: 'goal', note: '设置或查看长期任务目标' },
  { icon: 'plan', name: '计划', key: 'plan', note: '进入或退出计划模式' },
  { icon: 'feedback', name: '反馈', key: 'feedback', note: '发送关于当前会话的反馈' },
]
const PLUS_CMD = [
  { icon: 'compact', name: '压缩', key: 'compact', note: '压缩以上对话内容' },
  { icon: 'permission', name: '权限', key: 'permission', note: '切换权限预设（沙箱模式与审批策略）' },
  { icon: 'model', name: '模型', key: 'model', note: '选择本会话使用的模型', hi: true },
  { icon: 'export', name: '下载日志', key: 'export', note: '将当前会话内容导出为 ZIP' },
]

/** 工作区标题右侧那个筛选图标弹出的视图选项 */
const VIEW_GROUPS = [
  { icon: 'folder', name: '按工作区', on: true },
  { icon: 'folderTree', name: '按工作区树' },
  { icon: 'list', name: '单列表' },
]
const VIEW_SORTS = [
  { icon: 'upDown', name: '手动排序' },
  { icon: 'clock', name: '最近更新', on: true },
]
const VIEW_FILTERS = [
  { icon: 'archive', name: '隐藏已归档', on: true },
  { icon: 'chat', name: '全部对话（显示已归档）' },
  { icon: 'archiveOpen', name: '仅显示已归档' },
]

/** 右上角文件图标弹出的编辑器列表 */
const EDITORS = [
  { id: 'explorer', name: '文件资源管理器（默认）' },
  { id: 'vscode', name: 'VS Code' },
  { id: 'pycharm', name: 'PyCharm' },
  { id: 'gitbash', name: 'Git Bash' },
]

/** 菜单里用到的图标，一律存路径数据，不引图标库 */
const ICONS = {
  file: ['M4.6 2.2h4.3l3 3v8.4H4.6z', 'M8.6 2.4v3.1h3.1'],
  goal: [
    'M8 2.4a5.6 5.6 0 1 0 0 11.2A5.6 5.6 0 0 0 8 2.4Z',
    'M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z',
    'M8 7.4v1.2',
  ],
  plan: ['M3.4 3.2h9.2v9.6H3.4z', 'M5.6 6.3h4.8M5.6 8.7h4.8M5.6 11h3.2'],
  feedback: ['M2.6 8.1 13.4 3.3 10.8 12.9 8.2 9.2Z', 'M8.2 9.2 13.4 3.3'],
  compact: ['M8 3.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Z', 'M8 3.2a4.8 4.8 0 0 1 0 9.6Z'],
  permission: [
    'M8 2.4 12.8 4v4c0 2.5-1.8 4.4-4.8 5.2C5 12.4 3.2 10.5 3.2 8V4Z',
    'M6.3 8.1 7.6 9.4l2.4-2.6',
  ],
  model: ['M3.6 3.6h8.8v8.8H3.6z', 'M6.4 6.4h.04M9.6 6.4h.04M6.4 9.6h.04M9.6 9.6h.04'],
  export: ['M8 2.9v7.3', 'M5.2 7.4 8 10.2l2.8-2.8', 'M3.4 12.5h9.2'],
  shield: ['M8 2.4 12.8 4v4c0 2.5-1.8 4.4-4.8 5.2C5 12.4 3.2 10.5 3.2 8V4Z', 'M8 6.2v3M8 11h.01'],
  shieldCheck: [
    'M8 2.4 12.8 4v4c0 2.5-1.8 4.4-4.8 5.2C5 12.4 3.2 10.5 3.2 8V4Z',
    'M6.3 8.1 7.6 9.4l2.4-2.6',
  ],
  shieldAlert: [
    'M8 2.4 12.8 4v4c0 2.5-1.8 4.4-4.8 5.2C5 12.4 3.2 10.5 3.2 8V4Z',
    'M8 6v2.6M8 10.6h.01',
  ],
  folder: ['M2.2 4.6a1 1 0 0 1 1-1h2.6l1 1.3h6a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V4.6Z'],
  folderTree: [
    'M2.2 4.6a1 1 0 0 1 1-1h2.6l1 1.3h6a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V4.6Z',
    'M5.2 8h5.6',
  ],
  list: ['M3 4.6h10M3 8h10M3 11.4h10'],
  upDown: ['M5.4 12V6.2M3.6 8 5.4 6.2 7.2 8', 'M10.6 4v5.8M8.8 8l1.8 1.8L12.4 8'],
  clock: ['M8 3.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z', 'M8 6v2.3l1.7 1'],
  archive: ['M2.6 3.4h10.8v2.6H2.6z', 'M3.6 6v6.6h8.8V6', 'M6.4 8.6h3.2'],
  archiveOpen: ['M2.6 3.4h10.8v2.6H2.6z', 'M3.6 6v6.6h8.8V6', 'M6.4 8.8h3.2'],
  chat: ['M8 3.2c2.9 0 5.2 2 5.2 4.6S10.9 12.4 8 12.4H5.2L3.2 13.8l.5-2.1C3 11 2.8 9.5 2.8 7.8 2.8 5.2 5.1 3.2 8 3.2Z'],
}

/* ============================================================
   消息区
   ============================================================ */

/** 助手那条消息下面的状态行文案 */
function statusOf(m) {
  if (m.error) return m.error
  if (m.stopped) return '已停止'
  if (m.text) return `已完成，用时 ${((m.ms ?? 0) / 1000).toFixed(1)} 秒`
  return '没有返回内容'
}

/**
 * 用户消息下面那行时间。「10月2日 21:05」这种写法是原图的格式，
 * 不复用 Intl.DateTimeFormat —— 它默认会带年份，和原图对不上。
 */
function fmtTime(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 输入框：内容变高时自动增高，最多 6 行 */
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
  // Enter 发送，Shift+Enter 换行 —— 聊天框的通用约定
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    chat.send()
  }
}

/** 输入框右侧显示的模型名。用库里真实的显示名，拿不到时回落到固定值 */
const modelLabel = computed(() => chat.model?.displayName ?? 'DeepSeek-V4.1-Flash')

/** 底部统计。没有真实数据时显示「—」，不拿假数字凑 */
const stats = computed(() => ({
  rounds: chat.rounds,
  tps: chat.lastTps,
  tokens: chat.totalTokens,
  cache: chat.cacheHitRate,
  context: chat.contextPercent,
}))

function fmtTokens(n) {
  if (!n) return '—'
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)
}

/*
  上下文占用。短对话算出来远小于 1%，四舍五入成 0% 看着像"没数据"，
  所以不足 1% 时显示 <1%，和真的 0 区分开。
*/
const contextLabel = computed(() => {
  const p = stats.value.context
  if (p === null) return '—'
  if (p === 0 && chat.lastPromptTokens) return '<1%'
  return `${p}%`
})
</script>

<template>
  <!-- 整个复刻件包在一个"应用窗口"里，外层的预览说明由页面负责 -->
  <div class="dh">
    <!-- ================= 顶部应用菜单栏 ================= -->
    <div class="menubar">
      <span v-stub class="mb-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" />
          <path d="M6 2.5v11" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </span>

      <span class="anchor">
        <button
          type="button"
          class="mb-btn"
          :class="{ on: openMenu === 'app' }"
          @click.stop="toggle('app')"
        >
          应用
        </button>
        <HarnessPopover v-if="openMenu === 'app'" align="left" :min-width="188">
          <div class="mi" @click="pickStub()">关于 DeepSeek Harness</div>
          <div class="sep" />
          <div class="mi" @click="pickStub()">检查更新…</div>
          <div class="mi" @click="pickStub()">管理 dsh 命令…</div>
          <div class="sep" />
          <div class="mi" @click="pickStub()">退出</div>
        </HarnessPopover>
      </span>

      <span class="anchor">
        <button
          type="button"
          class="mb-btn"
          :class="{ on: openMenu === 'edit' }"
          @click.stop="toggle('edit')"
        >
          编辑
        </button>
        <HarnessPopover v-if="openMenu === 'edit'" align="left" :min-width="180">
          <div class="mi" @click="pickStub()">
            <span class="mi-label">撤销</span><span class="mi-key">Ctrl+Z</span>
          </div>
          <div class="mi" @click="pickStub()">
            <span class="mi-label">重做</span><span class="mi-key">Ctrl+Y</span>
          </div>
          <div class="sep" />
          <div class="mi" @click="pickStub()">
            <span class="mi-label">剪切</span><span class="mi-key">Ctrl+X</span>
          </div>
          <div class="mi" @click="pickStub()">
            <span class="mi-label">复制</span><span class="mi-key">Ctrl+C</span>
          </div>
          <div class="mi" @click="pickStub()">
            <span class="mi-label">粘贴</span><span class="mi-key">Ctrl+V</span>
          </div>
          <div class="mi" @click="pickStub()"><span class="mi-label">删除</span></div>
          <div class="sep" />
          <div class="mi" @click="pickStub()">
            <span class="mi-label">全选</span><span class="mi-key">Ctrl+A</span>
          </div>
        </HarnessPopover>
      </span>

      <span v-stub class="win-controls" aria-hidden="true">
        <span>─</span><span>▢</span><span>✕</span>
      </span>
    </div>

    <div class="body">
      <!-- ================= 侧边栏 ================= -->
      <aside class="sidebar">
        <div class="brand">
          <HarnessMark :size="22" />
          <span class="brand-name">deepseek</span>
          <span class="brand-badge">HARNESS</span>
        </div>

        <button type="button" class="new-session" @click="chat.newSession()">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M8 5.4v5.2M5.4 8h5.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          新会话
        </button>

        <div v-stub class="nav-row">
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
              d="M6 2.5h2.2a1 1 0 0 1 .8.4l.9 1.2h3.6a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
              fill="none" stroke="currentColor" stroke-width="1.2"
            />
            <path d="M9.6 6.4v3M8.1 7.9h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
          </svg>
          插件
        </div>

        <div class="section-head">
          <span>工作区</span>
          <span class="head-icons">
            <span v-stub class="ico-btn" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.3" />
                <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
            </span>

            <!-- 视图选项：分组方式 / 排序方式 / 筛选会话 -->
            <span class="anchor">
              <button
                type="button"
                class="ico-btn"
                :class="{ on: openMenu === 'view' }"
                title="视图选项"
                @click.stop="toggle('view')"
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path d="M2 5h8M12 5h2M2 11h2M6 11h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                  <circle cx="11" cy="5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" />
                  <circle cx="5" cy="11" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" />
                </svg>
              </button>
              <HarnessPopover v-if="openMenu === 'view'" align="right" :min-width="214">
                <div class="sec">分组方式</div>
                <div v-for="g in VIEW_GROUPS" :key="g.name" class="mi" @click="pickStub()">
                  <span class="mi-ico">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS[g.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="mi-label">{{ g.name }}</span>
                  <span v-if="g.on" class="mi-check">✓</span>
                </div>

                <div class="sep" />
                <div class="sec">排序方式</div>
                <div v-for="s in VIEW_SORTS" :key="s.name" class="mi" @click="pickStub()">
                  <span class="mi-ico">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS[s.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="mi-label">{{ s.name }}</span>
                  <span v-if="s.on" class="mi-check">✓</span>
                </div>

                <div class="sep" />
                <div class="sec">筛选会话</div>
                <div v-for="f in VIEW_FILTERS" :key="f.name" class="mi" @click="pickStub()">
                  <span class="mi-ico">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS[f.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="mi-label">{{ f.name }}</span>
                  <span v-if="f.on" class="mi-check">✓</span>
                </div>
              </HarnessPopover>
            </span>

            <span v-stub class="ico-btn" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M2 4.6a1 1 0 0 1 1-1h2.4l1 1.2H12a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.6Z"
                  fill="none" stroke="currentColor" stroke-width="1.2"
                />
                <path d="M8 7v3.2M6.4 8.6h3.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
              </svg>
            </span>
          </span>
        </div>

        <div class="tree">
          <template v-for="node in tree" :key="node.name">
            <div v-stub class="row folder" :class="{ active: node.active }">
              <svg class="ico" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  d="M1.8 4.2a1 1 0 0 1 1-1h3l1 1.3h6.4a1 1 0 0 1 1 1v6.3a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z"
                  fill="none" stroke="currentColor" stroke-width="1.2"
                />
              </svg>
              <span class="label">{{ node.name }}</span>
            </div>

            <template v-if="node.open">
              <div
                v-for="item in node.items"
                :key="node.name + item.name"
                v-stub
                class="row session"
                :class="{ on: item.on }"
              >
                <span class="label">{{ item.name }}</span>
                <span v-if="item.ago" class="ago">{{ item.ago }}</span>
              </div>
            </template>
          </template>
        </div>

        <!-- 账号：点一下弹出「设置 / 意见反馈 / 退出登录」 -->
        <div class="account anchor">
          <button
            type="button"
            class="acct-btn"
            :class="{ on: openMenu === 'account' }"
            @click.stop="toggle('account')"
          >
            <span class="avatar" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="13" height="13">
                <circle cx="8" cy="5.6" r="2.6" fill="currentColor" />
                <path d="M2.8 13.4c.6-2.4 2.7-3.8 5.2-3.8s4.6 1.4 5.2 3.8" fill="currentColor" />
              </svg>
            </span>
            176******83@163.com
          </button>

          <HarnessPopover v-if="openMenu === 'account'" align="left" side="up" :min-width="190">
            <div class="mi" @click="openSettings()">
              <span class="mi-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path d="M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path d="M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="mi-label">设置</span>
              <span class="mi-key">Ctrl+,</span>
            </div>
            <div class="mi" @click="pickStub()">
              <span class="mi-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path v-for="(d, i) in ICONS.feedback" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="mi-label">意见反馈</span>
            </div>
            <div class="mi" @click="pickStub()">
              <span class="mi-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path d="M9.4 3.6h2.2a1.2 1.2 0 0 1 1.2 1.2v6.4a1.2 1.2 0 0 1-1.2 1.2H9.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                  <path d="M3.2 8h6.2M7.2 5.8 9.4 8l-2.2 2.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="mi-label">退出登录</span>
            </div>
          </HarnessPopover>
        </div>
      </aside>

      <!-- ================= 主区 ================= -->
      <section class="main">
        <!--
          会话头与标签页只在有对话时出现。
          空会话时原产品也要把它收掉 —— 所以不是"忘了做"。
        -->
        <template v-if="chat.hasMessages">
          <header class="conv-head">
            <span class="conv-title">{{ chat.title }}</span>
            <span v-stub class="mode-chip">
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                <path
                  d="M8 2.4 13 4v4.2c0 2.6-1.9 4.6-5 5.4-3.1-.8-5-2.8-5-5.4V4l5-1.6Z"
                  fill="none" stroke="currentColor" stroke-width="1.2"
                />
              </svg>
              标准模式
            </span>

            <span class="head-right">
              <span class="anchor">
                <span class="seg">
                  <span class="seg-icon">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M1.6 4.3a1.1 1.1 0 0 1 1.1-1.1h3.4l1.1 1.4h6.1a1.1 1.1 0 0 1 1.1 1.1v6.5a1.1 1.1 0 0 1-1.1 1.1H2.7a1.1 1.1 0 0 1-1.1-1.1V4.3Z"
                        fill="#f5c144"
                      />
                      <path
                        d="M1.6 6.4h12.7v5.8a1.1 1.1 0 0 1-1.1 1.1H2.7a1.1 1.1 0 0 1-1.1-1.1V6.4Z"
                        fill="#ffd76e"
                      />
                      <path
                        d="M1.6 6.4h12.7v5.8a1.1 1.1 0 0 1-1.1 1.1H2.7a1.1 1.1 0 0 1-1.1-1.1V6.4Z"
                        fill="none" stroke="#e0a92c" stroke-width="0.9"
                      />
                    </svg>
                  </span>
                  <button
                    type="button"
                    class="seg-btn"
                    :class="{ on: openMenu === 'editor' }"
                    title="在编辑器中打开"
                    @click.stop="toggle('editor')"
                  >
                    <span class="seg-chev">⌄</span>
                  </button>
                </span>

                <HarnessPopover v-if="openMenu === 'editor'" align="right" side="down" :min-width="228">
                  <div v-for="ed in EDITORS" :key="ed.id" class="mi" @click="pickStub()">
                    <span class="mi-ico">
                      <!-- 各家编辑器的图标是简化画法，不是官方 logo，够认出是谁就行 -->
                      <svg v-if="ed.id === 'explorer'" viewBox="0 0 16 16" width="15" height="15">
                        <path d="M1.6 4.3a1.1 1.1 0 0 1 1.1-1.1h3.4l1.1 1.4h6.1a1.1 1.1 0 0 1 1.1 1.1v6.5a1.1 1.1 0 0 1-1.1 1.1H2.7a1.1 1.1 0 0 1-1.1-1.1V4.3Z" fill="#f5c144" />
                        <path d="M1.6 6.4h12.7v5.8a1.1 1.1 0 0 1-1.1 1.1H2.7a1.1 1.1 0 0 1-1.1-1.1V6.4Z" fill="#ffd76e" />
                      </svg>
                      <svg v-else-if="ed.id === 'vscode'" viewBox="0 0 16 16" width="15" height="15">
                        <path d="M11.6 1.4 6.2 6.4 3.4 4.2 2.2 4.8l2.2 3.2-2.2 3.2 1.2.6 2.8-2.2 5.4 5 1.8-.9V2.3ZM11.6 4.9v6.2L8.2 8Z" fill="#2f9cf4" />
                      </svg>
                      <svg v-else-if="ed.id === 'pycharm'" viewBox="0 0 16 16" width="15" height="15">
                        <rect x="1.4" y="1.4" width="13.2" height="13.2" rx="3" fill="#1c1c22" />
                        <rect x="1.4" y="1.4" width="6.6" height="6.6" fill="#21d789" />
                        <rect x="1.4" y="8" width="6.6" height="6.6" fill="#f7d046" />
                        <rect x="8" y="8" width="6.6" height="6.6" fill="#2f9cf4" />
                      </svg>
                      <svg v-else viewBox="0 0 16 16" width="15" height="15">
                        <path d="M8 1.6 14 4.6 8 7.6 2 4.6Z" fill="#f14e32" />
                        <path d="M2 4.6 8 7.6v6.4L2 11Z" fill="#f5a623" />
                        <path d="M14 4.6 8 7.6v6.4l6-3Z" fill="#2f9cf4" />
                      </svg>
                    </span>
                    <span class="mi-label">{{ ed.name }}</span>
                  </div>
                </HarnessPopover>
              </span>

              <span v-stub class="dots" aria-hidden="true">···</span>

              <span v-stub class="panel" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path d="M6.2 2.6v10.8" stroke="currentColor" stroke-width="1.2" />
                </svg>
              </span>
            </span>
          </header>

          <nav class="tabs">
            <span class="tab on">对话</span>
            <span v-stub class="tab">轨迹</span>
          </nav>
        </template>

        <div class="messages">
          <!-- 空会话：原图是居中的「探索未至之境 · 预览版」 -->
          <div v-if="!chat.hasMessages" class="empty-state">
            <HarnessMark :size="30" />
            <span class="es-title">探索未至之境</span>
            <span class="es-badge">预览版</span>
          </div>

          <template v-for="m in chat.messages" :key="m.id">
            <!-- 用户消息：右对齐淡紫气泡，下面跟一行时间 + 复制图标 -->
            <div v-if="m.role === 'user'" class="user-msg">
              <div class="bubble">{{ m.text }}</div>
              <div class="user-meta">
                <span class="time">{{ fmtTime(m.at) }}</span>
                <span v-stub class="copy-ico" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="13" height="13">
                    <rect x="5.6" y="5.6" width="7.6" height="7.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2" />
                    <path d="M10.4 3.2H4.2a1.4 1.4 0 0 0-1.4 1.4v6.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                  </svg>
                </span>
              </div>
            </div>

            <!-- 助手消息：左对齐正文；结束后跟一条状态行 -->
            <template v-else>
              <div v-if="m.text" class="assistant-msg">{{ m.text }}</div>
              <div v-if="!m.streaming" class="status">
                <span class="status-label" :class="{ bad: m.error }">{{ statusOf(m) }}</span>
                <span v-stub class="status-chev" aria-hidden="true">⌄</span>
                <span class="rule" />
              </div>
            </template>
          </template>
        </div>

        <!--
          输入区。真正能用的只有输入框、发送键，以及下面这几个弹出层的开合；
          弹出层里的条目都是摆设。
        -->
        <div class="composer">
          <!--
            空会话时输入框上方多一行「工作区 + 模式」选择器，有对话后收起 ——
            这是原产品的行为，不是我们的取舍。
          -->
          <div v-if="!chat.hasMessages" class="composer-top">
            <span class="anchor">
              <button
                type="button"
                class="pill"
                :class="{ on: openMenu === 'ws' }"
                @click.stop="toggle('ws')"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.folder" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ WORKSPACES[0].name }}
                <span class="chev">⌄</span>
              </button>
              <HarnessPopover v-if="openMenu === 'ws'" align="left" side="down" :min-width="230">
                <div v-for="w in WORKSPACES" :key="w.name" class="mi" @click="pickStub()">
                  <span class="mi-ico">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS.folder" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="mi-label">{{ w.name }}</span>
                  <span v-if="w.on" class="mi-check">✓</span>
                </div>
              </HarnessPopover>
            </span>

            <span class="anchor">
              <button
                type="button"
                class="pill"
                :class="{ on: openMenu === 'mode' }"
                @click.stop="toggle('mode')"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.shieldCheck" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                标准模式
                <span class="chev">⌄</span>
              </button>
              <HarnessPopover v-if="openMenu === 'mode'" align="left" side="down" :min-width="336">
                <div v-for="mo in MODES" :key="mo.id" class="mode-item" @click="pickStub()">
                  <div class="mode-item-top">
                    <span class="mode-item-name">{{ mo.name }}</span>
                    <span v-if="mo.id === mode" class="mi-check">✓</span>
                  </div>
                  <p class="mode-item-desc">{{ mo.desc }}</p>
                </div>
              </HarnessPopover>
            </span>
          </div>

          <textarea
            ref="inputEl"
            class="input"
            :value="chat.input"
            rows="1"
            :placeholder="
              chat.hasMessages
                ? '发消息或创建任务，/ 调用指令，@ 文件或对话'
                : '描述你想要构建的内容，/ 调用指令，@ 文件或对话'
            "
            @input="chat.setInput($event.target.value)"
            @keydown="onKeydown"
          />

          <div class="controls">
            <button
              type="button"
              class="plus"
              :class="{ on: openMenu === 'plus' }"
              title="添加"
              @click.stop="toggle('plus')"
            >
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path d="M8 3.4v9.2M3.4 8h9.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>

            <span class="anchor">
              <button
                type="button"
                class="chip"
                :class="{ on: openMenu === 'perm' }"
                @click.stop="toggle('perm')"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path v-for="(d, i) in ICONS.permission" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ permissionName }}
                <span class="chev">⌄</span>
              </button>
              <HarnessPopover v-if="openMenu === 'perm'" align="left" side="up" :min-width="186">
                <div v-for="p in PERMISSIONS" :key="p.id" class="mi" @click="pickStub()">
                  <span class="mi-ico">
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path v-for="(d, i) in ICONS[p.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="mi-label">{{ p.name }}</span>
                  <span v-if="p.id === permission" class="mi-check">✓</span>
                </div>
              </HarnessPopover>
            </span>

            <span class="spacer" />

            <!-- 模型选择器：模型名 + 推理等级 + chevron（原图三样都有） -->
            <span class="anchor">
              <button
                type="button"
                class="model-btn"
                :class="{ on: openMenu === 'model' }"
                @click.stop="toggle('model')"
              >
                <span class="model">{{ modelLabel }}</span>
                <span class="level">{{ REASONING }}</span>
                <span class="chev">⌄</span>
              </button>
            </span>

            <button
              type="button"
              class="send"
              :class="{ stop: chat.sending }"
              :disabled="!chat.sending && !chat.canSend"
              :title="chat.sending ? '停止生成' : '发送（Enter）'"
              @click="chat.sending ? chat.stop() : chat.send()"
            >
              <!-- 生成中变成停止键：否则用户没有别的办法打断一次已经在跑的请求 -->
              <svg v-if="chat.sending" viewBox="0 0 16 16" width="13" height="13">
                <rect x="4" y="4" width="8" height="8" rx="1.6" fill="currentColor" />
              </svg>
              <svg v-else viewBox="0 0 16 16" width="15" height="15">
                <path d="M8 12.6V3.6M4.2 7.2 8 3.4l3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <!--
            模型菜单与加号菜单挂在 .composer 上，不挂在按钮上：
            挂按钮上，stretch/靠右 出来的位置就跟着按钮跑，而不是跟整行对齐。
          -->
          <HarnessPopover v-if="openMenu === 'model'" align="right" side="up" :min-width="276">
            <div class="mrow" @click="pickStub()">
              <span class="mrow-label">模型</span>
              <span class="mrow-value">{{ modelLabel }} <i>›</i></span>
            </div>
            <div class="mrow" @click="pickStub()">
              <span class="mrow-label">推理等级</span>
              <span class="mrow-value">{{ REASONING }} <i>›</i></span>
            </div>
          </HarnessPopover>

          <HarnessPopover v-if="openMenu === 'plus'" align="stretch" side="up">
            <div class="sec">添加</div>
            <div v-for="a in PLUS_ADD" :key="a.key" class="mi" @click="pickStub()">
              <span class="mi-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path v-for="(d, i) in ICONS[a.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="mi-label">{{ a.name }}</span>
              <span class="mi-key">{{ a.key }}</span>
            </div>

            <div class="sep" />
            <div class="sec">指令</div>
            <div v-for="a in PLUS_CMD" :key="a.key" class="mi" :class="{ sel: a.hi }" @click="pickStub()">
              <span class="mi-ico">
                <svg viewBox="0 0 16 16" width="15" height="15">
                  <path v-for="(d, i) in ICONS[a.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="mi-label">{{ a.name }}</span>
              <span class="mi-key">{{ a.key }}</span>
              <span class="mi-note">{{ a.note }}</span>
            </div>
          </HarnessPopover>
        </div>

        <!--
          底部统计。原截图里是「16 轮 73 步 · 88 tok/s」这类数字，
          但那些是截图当时的值 —— 这页现在真能对话，写死的数字就成了谎言。
          所以能算的都换成真实值，算不出的显示「—」。
          「步」是智能体的工具调用步数，纯对话没有这个概念，去掉。
        -->
        <div v-if="chat.hasMessages" class="stats">
          <span class="stat">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M8 2.4v11.2" stroke="currentColor" stroke-width="1.2" />
            </svg>
            {{ stats.rounds }} 轮{{ stats.tps ? ` · ${stats.tps} tok/s` : '' }}
          </span>
          <span class="stat">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <ellipse cx="8" cy="4.4" rx="5" ry="1.9" fill="none" stroke="currentColor" stroke-width="1.2" />
              <path d="M3 4.4v7.2c0 1 2.2 1.9 5 1.9s5-.9 5-1.9V4.4" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
            {{ fmtTokens(stats.tokens) }} tok{{ stats.cache === null ? '' : ` · 缓存命中 ${stats.cache}%` }}
          </span>
          <span class="stat">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="9 26" />
            </svg>
            {{ contextLabel }}
          </span>
        </div>
      </section>
    </div>

    <!-- 设置弹窗：从账号菜单的「设置」进来，盖住整个复刻件 -->
    <HarnessSettings v-if="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

<style scoped>
/*
  配色按截图目测：
  侧边栏浅灰、主区纯白、用户气泡淡紫、辅助文字中灰。
  这里刻意不复用本项目的设计令牌（--accent 是紫色），
  因为复刻件的意义就在于"像原版"，掺进本项目的品牌色就不像了。
*/
.dh {
  --dh-side: #f7f7f8;
  --dh-line: #ececee;
  --dh-text: #2b2b2f;
  --dh-dim: #8b8b90;
  --dh-bubble: #e9edfb;
  --dh-sel: #ececef;

  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  color: var(--dh-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC',
    'Hiragino Sans GB', sans-serif;
  font-size: 13px;
}

/*
  弹出层的定位基准。所有触发元素都得带这个类，
  否则里面的 .pop 会相对 .dh（甚至更外层的 AgentModal）定位。
*/
.anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* ---------- 顶部菜单栏 ---------- */
.menubar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  padding: 0 10px;
  border-bottom: 1px solid var(--dh-line);
  background: #fbfbfc;
  color: #4c4c52;
  font-size: 12.5px;
}

.mb-icon {
  display: flex;
  margin-right: 10px;
  color: var(--dh-dim);
}

.mb-btn {
  padding: 3px 9px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.mb-btn:hover {
  background: #f0f0f2;
  color: var(--dh-text);
}

.mb-btn.on {
  background: var(--dh-sel);
  color: var(--dh-text);
}

.win-controls {
  display: flex;
  gap: 16px;
  margin-left: auto;
  color: var(--dh-dim);
  font-size: 11px;
  cursor: pointer;
}

/* ---------- 弹出层内的条目 ----------
   这些类写在复刻件这一层（不在 HarnessPopover 里），
   因为插槽内容是按调用方的作用域编译的，样式跟着调用方走。
   hover 高亮保留：菜单能开能关是真的，没有一点悬停反馈反而不像菜单。
*/
.mi {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border-radius: 6px;
  color: var(--dh-text);
  font-size: 13px;
  cursor: default;
}

.mi:hover {
  background: #f2f2f4;
}

/* 加号菜单里截图当前落在「模型」这一项上，留个默认高亮 */
.mi.sel {
  background: #f2f2f4;
}

.mi-ico {
  display: flex;
  width: 16px;
  flex-shrink: 0;
  justify-content: center;
  color: #7b7b81;
}

.mi-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mi-key {
  flex-shrink: 0;
  color: var(--dh-dim);
  font-size: 12px;
}

.mi-note {
  flex-shrink: 0;
  color: var(--dh-dim);
  font-size: 12px;
}

.mi-check {
  flex-shrink: 0;
  font-size: 12px;
}

.sep {
  height: 1px;
  margin: 4px -5px;
  background: var(--dh-line);
}

.sec {
  padding: 6px 9px 4px;
  color: var(--dh-dim);
  font-size: 11.5px;
}

/* 模式菜单：两行文字一条，条目比普通菜单项高 */
.mode-item {
  padding: 8px 9px;
  border-radius: 6px;
  cursor: default;
}

.mode-item:hover {
  background: #f2f2f4;
}

.mode-item-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-item-name {
  flex: 1;
  font-size: 13px;
}

.mode-item-desc {
  margin: 4px 0 0;
  color: var(--dh-dim);
  font-size: 12px;
  line-height: 1.55;
}

/* 模型菜单：左边标题、右边值 */
.mrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 7px 9px;
  border-radius: 6px;
  cursor: default;
}

.mrow:hover {
  background: #f2f2f4;
}

.mrow-label {
  font-size: 13px;
}

.mrow-value {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4c4c52;
  font-size: 13px;
}

.mrow-value i {
  color: var(--dh-dim);
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
  /* 按原图比例：侧边栏约占窗口宽度的 21.5% */
  width: 21.5%;
  min-width: 15rem;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 8px;
  background: var(--dh-side);
}

.brand {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 4px 6px;
}

.brand-name {
  color: #111;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.brand-badge {
  padding: 1px 5px;
  border-radius: 4px;
  background: #111;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.6px;
}

.new-session {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 0;
  border: 1px solid #e2e2e5;
  border-radius: 9px;
  background: #fff;
  color: var(--dh-text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 6px;
  color: var(--dh-dim);
}

.section-head {
  display: flex;
  align-items: center;
  padding: 6px 6px 2px;
  color: var(--dh-dim);
  font-size: 12px;
}

.head-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.ico-btn {
  display: flex;
  padding: 1px;
  border: none;
  border-radius: 5px;
  background: none;
  color: inherit;
  cursor: pointer;
}

.ico-btn.on,
.ico-btn:hover {
  color: var(--dh-text);
}

.tree {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
}

.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 7px;
}

.folder {
  color: var(--dh-text);
}

.folder .ico {
  flex-shrink: 0;
  color: var(--dh-dim);
}

/* 展开中且有选中项的文件夹，图标颜色略深，和截图一致 */
.folder.active .ico {
  color: #6b7cc9;
}

.session {
  padding-left: 30px;
  color: var(--dh-text);
}

.session.on {
  background: var(--dh-sel);
}

.label {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ago {
  flex-shrink: 0;
  color: var(--dh-dim);
  font-size: 11.5px;
}

.account {
  display: flex;
  margin-top: auto;
}

.acct-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 6px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--dh-dim);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}

.acct-btn:hover,
.acct-btn.on {
  background: #ededf0;
}

.avatar {
  display: grid;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #e6e6e9;
  color: #9a9a9f;
}

/* ---------- 主区 ---------- */
.main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  /* 原图里主区是一块压住侧边栏的白色面板，左上角带圆角 */
  border-top-left-radius: 12px;
  background: #fff;
}

.conv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 6px;
}

.conv-title {
  font-size: 16.5px;
  font-weight: 600;
}

.mode-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--dh-dim);
  font-size: 12.5px;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  color: var(--dh-dim);
}

/* 截图里这两个是连在一起的分段按钮：左边是黄文件夹，右边是 chevron */
.seg {
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid #e2e2e5;
  border-radius: 8px;
  background: #fff;
}

.seg-icon {
  display: flex;
  padding: 4px 6px;
  border-right: 1px solid #e2e2e5;
}

.seg-btn {
  padding: 4px 6px;
  border: none;
  background: none;
  color: var(--dh-dim);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.seg-btn:hover,
.seg-btn.on {
  background: #f2f2f4;
  color: var(--dh-text);
}

.seg-chev {
  display: block;
}

.dots {
  letter-spacing: 1px;
}

.panel {
  display: flex;
}

.tabs {
  display: flex;
  gap: 18px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dh-line);
}

.tab {
  padding: 6px 2px 8px;
  color: var(--dh-dim);
  font-size: 13px;
}

.tab.on {
  border-bottom: 2px solid #6b7cc9;
  color: #4a5bb5;
  font-weight: 600;
}

/* ---------- 消息区 ---------- */
.messages {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  overflow-y: auto;
}

/* 空会话的「探索未至之境 · 预览版」，居中 */
.empty-state {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: auto;
}

.es-title {
  color: #1a1a1f;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.es-badge {
  align-self: center;
  padding: 2px 7px;
  border-radius: 5px;
  background: #eaf0fd;
  color: #4a72d8;
  font-size: 11px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dh-dim);
  font-size: 12.5px;
}

/* 助手正文：左对齐、不加气泡。原截图里"用户靠右带气泡、回复靠左平铺"就是这个读法 */
.assistant-msg {
  color: var(--dh-text);
  font-size: 13.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 出错时只把状态文字变红，横线不动 —— 整行变红看着像出了大事 */
.status-label.bad {
  color: #c0392b;
}

.status-chev {
  font-size: 11px;
}

.rule {
  height: 1px;
  flex: 1;
  background: var(--dh-line);
}

.user-msg {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.bubble {
  max-width: 80%;
  padding: 8px 14px;
  border-radius: 16px;
  background: var(--dh-bubble);
  color: #1f2937;
  font-size: 13.5px;
  line-height: 1.6;
}

/* 「10月2日 21:05 + 复制图标」那行。复制图标是摆设，不给反馈 */
.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #a8a8ad;
  font-size: 11.5px;
}

.copy-ico {
  display: flex;
}

/* ---------- 输入区 ---------- */
.composer {
  /* 模型菜单和加号菜单这两个弹出层的定位基准 */
  position: relative;
  margin: 0 20px;
  padding: 12px 14px 8px;
  border: 1px solid #e4e4e7;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

/* 空会话时输入框上方那行「工作区 + 模式」 */
.composer-top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px 8px;
}

.pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #4c4c52;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.pill:hover,
.pill.on {
  background: #f2f2f4;
}

/*
  输入框：去掉浏览器默认边框、轮廓和拖拽手柄，
  让它读起来就是原图里的那一行占位文字。
  高度由脚本按内容自动调（最多 6 行），所以这里只管最小高度和上限。
*/
.input {
  display: block;
  width: 100%;
  min-height: 22px;
  max-height: 132px;
  padding: 4px 2px 14px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dh-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  overflow-y: auto;
}

.input::placeholder {
  color: #a8a8ad;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--dh-dim);
}

.plus {
  display: grid;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: #f2f2f4;
  color: #5a5a60;
  cursor: pointer;
}

.plus:hover,
.plus.on {
  background: #e6e6ea;
}

.chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--dh-dim);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.chip:hover,
.chip.on {
  background: #f2f2f4;
}

.model-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font: inherit;
}

.model-btn:hover,
.model-btn.on {
  background: #f2f2f4;
}

.chev {
  color: var(--dh-dim);
  font-size: 11px;
}

.spacer {
  flex: 1;
}

.model {
  color: #6a6a70;
  font-size: 13px;
}

/* 推理等级比模型名淡一档，原图就是两级灰 */
.level {
  color: #9a9aa0;
  font-size: 13px;
}

/*
  发送键。原截图里它是浅紫蓝色的 —— 那正是"输入为空、发不出去"的禁用态，
  所以沿用该配色表示禁用，可发送时换成饱和色，让能不能发一眼可辨。
  生成中变成停止键：否则用户没有别的办法打断一次已经在跑的请求。
*/
.send {
  display: grid;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: #5b6ee0;
  color: #fff;
  cursor: pointer;
}

.send:disabled {
  background: #b9c6f2;
  cursor: not-allowed;
}

.send:not(:disabled):hover {
  filter: brightness(1.08);
}

.send.stop {
  background: #d9534f;
}

/* ---------- 底部统计 ---------- */
.stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  padding: 8px 20px 12px;
  color: #9a9aa0;
  font-size: 12px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ---------- 真按钮 vs 摆设的反馈 ----------
   真正能用的：新会话、输入框、发送键，加上所有会开弹出层的触发元素
   （应用/编辑/账号/视图选项/文件图标/工作区/模式/加号/权限/模型）。
   它们的 hover 都写在上面各自的规则里了。

   下面这些是**看着能点、但没实现**的（插件行、搜索图标、新建工作区图标、
   树里的行、标签页、···、面板图标、复制图标、状态行 chevron）。
   它们点下去会弹一句"网站试用版部分功能不可用…"，所以给指针和极轻的悬停反馈 ——
   光标不变成手型的话，用户不会去点，那句提示也就永远看不到。
*/
.nav-row,
.head-icons .ico-btn,
.tree .row,
.tab,
.dots,
.panel,
.copy-ico,
.status-chev,
.mode-chip,
.mb-icon {
  cursor: pointer;
}

.nav-row:hover,
.tree .row:hover,
.tab:hover,
.copy-ico:hover,
.mode-chip:hover {
  background: #f2f2f4;
}

.new-session:hover {
  border-color: #d0d0d5;
  background: #fbfbfc;
}

.new-session:active {
  background: #f2f2f4;
}
</style>
