<script setup>
/**
 * ChatGPT Codex 的「设置」整页（纯视觉复刻）。
 *
 * 按 codex/设置页面1~14.png 逐面板还原。与原产品一样是**整页式**，
 * 不是弹窗 —— 左侧是分组导航，右侧是面板内容。
 *
 * ⚠️ 里面所有控件都不带功能：下拉打不开、开关不切换。
 * 点击这些控件会弹一句统一提示（"网站试用版部分功能不可用…"，
 * 见 @/composables/stubToast）—— 界面状态不变，提示只解释。
 *
 * 真的东西：左侧 14 个面板之间的切换、左上「Back to app」、
 * 以及 Appearance 面板里三张主题卡片的选择（点一下换个选中态，仅此而已）。
 *
 * ⚠️ 几处截图里看不见或不宜照抄的地方，别当成原产品文案：
 *   - Pets 的宠物是像素画小图，这里没有素材，用色块+首字母代替；
 *   - Archived chats 截图停在「Loading archived chats…」，这里保留这个加载态；
 *   - 设置页面2 中间那段红绿 diff 预览是按截图大意画的简化版。
 */
import { ref } from 'vue'

import { showStubToast } from '@/composables/stubToast'

defineEmits(['close'])

/** 左侧导航：带 ext 的是"跳到别处"的项（截图上带外链箭头），这里没实现 */
function onNavItem(it) {
  if (it.ext) {
    showStubToast()
    return
  }
  panel.value = it.id
}

const NAV = [
  {
    group: 'Personal',
    items: [
      { id: 'general', name: 'General', icon: 'gear' },
      { id: 'appearance', name: 'Appearance', icon: 'sun' },
      { id: 'configuration', name: 'Configuration', icon: 'sliders' },
      { id: 'personalization', name: 'Personalization', icon: 'sparkle' },
      { id: 'pets', name: 'Pets', icon: 'paw' },
      { id: 'shortcuts', name: 'Keyboard shortcuts', icon: 'keyboard' },
      { id: 'account', name: 'Account', icon: 'person', ext: true },
    ],
  },
  {
    group: 'Integrations',
    items: [
      { id: 'computer', name: 'Computer use', icon: 'sparkle' },
      { id: 'plugins', name: 'Plugins', icon: 'puzzle' },
      { id: 'browser', name: 'Browser', icon: 'window' },
    ],
  },
  {
    group: 'Coding',
    items: [
      { id: 'hooks', name: 'Hooks', icon: 'hook' },
      { id: 'git', name: 'Git', icon: 'git' },
      { id: 'environments', name: 'Environments', icon: 'monitor' },
      { id: 'worktrees', name: 'Worktrees', icon: 'worktree' },
    ],
  },
  {
    group: 'Archived',
    items: [{ id: 'archived', name: 'Archived chats', icon: 'archive' }],
  },
]

