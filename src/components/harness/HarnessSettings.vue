<script setup>
/**
 * deepseek HARNESS 的「设置」弹窗（纯视觉复刻）。
 *
 * 按 deepseekharness/设置页1~5.png 逐面板还原。
 * **里面所有控件都不带功能**：下拉打不开、开关不切换、按钮点了没反应。
 * 唯一真的东西是左侧五个面板之间的切换和关闭按钮 ——
 * 那是这个弹窗能"看"的最小前提。
 *
 * ⚠️ 有几处的原文在截图里看不见，别当成原产品文案：
 *   - 「网页链接默认打开方式」的说明文字被裁掉了，这里补的是自己写的；
 *   - 内置插件只截到 10 个，卡片上写着"29 个"，剩下的 19 个没有名字可依，
 *     所以只复刻看得见的那 10 个。填编造的名字比少画 19 张卡片更糟。
 * 两处都在代码里就近标注了。
 *
 * 图标一律用路径数据画，不引第三方图标库 ——
 * 复刻件的依赖越少，以后想改越不容易被别的包卡住。
 */
import { ref } from 'vue'

defineEmits(['close'])

const PANELS = [
  {
    id: 'account',
    name: '账号与余额',
    icon: [
      'M8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z',
      'M3.2 13.4c.4-2.3 2.5-3.6 4.8-3.6s4.4 1.3 4.8 3.6',
    ],
  },
  {
    id: 'general',
    name: '通用设置',
    icon: [
      'M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z',
      'M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7',
      'M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2',
    ],
  },
  {
    id: 'model',
    name: '模型',
    icon: ['M3.6 3.6h8.8v8.8H3.6z', 'M6.6 6.6h2.8v2.8H6.6z'],
  },
  {
    id: 'plugins',
    name: '内置插件',
    icon: [
      'M6.2 2.6v3M9.8 2.6v3',
      'M4.2 5.6h7.6v1.9a3.8 3.8 0 0 1-7.6 0z',
      'M8 11.3v2.1',
    ],
  },
  {
    id: 'presets',
    name: 'Agent 预设',
    icon: ['M8 2.6l1.3 3.4 3.4 1.3-3.4 1.3L8 12l-1.3-3.4L3.3 7.3l3.4-1.3z'],
  },
]

const panel = ref('account')

/** 通用设置里那三张外观卡片 */
const THEMES = ['浅色', '深色', '跟随系统']
const theme = ref('浅色')

/**
 * 内置插件。名字与说明逐字照抄截图（截断处按截图原样的省略号收尾）。
 * 只列截图里看得见的 10 个，见文件头说明。
 */
const PLUGINS = [
  {
    name: 'persona',
    desc: 'Composition-authored deployment persona section for the DeepSeek Harness',
  },
  {
    name: 'agent-instructions',
    desc: 'Workspace context loader for AGENTS.md/CLAUDE.md instruction files',
  },
  {
    name: 'tool-bash',
    off: true,
    desc: 'Model-facing bash tool with optional generic background-job and sandbox-escalation…',
  },
  {
    name: 'tool-pwsh',
    desc: 'Model-facing pwsh tool over the bash executor seam',
  },
  {
    name: 'tool-fs',
    desc: 'Model-facing filesystem tools (read, write, edit) over the DeepSeek Harness filesystem…',
  },
  {
    name: 'tool-fs-search',
    desc: 'Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binar…',
  },
  {
    name: 'tool-jobs',
    desc: 'Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs…',
  },
  {
    name: 'skill-filesystem',
    desc: 'Local filesystem skill provider for the DeepSeek Harness',
  },
  {
    name: 'tool-skill',
    desc: 'Model-facing skill loading tool for the DeepSeek Harness',
  },
  {
    name: 'command-goal',
    desc: 'Human-facing slash command for persisted same-session goals',
  },
]

/** Agent 预设。id 就是截图里卡片右上角那串小字 */
const PRESETS = [
  {
    id: 'standard',
    name: '标准模式',
    tag: '新任务默认',
    desc: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检察、编辑和终端等工具。',
  },
  {
    id: 'ptc',
    name: 'PTC 模式',
    tag: '内置',
    desc: '包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。',
  },
  {
    id: 'minimal',
    name: '极简模式',
    tag: '内置',
    desc: 'Agent 仅使用终端工具完成任务，适合测试和对比其基础表现。',
  },
  {
    id: 'cordis',
    name: '创造模式',
    tag: '内置',
    desc: '用对话定制 DSH：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',
  },
]
</script>