const ICONS = {
  gear: [
    'M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z',
    'M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7',
    'M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2',
  ],
  sun: [
    'M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z',
    'M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M4 4l1 1M11 11l1 1M12 4l-1 1M5 11l-1 1',
  ],
  sliders: ['M3 5h4M11 5h2M3 11h2M9 11h4', 'M9 3.6v2.8M7 9.6v2.8'],
  sparkle: ['M8 2.6l1.3 3.4 3.4 1.3-3.4 1.3L8 12l-1.3-3.4L3.3 7.3l3.4-1.3z'],
  paw: [
    'M5.4 6.2a1.2 1.4 0 1 0 0-2.8 1.2 1.4 0 0 0 0 2.8ZM10.6 6.2a1.2 1.4 0 1 0 0-2.8 1.2 1.4 0 0 0 0 2.8Z',
    'M8 7.6c-1.8 0-3.4 1.5-3.4 3.1 0 1 .8 1.7 1.8 1.7.6 0 1-.2 1.6-.2s1 .2 1.6.2c1 0 1.8-.7 1.8-1.7 0-1.6-1.6-3.1-3.4-3.1Z',
  ],
  keyboard: ['M2.4 4.6h11.2v6.8H2.4z', 'M4.4 6.6h.01M7 6.6h.01M9.6 6.6h.01M4.4 8.8h.01M9.6 8.8h.01M6.2 8.8h3.6'],
  person: [
    'M8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z',
    'M3.2 13.4c.4-2.3 2.5-3.6 4.8-3.6s4.4 1.3 4.8 3.6',
  ],
  puzzle: [
    'M6.5 2.8a1.5 1.5 0 0 1 3 0v1.2h2.2a1 1 0 0 1 1 1v2.1a1.5 1.5 0 1 1 0 3v2.1a1 1 0 0 1-1 1H9.5v-2.2a1.5 1.5 0 1 0-3 0v2.2H4.3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.2Z',
  ],
  window: ['M2.4 3.6h11.2v8.8H2.4z', 'M2.4 5.8h11.2'],
  hook: ['M8 3v8', 'M8 3a1.4 1.4 0 1 0-.1 0Z', 'M4 9.5a4 4 0 0 0 8 0', 'M4 9.5H2.6M13.4 9.5H12'],
  git: [
    'M4 4.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM4 11.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z',
    'M4 4.4v7.2',
    'M12 7.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z',
    'M12 7.4c0 2.4-2.5 3-4.6 3.4',
  ],
  monitor: ['M2.6 3.4h10.8v7.4H2.6z', 'M6 12.8h4'],
  worktree: ['M8 3v4', 'M8 7 4.5 10.5M8 7l3.5 3.5', 'M8 3a1.2 1.2 0 1 0-.1 0Z', 'M4.5 10.5a1.2 1.2 0 1 0-.1 0ZM11.5 10.5a1.2 1.2 0 1 0-.1 0Z'],
  archive: ['M2.6 3.4h10.8v2.6H2.6z', 'M3.6 6v6.6h8.8V6', 'M6.4 8.6h3.2'],
  back: ['M10 3.6 5.6 8l4.4 4.4'],
  search: ['M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M9.9 9.9 13 13'],
  ext: ['M6.4 4h6.6v6.6', 'M13 4 7.5 9.5', 'M11 12.6H3.4V5'],
  refresh: ['M13 8a5 5 0 1 1-1.5-3.6', 'M13 2.6v3h-3'],
  grid: ['M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z'],
  edit: ['M3.2 12.8l.4-2.7 7.4-7.4a1.6 1.6 0 0 1 2.2 0l.1.1a1.6 1.6 0 0 1 0 2.2l-7.4 7.4Z', 'M10.2 3.5l2.3 2.3'],
  trash: ['M3 4.4h10', 'M6.4 4.2V3.2a.8.8 0 0 1 .8-.8h1.6a.8.8 0 0 1 .8.8v1', 'M4.6 4.4l.6 8.2a1 1 0 0 0 1 1h5.2a1 1 0 0 0 1-1l.6-8.2'],
  chrome: ['M8 2.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 8 2.8Z', 'M8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z', 'M8 5.8h4.6M6.1 6.9 3.8 3.1M9.9 9.1 7.6 12.9'],
}

const panel = ref('general')

/* ---------- Appearance ---------- */
const THEMES = ['System', 'Light', 'Dark']
const theme = ref('System')

/* ---------- Pets。宠物是像素画素材，这里没有，用色块+首字母代替 ---------- */
const PETS = [
  { name: 'Codex', desc: 'The original Codex companion.', color: '#2b3a67' },
  { name: 'Dewey', desc: 'A calm companion for focused workspace days', color: '#57b8e8' },
  { name: 'Fireball', desc: 'Hot path energy for fast iteration.', color: '#e85d26' },
  { name: 'Hoots', desc: 'A sharp-eyed owl for polished work in a blink.', color: '#d98a2b' },
  { name: 'Rocky', desc: 'A steady rock when the diff gets large.', color: '#8a7a5f' },
  { name: 'Seedy', desc: 'Small green shoots for new ideas.', color: '#6fae5c' },
  { name: 'Stacky', desc: 'A balanced stack for deep work.', color: '#3f3f46' },
]

/* ---------- Keyboard shortcuts（截图可见的前 9 条） ---------- */
const SHORTCUTS = [
  { name: 'New chat', desc: 'Start a new chat', keys: ['Ctrl+N', 'Ctrl+Shift+O'] },
  { name: 'New Temporary Chat', desc: "Start a chat that won't appear in history", keys: ['Ctrl+Shift+N'] },
  { name: 'Quick chat', desc: 'Start a lightweight chat in the quick composer', keys: ['Ctrl+Alt+N'] },
  { name: 'Archive chat', desc: 'Archive the current chat', keys: ['Ctrl+Shift+A'] },
  { name: 'New standalone chat', desc: 'Start a new chat outside of any project', keys: ['Ctrl+Alt+O'] },
  { name: 'Open side chat', desc: 'Open the current chat in a side chat', keys: ['Ctrl+Alt+S'] },
  { name: 'Mark as unread', desc: 'Mark the current chat as unread', keys: ['Ctrl+Shift+U'] },
  { name: 'Open in new window', desc: 'Open the current chat in a new window', keys: ['Unassigned'] },
  { name: 'Toggle pin', desc: 'Pin or unpin the current chat', keys: ['Ctrl+Alt+P'] },
]
</script>