<template>
  <!-- 背景压暗，点空白关闭；点弹窗内部不关 -->
  <div class="hs" @click.self="$emit('close')">
    <div class="dialog">
      <header class="dlg-head">
        <span class="dlg-title">设置</span>
        <div class="dlg-head-right">
          <span class="ghost">打开配置文件</span>
          <button type="button" class="x" title="关闭" @click="$emit('close')">✕</button>
        </div>
      </header>

      <div class="dlg-body">
        <nav class="dlg-nav">
          <button
            v-for="p in PANELS"
            :key="p.id"
            type="button"
            class="nav-item"
            :class="{ on: panel === p.id }"
            @click="panel = p.id"
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                v-for="(d, i) in p.icon"
                :key="i"
                :d="d"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ p.name }}
          </button>
        </nav>

        <!--
          面板里所有控件都是摆设，点下去弹统一提示。
          用区域指令 + 选择器，而不是逐个加：面板里控件太多，
          逐个加容易漏；限定选择器是为了点面板空白处不弹 —— 空白不是"可点的东西"。
          .theme-card 除外（它是真的能切主题），所以不在选择器里。
        -->
        <section
          v-stub="'.row, .btn, .sel, .prov, .prov-add, .preset-new, .search, .toggle, .pay-row, .card'"
          class="dlg-content"
        >
          <!-- ---------- 账号与余额 ---------- -->
          <template v-if="panel === 'account'">
            <div class="card acct">
              <span class="acct-avatar" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16">
                  <path
                    d="M8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
                    fill="currentColor"
                  />
                  <path
                    d="M3.2 13.4c.4-2.3 2.5-3.6 4.8-3.6s4.4 1.3 4.8 3.6"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <div class="acct-main">
                <p class="acct-title">已登录 DeepSeek</p>
                <p class="acct-sub">176******83@163.com</p>
              </div>
              <span class="acct-link">更多账号信息 ↗</span>
            </div>

            <div class="card">
              <div class="pay-row">
                <span class="pay-label">充值余额</span>
                <span class="pay-amount">$0.00 + ¥40.69</span>
              </div>
              <div class="pay-row pay-foot">
                <span class="pay-more">更多</span>
                <span class="pay-actions">
                  <span class="btn">查询用量</span>
                  <span class="btn dark">充值</span>
                </span>
              </div>
            </div>
          </template>

          <!-- ---------- 通用设置 ---------- -->
          <template v-else-if="panel === 'general'">
            <div class="row">
              <div class="row-main">
                <p class="row-title">权限</p>
                <p class="row-desc">选择新会话的默认权限模式</p>
              </div>
              <span class="sel">工作区内修改 <i class="chev">⌄</i></span>
            </div>

            <div class="row">
              <p class="row-title">语言</p>
              <span class="sel">中文 <i class="chev">⌄</i></span>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">外观</p>
              </div>
            </div>
            <div class="theme-grid">
              <button
                v-for="t in THEMES"
                :key="t"
                type="button"
                class="theme-card"
                :class="{ on: theme === t }"
                @click="theme = t"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.2" />
                  <path
                    d="M8 2.6v10.8"
                    stroke="currentColor"
                    stroke-width="1.2"
                  />
                </svg>
                {{ t }}
              </button>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">字号大小</p>
                <p class="row-desc">仅影响会话内容的字号</p>
              </div>
              <span class="num">14 <i>px</i></span>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">工作步骤展示</p>
                <p class="row-desc">选择希望看到多少工具调用细节</p>
              </div>
              <span class="sel">标准 <i class="chev">⌄</i></span>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">显示代码工作视图</p>
                <p class="row-desc">开启后，显示轨迹、本轮代码差异，可选择完整的 Agent 预设切换</p>
              </div>
              <span class="toggle on" aria-hidden="true"><i /></span>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">快捷键</p>
                <p class="row-desc">查看和编辑当前可用的快捷键和输入操作</p>
              </div>
              <span class="btn">编辑快捷键</span>
            </div>

            <div class="row">
              <div class="row-main">
                <p class="row-title">网页链接默认打开方式</p>
                <!-- 说明文字在截图里被裁掉了，这句是自己补的，不是原产品文案 -->
                <p class="row-desc">选择点击网页链接时的打开位置</p>
              </div>
              <span class="sel">应用内侧边框 <i class="chev">⌄</i></span>
            </div>
          </template>

          <!-- ---------- 模型 ---------- -->
          <template v-else-if="panel === 'model'">
            <p class="sec-title">模型</p>
            <p class="sec-desc">填入各提供商的 API 密钥即可使用其模型。</p>

            <div class="card prov">
              <span class="prov-name">DeepSeek 账号</span>
              <span class="btn">编辑</span>
            </div>
            <div class="card prov">
              <span class="prov-name">DeepSeek <i class="dot-ok" /></span>
              <span class="btn">编辑</span>
            </div>
            <div class="card prov dashed">
              <span class="prov-add">＋ 添加模型提供商</span>
            </div>
          </template>

          <!-- ---------- 内置插件 ---------- -->
          <template v-else-if="panel === 'plugins'">
            <p class="sec-title">内置插件</p>
            <p class="sec-desc">查看内置部署的插件列表</p>

            <div class="search">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.3" />
                <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
              </svg>
              <span class="search-ph">搜索插件</span>
            </div>

            <div class="plug-head">
              <span class="plug-head-title">会话插件</span>
              <span class="sel">标准模式（默认） <i class="chev">⌄</i></span>
            </div>
            <p class="plug-count">由 Agent 按会话组成 · 29 个</p>

            <div class="plug-grid">
              <div v-for="p in PLUGINS" :key="p.name" class="plug-card">
                <div class="plug-top">
                  <span class="plug-name">{{ p.name }}</span>
                  <span v-if="p.off" class="plug-off">已停用</span>
                  <svg class="plug-chev" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                    <path d="M4.4 6.4 8 10l3.6-3.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                  </svg>
                </div>
                <p class="plug-desc">{{ p.desc }}</p>
              </div>
            </div>
          </template>

          <!-- ---------- Agent 预设 ---------- -->
          <template v-else>
            <p class="sec-title">Agent 预设</p>
            <p class="sec-desc">
              选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 DSH 的能力用「创造模式」。
            </p>

            <p class="sub-title">内置</p>
            <div class="preset-grid">
              <div v-for="p in PRESETS" :key="p.id" class="preset-card">
                <div class="preset-top">
                  <span class="preset-name">{{ p.name }}</span>
                  <span class="preset-tag">{{ p.tag }}</span>
                  <span class="preset-id">{{ p.id }}</span>
                </div>
                <p class="preset-desc">{{ p.desc }}</p>
                <div class="preset-foot">
                  <span>模式说明</span>
                  <span class="preset-foot-sep">·</span>
                  <span>如何使用</span>
                  <span class="preset-foot-copy" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="13" height="13">
                      <rect x="5.6" y="5.6" width="7.6" height="7.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2" />
                      <path d="M10.4 3.2H4.2a1.4 1.4 0 0 0-1.4 1.4v6.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            <p class="sub-title">自定义</p>
            <div class="preset-new">＋ 让 Agent 帮我创建预设模式</div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hs {
  --hs-text: #2b2b2f;
  --hs-dim: #8b8b90;
  --hs-line: #ececee;
  --hs-hover: #f4f4f6;

  position: absolute;
  z-index: 40;
  display: grid;
  inset: 0;
  place-items: center;
  border-radius: 12px;
  background: rgba(24, 24, 28, 0.2);
  color: var(--hs-text);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC',
    'Hiragino Sans GB', sans-serif;
  font-size: 13px;
}