<template>
  <div class="cs">
    <!-- ================= 左侧导航 ================= -->
    <aside class="snav">
      <button type="button" class="back" @click="$emit('close')">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path :d="ICONS.back[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Back to app
      </button>

      <div class="ssearch">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
        <span>Search settings…</span>
      </div>

      <div v-for="g in NAV" :key="g.group" class="snav-group">
        <p class="snav-group-name">{{ g.group }}</p>
        <button
          v-for="it in g.items"
          :key="it.id"
          type="button"
          class="snav-item"
          :class="{ on: panel === it.id, deco: it.ext }"
          @click="onNavItem(it)"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path v-for="(d, i) in ICONS[it.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="snav-item-name">{{ it.name }}</span>
          <svg v-if="it.ext" class="snav-ext" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path v-for="(d, i) in ICONS.ext" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </aside>

    <!-- ================= 右侧面板 ================= -->
    <!--
      面板里的控件几乎都是摆设，点下去弹统一提示。
      区域指令 + 选择器，理由与 HarnessSettings 同：逐个加会漏，且点空白不该弹。
      .theme-card 除外（真的能切主题）。
    -->
    <section
      v-stub="'.srow, .ssel, .sbtn, .tgl, .slink, .stext-btn, .sico-btn, .ssearch, .sinput, .stextarea, .ptab, .sactions, .swatch, .psec-row, .app-ico'"
      class="spanel"
    >
      <!-- ---------- General ---------- -->
      <template v-if="panel === 'general'">
        <h1 class="ptitle">General</h1>

        <p class="psec">Permissions</p>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Default permissions</p>
              <p class="sdesc">By default, ChatGPT can read and edit files in its workspace. It can ask for additional access when needed</p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Full access</p>
              <p class="sdesc">
                When ChatGPT runs with full access, it can edit any file on your computer and run commands with network, without your approval. This significantly increases the risk of data loss, leaks, or unexpected behavior.
                <span class="slink">Learn more</span> about elevated risks.
              </p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
        </div>

        <p class="psec">General</p>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Default file open destination</p>
              <p class="sdesc">Where files and folders open by default</p>
            </div>
            <span class="ssel">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M11.6 1.4 6.2 6.4 3.4 4.2 2.2 4.8l2.2 3.2-2.2 3.2 1.2.6 2.8-2.2 5.4 5 1.8-.9V2.3ZM11.6 4.9v6.2L8.2 8Z" fill="#2f9cf4" />
              </svg>
              VS Code <i class="chev">⌄</i>
            </span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Integrated terminal shell</p>
              <p class="sdesc">Choose which shell opens in the integrated terminal.</p>
            </div>
            <span class="ssel">PowerShell <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Language</p>
              <p class="sdesc">Language for the app UI</p>
            </div>
            <span class="ssel">English <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Bottom panel</p>
              <p class="sdesc">Show the bottom panel control in the app header</p>
            </div>
            <span class="tgl"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Imported agent setup</p>
              <p class="sdesc">Last imported 3mo ago</p>
            </div>
            <span class="sbtn">Import again</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Open source licenses</p>
              <p class="sdesc">Third-party notices for bundled dependencies</p>
            </div>
            <span class="sbtn">View</span>
          </div>
        </div>
      </template>

      <!-- ---------- Appearance ---------- -->
      <template v-else-if="panel === 'appearance'">
        <h1 class="ptitle">Appearance</h1>

        <p class="psec">Theme</p>
        <div class="theme-grid">
          <button
            v-for="t in THEMES"
            :key="t"
            type="button"
            class="theme-card"
            :class="[t.toLowerCase(), { on: theme === t }]"
            @click="theme = t"
          >
            <span class="theme-thumb"><i /><i /><i /></span>
            <span class="theme-name">{{ t }}</span>
          </button>
        </div>

        <!-- 截图里那段红绿 diff 预览的简化版：大意对，不逐字 -->
        <div class="diff">
          <div class="diff-pane old">
            <p>1&nbsp;&nbsp;const themePreview: ThemeConfig = {</p>
            <p>2&nbsp;&nbsp;&nbsp;surface: "sidebar",</p>
            <p class="hl">3&nbsp;&nbsp;&nbsp;accent: "#2563eb",</p>
            <p class="hl">4&nbsp;&nbsp;&nbsp;contrast: 42,</p>
            <p>5&nbsp;&nbsp;};</p>
          </div>
          <div class="diff-pane new">
            <p>1&nbsp;&nbsp;const themePreview: ThemeConfig = {</p>
            <p>2&nbsp;&nbsp;&nbsp;surface: "sidebar-elevated",</p>
            <p class="hl">3&nbsp;&nbsp;&nbsp;accent: "#0ea5e9",</p>
            <p class="hl">4&nbsp;&nbsp;&nbsp;contrast: 68,</p>
            <p>5&nbsp;&nbsp;};</p>
          </div>
        </div>

        <div class="card">
          <div class="srow">
            <div class="smain"><p class="stitle">Light theme</p></div>
            <span class="sactions">
              <span class="stext-btn">Import</span>
              <span class="stext-btn">Copy theme</span>
              <span class="stext-btn">Aa</span>
              <span class="ssel">Codex <i class="chev">⌄</i></span>
            </span>
          </div>
          <div class="srow">
            <div class="smain"><p class="stitle">Accent</p></div>
            <span class="ssel swatch" style="background:#339cff;border-color:#339cff;color:#fff">#339CFF</span>
          </div>
          <div class="srow">
            <div class="smain"><p class="stitle">Background</p></div>
            <span class="ssel">○ #FFFFFF</span>
          </div>
          <div class="srow">
            <div class="smain"><p class="stitle">Foreground</p></div>
            <span class="ssel swatch" style="background:#1a1c1f;border-color:#1a1c1f;color:#fff">#1A1C1F</span>
          </div>
          <div class="srow">
            <div class="smain"><p class="stitle">UI font</p></div>
            <span class="sactions">
              <span class="ssel">System default <i class="chev">⌄</i></span>
              <span class="ssel">Regular <i class="chev">⌄</i></span>
            </span>
          </div>
        </div>
      </template>

      <!-- ---------- Configuration ---------- -->
      <template v-else-if="panel === 'configuration'">
        <h1 class="ptitle">Configuration</h1>
        <p class="plead">Configure permissions, web access, and agent responses for new chats <span class="slink">Learn more</span></p>

        <p class="psec">Agent defaults</p>
        <div class="cfg-head">
          <span class="ssel">User config <i class="chev">⌄</i></span>
          <span class="stext-btn">Open config.toml ↗</span>
        </div>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Approval policy</p>
              <p class="sdesc">Choose when ChatGPT asks for approval</p>
            </div>
            <span class="ssel">On request <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Sandbox settings</p>
              <p class="sdesc">Choose how much ChatGPT can do when running commands</p>
            </div>
            <span class="ssel">Full access <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Web search</p>
              <p class="sdesc">Choose how ChatGPT accesses the web</p>
            </div>
            <span class="ssel">Live <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Output detail</p>
              <p class="sdesc">Choose how much detail ChatGPT includes in responses</p>
            </div>
            <span class="ssel">Model default <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Reasoning summary</p>
              <p class="sdesc">Choose how ChatGPT summarizes its reasoning</p>
            </div>
            <span class="ssel">Auto <i class="chev">⌄</i></span>
          </div>
        </div>
      </template>

      <!-- ---------- Personalization ---------- -->
      <template v-else-if="panel === 'personalization'">
        <h1 class="ptitle">Personalization</h1>

        <div class="psec-row">
          <p class="psec">Custom instructions</p>
          <span class="stext-btn">Save</span>
        </div>
        <p class="plead">Give ChatGPT extra instructions and context for all chats on this host. <span class="slink">Learn more</span></p>
        <div class="stextarea">Add your custom instructions…</div>

        <p class="psec">Memory</p>
        <p class="plead">Configure how local memories are collected, retained, and consolidated on this computer. <span class="slink">Learn more</span></p>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Enable local memories</p>
              <p class="sdesc">Create memories from chats on this computer and use them to personalize future chats on this computer</p>
            </div>
            <span class="tgl"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Allow local memory generation from tool-assisted chats</p>
              <p class="sdesc">Generate memories from chats that used MCP tools or web search</p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Delete local memories</p>
              <p class="sdesc">Delete all memories stored locally on this computer</p>
            </div>
            <span class="sbtn danger">Delete</span>
          </div>
        </div>

        <div class="notice">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M8 2.6 14 13H2Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M8 6.6v3M8 11.4h.01" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          Personality settings are not supported by every model. Codex's tone can be customized in Custom instructions.
        </div>

        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Personality</p>
              <p class="sdesc">Choose a default tone for ChatGPT responses</p>
            </div>
            <span class="ssel">Friendly <i class="chev">⌄</i></span>
          </div>
        </div>
      </template>

      <!-- ---------- Pets ---------- -->
      <template v-else-if="panel === 'pets'">
        <h1 class="ptitle">Pets</h1>

        <div class="psec-row">
          <div>
            <p class="psec inline">Pick a pet</p>
            <p class="plead">Pets manage threads and surface what needs attention</p>
          </div>
          <span class="sactions">
            <span class="sbtn icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14"><path v-for="(d, i) in ICONS.refresh" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
            <span class="sbtn">Create</span>
            <span class="sbtn dark">Wake Pet</span>
          </span>
        </div>

        <div class="card">
          <div v-for="p in PETS" :key="p.name" class="srow pet">
            <span class="pet-avatar" :style="{ background: p.color }">{{ p.name[0] }}</span>
            <div class="smain">
              <p class="stitle">{{ p.name }}</p>
              <p class="sdesc">{{ p.desc }}</p>
            </div>
            <span class="sbtn">Select</span>
          </div>
        </div>
      </template>

      <!-- ---------- Keyboard shortcuts ---------- -->
      <template v-else-if="panel === 'shortcuts'">
        <h1 class="ptitle">Keyboard shortcuts</h1>

        <div class="ssearch wide">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          <span>Search shortcuts</span>
          <span class="ssearch-kbd" aria-hidden="true">⌘</span>
        </div>

        <div class="card">
          <div v-for="s in SHORTCUTS" :key="s.name" class="srow">
            <div class="smain">
              <p class="stitle">{{ s.name }}</p>
              <p class="sdesc">{{ s.desc }}</p>
            </div>
            <span class="sactions">
              <span v-for="k in s.keys" :key="k" class="skbd" :class="{ dim: k === 'Unassigned' }">{{ k }}</span>
              <span class="sico-btn" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="13" height="13"><path v-for="(d, i) in ICONS.edit" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </span>
              <span class="sico-btn" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="13" height="13"><path v-for="(d, i) in ICONS.trash" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </span>
            </span>
          </div>
        </div>
      </template>

      <!-- ---------- Computer use ---------- -->
      <template v-else-if="panel === 'computer'">
        <h1 class="ptitle">Computer use</h1>
        <p class="plead">Manage how ChatGPT uses other applications on your computer</p>

        <p class="psec">Control</p>
        <div class="card">
          <div class="srow">
            <span class="app-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="20" height="20"><path v-for="(d, i) in ICONS.chrome" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
            </span>
            <div class="smain">
              <p class="stitle">Google Chrome</p>
              <p class="sdesc">Disabled by your organization or unavailable in your region</p>
            </div>
            <span class="tgl off-dis"><i /></span>
          </div>
        </div>
      </template>

      <!-- ---------- Plugins ---------- -->
      <template v-else-if="panel === 'plugins'">
        <div class="ptitle-row">
          <h1 class="ptitle">Plugins</h1>
          <span class="sactions">
            <span class="sbtn">Browse directory</span>
            <span class="sbtn dark">Add ⌄</span>
          </span>
        </div>
        <p class="plead">Manage plugins, skills, and MCPs</p>

        <div class="ptabs">
          <span class="ptab on">Plugins <i>1</i></span>
          <span class="ptab">MCPs <i>1</i></span>
          <span class="ptab">Skills <i>2</i></span>
          <span class="spacer" />
          <span class="ssearch small">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path v-for="(d, i) in ICONS.search" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
            </svg>
            <span>Search plugins</span>
          </span>
        </div>

        <div class="card">
          <div class="srow">
            <span class="app-ico blue" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="18" height="18"><path v-for="(d, i) in ICONS.grid" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
            </span>
            <div class="smain">
              <p class="stitle">Visualize</p>
              <p class="sdesc">Turn ideas and data into interactive visuals</p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
        </div>
      </template>

      <!-- ---------- Browser ---------- -->
      <template v-else-if="panel === 'browser'">
        <h1 class="ptitle">Browser</h1>

        <div class="card">
          <div class="srow">
            <span class="app-ico" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="18" height="18"><path v-for="(d, i) in ICONS.window" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
            </span>
            <div class="smain">
              <p class="stitle">Browser</p>
              <p class="sdesc">Disabled by your organization or unavailable in your region</p>
            </div>
            <span class="tgl off-dis"><i /></span>
          </div>
        </div>

        <div class="psec-row">
          <p class="psec inline">General</p>
          <span class="sbtn">Import…</span>
        </div>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Web URL and link open destination</p>
              <p class="sdesc">Where links open by default</p>
            </div>
            <span class="ssel">Default browser <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Local URL open destination</p>
              <p class="sdesc">Where local development sites open by default</p>
            </div>
            <span class="ssel">ChatGPT <i class="chev">⌄</i></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Browsing data</p>
              <p class="sdesc">Clear browsing history, site data, cache, and download history from the in-app browser</p>
            </div>
            <span class="sbtn">Clear browsing data</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Browsing history</p>
              <p class="sdesc">View and manage pages visited in the built-in browser</p>
            </div>
            <span class="sbtn">Manage</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Annotation screenshots</p>
              <p class="sdesc">Screenshots help ChatGPT better understand and address comments, but increase plan usage</p>
            </div>
            <span class="ssel">Always include <i class="chev">⌄</i></span>
          </div>
        </div>

        <p class="psec">Autofill and passwords</p>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Password manager</p>
              <p class="sdesc">Add, delete, and edit saved passwords</p>
            </div>
            <span class="sbtn">Manage</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Contact info</p>
              <p class="sdesc">Add, delete, and edit saved addresses, phone numbers, and email addresses</p>
            </div>
            <span class="sbtn">Manage</span>
          </div>
        </div>
      </template>

      <!-- ---------- Hooks ---------- -->
      <template v-else-if="panel === 'hooks'">
        <h1 class="ptitle">Hooks</h1>
        <p class="plead">Manage lifecycle hooks from config and enabled plugins. <span class="slink">Learn more</span></p>

        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">No hooks found</p>
              <p class="sdesc">Configured hooks will appear here</p>
            </div>
          </div>
        </div>
      </template>

      <!-- ---------- Git ---------- -->
      <template v-else-if="panel === 'git'">
        <h1 class="ptitle">Git</h1>

        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Branch prefix</p>
              <p class="sdesc">Prefix used when ChatGPT creates new branches</p>
            </div>
            <span class="sinput">codex/</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Always force push</p>
              <p class="sdesc">Use --force-with-lease when pushing from ChatGPT</p>
            </div>
            <span class="tgl"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Create draft pull requests</p>
              <p class="sdesc">Use draft pull requests by default when creating PRs from ChatGPT</p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Review delivery</p>
              <p class="sdesc">Start /review in the current chat when possible or launch a separate review chat</p>
            </div>
            <span class="sseg"><b>Inline</b><span>Detached</span></span>
          </div>
        </div>

        <p class="psec">Watch and fix pull requests</p>
        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Auto-merge when ready</p>
              <p class="sdesc">Continue watching until the pull request is merged</p>
            </div>
            <span class="tgl"><i /></span>
          </div>
          <div class="stextarea">For example: Comment /merge after checks pass and approve unrelated Chromatic changes…</div>
        </div>

        <p class="psec">Commit instructions</p>
        <p class="plead">Added to commit message generation prompts</p>
        <div class="stextarea">Add commit message guidance…</div>
      </template>

      <!-- ---------- Environments ---------- -->
      <template v-else-if="panel === 'environments'">
        <h1 class="ptitle">Environments</h1>
        <p class="plead">Local environments tell ChatGPT how to set up worktrees for a project. <span class="slink">Learn more</span></p>

        <div class="psec-row">
          <p class="psec inline">Select a project</p>
          <span class="sbtn">Add project</span>
        </div>
        <div class="card empty-card">
          <p class="sdesc center">No projects yet. Add one to configure local environments.</p>
          <span class="sbtn dark">Add project</span>
        </div>
      </template>

      <!-- ---------- Worktrees ---------- -->
      <template v-else-if="panel === 'worktrees'">
        <h1 class="ptitle">Worktrees</h1>

        <div class="card">
          <div class="srow">
            <div class="smain">
              <p class="stitle">Worktree root</p>
              <p class="sdesc">Directory where ChatGPT creates managed worktrees. Leave blank to use the default location</p>
            </div>
            <span class="sinput">C:/Users/szy21/.codex/worktrees</span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Always fetch upstream before creating worktrees</p>
              <p class="sdesc">Codex normally picks up branch updates during regular Git activity. This also fetches before each new worktree.</p>
            </div>
            <span class="tgl"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Automatically delete old worktrees</p>
              <p class="sdesc">Recommended for most users. Turn this off only if you want to manage old worktrees and disk usage yourself.</p>
            </div>
            <span class="tgl on"><i /></span>
          </div>
          <div class="srow">
            <div class="smain">
              <p class="stitle">Auto-delete limit</p>
              <p class="sdesc">Number of managed worktrees to keep before older ones are pruned automatically. ChatGPT snapshots worktrees before deleting, so pruned worktrees should always be restorable.</p>
            </div>
            <span class="sinput num">15</span>
          </div>
        </div>

        <div class="psec-row">
          <p class="psec inline">No worktrees yet</p>
          <span class="sico-btn" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14"><path v-for="(d, i) in ICONS.refresh" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
        </div>
        <div class="card empty-card">
          <p class="sdesc center">Worktrees created by ChatGPT will appear here</p>
        </div>
      </template>

      <!-- ---------- Archived chats ---------- -->
      <template v-else-if="panel === 'archived'">
        <h1 class="ptitle">Archived chats</h1>

        <!-- 截图就停在这个加载态，保留原样 -->
        <div class="card">
          <div class="srow">
            <span class="sico-btn spin" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14"><path v-for="(d, i) in ICONS.refresh" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
            <p class="sdesc">Loading archived chats…</p>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.cs {
  --cs-text: #1f1f23;
  --cs-dim: #8e8e93;
  --cs-line: #ececec;
  --cs-hover: #efefef;

  display: flex;
  min-height: 0;
  flex: 1;
  background: #fff;
  color: var(--cs-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC',
    'Hiragino Sans GB', sans-serif;
  font-size: 13px;
}

/* ---------- 左侧导航 ---------- */
.snav {
  display: flex;
  width: 210px;
  flex-shrink: 0;
  flex-direction: column;
  gap: 2px;
  padding: 10px 10px 10px 14px;
  overflow-y: auto;
  border-right: 1px solid var(--cs-line);
  background: #fafafa;
}

.back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--cs-text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.back:hover {
  background: var(--cs-hover);
}

.ssearch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 2px 12px;
  padding: 7px 10px;
  border: 1px solid var(--cs-line);
  border-radius: 8px;
  background: #fff;
  color: var(--cs-dim);
  font-size: 12.5px;
}

.ssearch.wide {
  margin: 16px 0 12px;
}

.ssearch.small {
  margin: 0;
  padding: 5px 10px;
}

.ssearch-kbd {
  margin-left: auto;
  padding: 0 4px;
  border: 1px solid var(--cs-line);
  border-radius: 4px;
  font-size: 10px;
}

.snav-group-name {
  margin: 12px 8px 4px;
  color: var(--cs-dim);
  font-size: 11.5px;
}

.snav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--cs-text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.snav-item.on {
  background: var(--cs-hover);
}

.snav-item:not(.deco):hover {
  background: var(--cs-hover);
}

.snav-item.deco {
  cursor: pointer;
}

.snav-item-name {
  flex: 1;
}

.snav-ext {
  color: var(--cs-dim);
}

/* ---------- 右侧面板 ---------- */
.spanel {
  min-width: 0;
  flex: 1;
  padding: 36px 44px 44px;
  overflow-y: auto;
}

.ptitle {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 600;
}

.ptitle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.plead {
  margin: 6px 0 14px;
  color: var(--cs-dim);
  font-size: 12.5px;
  line-height: 1.6;
}

.psec {
  margin: 22px 0 10px;
  font-size: 13px;
  font-weight: 600;
}

.psec.inline {
  margin: 0;
}