/*
  弹窗尺寸按原图比例：宽约占窗口 62%、高约占 88%。
  用百分比而不是固定像素，复刻件整体缩放时它才跟着一起缩。
*/
.dialog {
  display: flex;
  width: 62%;
  height: 88%;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 50px rgba(10, 10, 16, 0.28);
}

.dlg-head {
  display: flex;
  align-items: center;
  padding: 16px 16px 12px 22px;
}

.dlg-title {
  font-size: 15px;
  font-weight: 600;
}

.dlg-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.ghost {
  padding: 4px 10px;
  border: 1px solid #e2e2e5;
  border-radius: 8px;
  font-size: 12.5px;
}

.x {
  padding: 2px 4px;
  border: none;
  background: none;
  color: var(--hs-text);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
}

.dlg-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.dlg-nav {
  display: flex;
  width: 25%;
  min-width: 9rem;
  flex-shrink: 0;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--hs-text);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
}

.nav-item.on {
  background: var(--hs-hover);
  font-weight: 500;
}

.dlg-content {
  min-width: 0;
  flex: 1;
  padding: 2px 22px 22px 4px;
  overflow-y: auto;
}

/* ---------- 通用行 ---------- */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 0;
  border-bottom: 1px solid var(--hs-line);
}

.row-main {
  min-width: 0;
}

.row-title {
  margin: 0;
  font-size: 13.5px;
}

.row-desc {
  margin: 4px 0 0;
  color: var(--hs-dim);
  font-size: 12px;
  line-height: 1.5;
}

/* 假下拉：只是个样子，点不开 */
.sel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid #e2e2e5;
  border-radius: 8px;
  font-size: 13px;
  white-space: nowrap;
}

.chev {
  color: var(--hs-dim);
  font-size: 11px;
  font-style: normal;
}

.num {
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid #e2e2e5;
  border-radius: 8px;
  font-size: 13px;
}

.num i {
  color: var(--hs-dim);
  font-style: normal;
}

.toggle {
  position: relative;
  width: 34px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #d6d6da;
}

.toggle.on {
  background: #1f1f24;
}

.toggle i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
}

.toggle.on i {
  left: 16px;
}

.btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border: 1px solid #e2e2e5;
  border-radius: 8px;
  font-size: 12.5px;
  white-space: nowrap;
}

.btn.dark {
  border-color: #1f1f24;
  background: #1f1f24;
  color: #fff;
}

/* ---------- 外观三卡片 ---------- */
.theme-grid {
  display: grid;
  gap: 10px;
  padding: 2px 0 13px;
  border-bottom: 1px solid var(--hs-line);
  grid-template-columns: repeat(3, 1fr);
}

.theme-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px 0;
  border: 1px solid #e2e2e5;
  border-radius: 10px;
  background: #fff;
  color: var(--hs-text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.theme-card.on {
  border-color: #b9b9c0;
  background: #f7f7f9;
}

/* ---------- 卡片 ---------- */
.card {
  padding: 14px 16px;
  border: 1px solid var(--hs-line);
  border-radius: 10px;
  background: #fff;
}

.card + .card {
  margin-top: 12px;
}

.acct {
  display: flex;
  align-items: center;
  gap: 12px;
}

.acct-avatar {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #f0f0f2;
  color: #a0a0a6;
}

.acct-main {
  min-width: 0;
}

.acct-title {
  margin: 0;
  font-size: 13.5px;
}

.acct-sub {
  margin: 3px 0 0;
  color: var(--hs-dim);
  font-size: 12px;
}

.acct-link {
  margin-left: auto;
  color: var(--hs-text);
  font-size: 12.5px;
  white-space: nowrap;
}

.pay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pay-row.pay-foot {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--hs-line);
}

.pay-label {
  font-size: 13.5px;
}

.pay-amount {
  font-size: 15px;
  font-weight: 600;
}

.pay-more {
  color: var(--hs-dim);
  font-size: 13px;
}

.pay-actions {
  display: flex;
  gap: 10px;
}

/* ---------- 面板小标题 ---------- */
.sec-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.sec-desc {
  margin: 8px 0 18px;
  color: var(--hs-dim);
  font-size: 12.5px;
  line-height: 1.6;
}

.sub-title {
  margin: 18px 0 10px;
  color: var(--hs-dim);
  font-size: 12.5px;
}

.prov {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.prov-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
}

.dot-ok {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2bb673;
}

.prov.dashed {
  justify-content: center;
  border-style: dashed;
  color: var(--hs-dim);
}

/* ---------- 内置插件 ---------- */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border: 1px solid #e2e2e5;
  border-radius: 9px;
  color: var(--hs-dim);
}

.search-ph {
  font-size: 13px;
}

.plug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.plug-head-title {
  font-size: 13.5px;
}

.plug-count {
  margin: 5px 0 12px;
  color: var(--hs-dim);
  font-size: 12px;
}

.plug-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, 1fr);
}

.plug-card {
  padding: 11px 12px;
  border: 1px solid var(--hs-line);
  border-radius: 10px;
}

.plug-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plug-name {
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plug-off {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0f0f2;
  color: var(--hs-dim);
  font-size: 11px;
  white-space: nowrap;
}

.plug-chev {
  flex-shrink: 0;
  color: var(--hs-dim);
}

.plug-desc {
  margin: 7px 0 0;
  color: var(--hs-dim);
  font-size: 11.5px;
  line-height: 1.5;
}

/* ---------- Agent 预设 ---------- */
.preset-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, 1fr);
}

.preset-card {
  display: flex;
  flex-direction: column;
  padding: 12px 13px;
  border: 1px solid var(--hs-line);
  border-radius: 10px;
}

.preset-top {
  display: flex;
  align-items: center;
  gap: 7px;
}

.preset-name {
  font-size: 13.5px;
  font-weight: 500;
}

.preset-tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0f0f2;
  color: var(--hs-dim);
  font-size: 10.5px;
  white-space: nowrap;
}

.preset-id {
  margin-left: auto;
  color: var(--hs-dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
}

.preset-desc {
  margin: 9px 0 0;
  color: var(--hs-dim);
  font-size: 12px;
  line-height: 1.6;
}

.preset-foot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--hs-line);
  color: var(--hs-dim);
  font-size: 11.5px;
}

.preset-foot-sep {
  color: #c8c8cd;
}

.preset-foot-copy {
  display: flex;
  margin-left: auto;
}

.preset-new {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border: 1px dashed #d6d6da;
  border-radius: 10px;
  color: var(--hs-dim);
  font-size: 13px;
}

/* ---------- 面板里的控件：点下去弹"未实现"提示 ----------
   光标给 pointer —— 不给的话用户不会去点，那句提示也就永远看不到。
   悬停不额外加高亮：控件自身的样式已经表达得很清楚，再加一层会显得像真的可用。 */
.row,
.btn,
.sel,
.prov,
.prov-add,
.preset-new,
.search,
.toggle,
.pay-row,
.card {
  cursor: pointer;
}
</style>