.psec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 22px 0 10px;
}

.slink {
  color: #3d8ef0;
}

/* ---------- 行 / 卡片 ---------- */
.card {
  padding: 2px 16px;
  border: 1px solid var(--cs-line);
  border-radius: 12px;
  background: #fff;
}

.card + .card,
.card + .psec {
  margin-top: 14px;
}

.srow {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 13px 0;
}

.srow + .srow {
  border-top: 1px solid var(--cs-line);
}

.smain {
  min-width: 0;
  flex: 1;
}

.stitle {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}

.sdesc {
  margin: 3px 0 0;
  color: var(--cs-dim);
  font-size: 12px;
  line-height: 1.55;
}

.sdesc.center {
  text-align: center;
}

.sactions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.spacer {
  flex: 1;
}

/* ---------- 控件（全是摆设） ---------- */
.ssel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid var(--cs-line);
  border-radius: 8px;
  color: var(--cs-text);
  font-size: 12.5px;
  white-space: nowrap;
}

.chev {
  color: var(--cs-dim);
  font-size: 11px;
  font-style: normal;
}

.swatch {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
}

.sbtn {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 12px;
  border: 1px solid var(--cs-line);
  border-radius: 8px;
  background: #fff;
  font-size: 12.5px;
  white-space: nowrap;
}

.sbtn.dark {
  border-color: #1f1f23;
  background: #1f1f23;
  color: #fff;
}

.sbtn.danger {
  border-color: #f0d5d0;
  color: #c0392b;
}

.stext-btn {
  color: var(--cs-dim);
  font-size: 12.5px;
  white-space: nowrap;
}

.tgl {
  position: relative;
  width: 34px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #d9d9dd;
}

.tgl i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
}

.tgl.on {
  background: #4a9cf5;
}

.tgl.on i {
  left: 16px;
}

.tgl.off-dis {
  background: #e8e8ea;
}

.sinput {
  flex-shrink: 0;
  min-width: 12rem;
  padding: 7px 10px;
  border: 1px solid var(--cs-line);
  border-radius: 8px;
  color: var(--cs-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.sinput.num {
  min-width: 3rem;
  text-align: center;
}

.stextarea {
  margin: 4px 0 14px;
  padding: 14px;
  border: 1px solid var(--cs-line);
  border-radius: 12px;
  color: var(--cs-dim);
  font-size: 12.5px;
  min-height: 4.5rem;
}

.card .stextarea {
  margin: 0 0 14px;
}

.skbd {
  padding: 3px 8px;
  border: 1px solid var(--cs-line);
  border-radius: 6px;
  background: #fafafa;
  font-size: 11.5px;
  white-space: nowrap;
}

.skbd.dim {
  color: var(--cs-dim);
  border-style: dashed;
  background: none;
}

.sico-btn {
  display: flex;
  padding: 4px;
  color: var(--cs-dim);
}

.sico-btn.spin {
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-ico {
  display: flex;
  flex-shrink: 0;
  color: #6f6f75;
}

.app-ico.blue {
  color: #2f9cf4;
}

.sseg {
  display: flex;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--cs-line);
  border-radius: 8px;
  font-size: 12.5px;
}

.sseg b,
.sseg span {
  padding: 5px 12px;
  font-weight: 500;
}

.sseg b {
  background: #f0f0f1;
}

.sseg span {
  color: var(--cs-dim);
}

/* ---------- Appearance 主题卡片 ---------- */
.theme-grid {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  grid-template-columns: repeat(3, 1fr);
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 0 8px;
  border: 2px solid var(--cs-line);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font: inherit;
}

.theme-card.on {
  border-color: #9a9aa0;
}

.theme-thumb {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 5.5rem;
  padding: 12px;
  border-radius: 10px 10px 0 0;
}

.theme-thumb i {
  height: 9px;
  border-radius: 4px;
  background: rgba(128, 128, 132, 0.35);
}

.theme-thumb i:nth-child(2) {
  width: 72%;
}

.theme-thumb i:nth-child(3) {
  width: 48%;
}

.theme-card.light .theme-thumb {
  background: #f5f5f6;
}

.theme-card.dark .theme-thumb {
  background: #2b2b30;
}

.theme-card.system .theme-thumb {
  background: linear-gradient(90deg, #f5f5f6 50%, #2b2b30 50%);
}

.theme-name {
  color: var(--cs-text);
  font-size: 12.5px;
  text-align: center;
}

/* 红绿 diff 预览（简化版） */
.diff {
  display: grid;
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid var(--cs-line);
  border-radius: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  grid-template-columns: 1fr 1fr;
}

.diff-pane {
  padding: 10px 12px;
}

.diff-pane p {
  margin: 0;
  color: var(--cs-dim);
  line-height: 1.7;
  white-space: pre;
}

.diff-pane.old {
  border-right: 1px solid var(--cs-line);
}

.diff-pane.old .hl {
  background: #fdecea;
  color: #b3402f;
}

.diff-pane.new .hl {
  background: #e9f7ee;
  color: #1f7a3d;
}

/* ---------- Pets ---------- */
.srow.pet {
  gap: 14px;
}

.pet-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

/* ---------- Plugins 页签 ---------- */
.ptabs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px 0 12px;
}

.ptab {
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--cs-dim);
  font-size: 12.5px;
}

.ptab.on {
  background: #f0f0f1;
  color: var(--cs-text);
}

.ptab i {
  font-style: normal;
}

/* ---------- 提示条 / 空卡片 ---------- */
.notice {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
  padding: 11px 14px;
  border: 1px solid var(--cs-line);
  border-radius: 12px;
  background: #fafafa;
  color: var(--cs-text);
  font-size: 12.5px;
}

.notice svg {
  flex-shrink: 0;
  color: #c9a227;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 26px 16px;
}

/* ---------- 面板里的控件：点下去弹"未实现"提示 ----------
   光标给 pointer，否则用户不会去点；悬停不额外加高亮，控件自身样式已够清楚。 */
.srow,
.ssel,
.sbtn,
.tgl,
.slink,
.stext-btn,
.sico-btn,
.ssearch,
.sinput,
.stextarea,
.ptab,
.sactions,
.swatch,
.psec-row,
.app-ico {
  cursor: pointer;
}
</style>
