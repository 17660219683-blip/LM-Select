<script setup>
/**
 * WorkBuddy AI 的「设置」弹窗（纯视觉复刻）。
 *
 * 按 "workbuddy ai/设置弹出页1~12.png" 逐面板还原。
 * 悬浮在主窗口上的居中小弹窗（不是整页替换）：背景压暗，白底圆角浮窗，
 * 右上 ✕ 关闭，左侧分组导航，右侧面板内容。
 *
 * 真的只有两件事：面板之间的切换、右上 ✕ / Esc 关闭。
 * 里面所有控件都不带功能：下拉打不开、开关不切换、按钮点了没反应。
 *
 * ⚠️ 「快捷键」面板没有对应截图 —— 面板留空，不编造内容。
 */
import { ref } from 'vue'

const emit = defineEmits(['close'])

const NAV = [
  {
    group: null,
    items: [
      { id: 'general', name: '通用', icon: 'gear' },
      { id: 'profile', name: '个人主页', icon: 'person' },
      { id: 'plan', name: '套餐与积分', icon: 'coin' },
      { id: 'shortcuts', name: '快捷键', icon: 'keyboard' },
    ],
  },
  {
    group: '功能',
    items: [
      { id: 'personalize', name: '个性化', icon: 'palette' },
      { id: 'memory', name: '记忆与进化', icon: 'bulb' },
      { id: 'agents', name: '智能体', icon: 'bot' },
      { id: 'models', name: '模型', icon: 'shield' },
      { id: 'assistant', name: '助理', icon: 'person' },
    ],
  },
  {
    group: '数据与安全',
    items: [
      { id: 'data', name: '数据管理', icon: 'db' },
      { id: 'security', name: '安全中心', icon: 'check' },
    ],
  },
  {
    group: null,
    bottom: true,
    items: [
      { id: 'about', name: '关于', icon: 'info' },
      { id: 'help', name: '获取帮助', icon: 'help' },
    ],
  },
]

const ICONS = {
  gear: [
    'M8 5.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z',
    'M8 1.9v1.7M8 12.4v1.7M2.5 8h1.7M11.8 8h1.7',
    'M4.1 4.1l1.2 1.2M10.7 10.7l1.2 1.2M11.9 4.1l-1.2 1.2M5.3 10.7l-1.2 1.2',
  ],
  person: [
    'M8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z',
    'M3.2 13.4c.4-2.3 2.5-3.6 4.8-3.6s4.4 1.3 4.8 3.6',
  ],
  coin: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M8 5v6M10 6.4c-.5-.7-1.2-1-2-1-1.1 0-2 .6-2 1.5 0 2 4 1 4 3 0 .9-.9 1.5-2 1.5-.8 0-1.5-.3-2-1'],
  keyboard: ['M2.4 4.6h11.2v6.8H2.4z', 'M4.4 6.6h.01M7 6.6h.01M9.6 6.6h.01M4.4 8.8h.01M9.6 8.8h.01M6.2 8.8h3.6'],
  palette: ['M8 2.6a5.4 5.4 0 1 0 0 10.8c.9 0 1.2-.6 1-1.2-.3-.9.2-1.6 1.2-1.6h1a2.2 2.2 0 0 0 2.2-2.4A5.5 5.5 0 0 0 8 2.6Z', 'M5.4 7.4h.01M7.4 5.2h.01M10 5.6h.01'],
  bulb: ['M8 2.4a3.6 3.6 0 0 1 1.8 6.7c-.5.3-.8.6-.8 1.1H7c0-.5-.3-.8-.8-1.1A3.6 3.6 0 0 1 8 2.4Z', 'M7 12h2M7.4 13.6h1.2'],
  bot: ['M4.6 5.4h6.8a1 1 0 0 1 1 1v4.4a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V6.4a1 1 0 0 1 1-1Z', 'M6.4 8h.01M9.6 8h.01', 'M8 5.4V3.4M8 3.4a.9.9 0 1 0-.1 0Z'],
  shield: ['M8 2.4 13 4.2v3.4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4.2Z', 'M6 8l1.4 1.4L10 6.8'],
  db: ['M8 2.8c3 0 5.4.8 5.4 1.8S11 6.4 8 6.4 2.6 5.6 2.6 4.6 5 2.8 8 2.8Z', 'M2.6 4.6v6.8c0 1 2.4 1.8 5.4 1.8s5.4-.8 5.4-1.8V4.6', 'M2.6 8c0 1 2.4 1.8 5.4 1.8s5.4-.8 5.4-1.8'],
  check: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M5.6 8.2 7.4 10l3.2-3.6'],
  info: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M8 7.4v3.2M8 5.2h.01'],
  help: ['M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z', 'M6.4 6.2a1.7 1.7 0 1 1 2.6 1.4c-.7.4-1 .7-1 1.5', 'M8 11.4h.01'],
  close: ['M4 4l8 8M12 4l-8 8'],
  chevDown: ['M4.4 6.4 8 10l3.6-3.6'],
  chevRight: ['M6.4 4.4 10 8l-3.6 3.6'],
  ext: ['M6.4 4h6.6v6.6', 'M13 4 7.5 9.5', 'M11 12.6H3.4V5'],
}

const panel = ref('general')

/** 远程通道（设置页面8）。品牌色块代替各产品图标 */
const CHANNELS = [
  { name: 'Slack 集成', desc: '注册 Slack 应用，通过 Slack 接收和回复消息。', color: '#4a154b', mark: '#' },
  { name: 'Discord 集成', desc: '注册 Discord 机器人以接收和回复消息。', color: '#5865f2', mark: 'D' },
  { name: '微信助理', desc: '通过微信直接下发指令，结果实时回传至微信聊天窗口。', color: '#2aae67', mark: '微' },
  { name: '飞书集成', desc: '接入飞书机器人，成员可在群聊中直接与 WorkBuddy 对话，高效处理指令。', color: '#3370ff', mark: '飞' },
  { name: '钉钉机器人集成', desc: '接入钉钉机器人，成员可在群聊中直接与 WorkBuddy 对话，高效处理指令。', color: '#1e6fff', mark: '钉' },
]

const DATA_TABS = ['分享的文件', '分享的任务', '归档的任务']
const dataTab = ref(0)
</script>

<template>
  <!-- 背景压暗层：点空白处关闭；.st 上 stop 防止点弹窗内部误关 -->
  <div class="st-wrap" @click.self="emit('close')">
    <div class="st" @click.stop>
    <button type="button" class="x" title="关闭" @click="emit('close')">
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path :d="ICONS.close[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
    </button>

    <!-- ============ 左侧导航 ============ -->
    <aside class="nav">
      <p class="nav-title">设置</p>
      <template v-for="(g, gi) in NAV" :key="gi">
        <p v-if="g.group" class="nav-group">{{ g.group }}</p>
        <div v-if="g.bottom" class="nav-bottom-gap" />
        <button
          v-for="it in g.items"
          :key="it.id"
          type="button"
          class="nav-item"
          :class="{ on: panel === it.id }"
          @click="panel = it.id"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path v-for="(d, i) in ICONS[it.icon]" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
          {{ it.name }}
        </button>
      </template>
    </aside>

    <!-- ============ 右侧面板 ============ -->
    <!--
      面板里的控件几乎都是摆设，点下去弹统一提示。
      区域指令 + 选择器：逐个加会漏，且点面板空白处不该弹。
      .data-tab 除外（"数据管理"的三个 tab 是真的能切）。
    -->
    <div
      v-stub="'.row, .btn, .toggle, .select, .chev, .link, .plan-btn, .num-input, .q, .card, .plain'"
      class="panel-scroll"
    >
      <!-- ========== 通用 ========== -->
      <section v-if="panel === 'general'" class="panel">
        <p class="sec">常规</p>
        <div class="card">
          <div class="row">
            <span class="row-label">语言</span>
            <span class="select">简体中文 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">链接打开方式</p>
              <p class="row-desc">设置 WorkBuddy AI 对话中链接的默认打开策略。</p>
            </div>
            <span class="select">智能打开 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <div class="row tall">
            <span class="row-label">字体大小</span>
            <div class="slider">
              <div class="slider-track"><i /></div>
              <div class="slider-marks"><span>小</span><span>默认</span><span>大</span></div>
            </div>
          </div>
        </div>

        <p class="sec">权限</p>
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">允许锁屏运行</p>
              <p class="row-desc">选择锁屏后的运行方式，保障远程控制与后台 Agent 任务持续执行。</p>
            </div>
            <span class="select">关闭 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">开机自动启动</p>
              <p class="row-desc">开启后 WorkBuddy AI 会在你登录电脑后自动启动。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">网络代理</p>
              <p class="row-desc">配置 WorkBuddy AI 访问网络的方式。修改后立即生效，无需重启。</p>
            </div>
            <span class="select">直接连接 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">自动安装可信技能</p>
              <p class="row-desc">安全检测通过后自动安装，高风险项始终要求手动确认。</p>
            </div>
            <span class="toggle"><i /></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">技能自动更新</p>
              <p class="row-desc">开启后将自动更新已安装的技能为最新版本，不会更新你在 WorkBuddy AI 中编辑过的技能</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
        </div>
      </section>

      <!-- ========== 个人主页 ========== -->
      <section v-else-if="panel === 'profile'" class="panel">
        <div class="card">
          <div class="profile-head">
            <span class="avatar">1</span>
            <div class="profile-main">
              <p class="profile-mail">17660219683@163.com
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3.2 12.8l.4-2.7 7.4-7.4a1.6 1.6 0 0 1 2.2 0l.1.1a1.6 1.6 0 0 1 0 2.2l-7.4 7.4Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
              </p>
              <p class="profile-plan">个人版</p>
            </div>
            <span class="btn ghost">前往管理中心
              <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.ext[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
            </span>
          </div>
        </div>
        <div class="card">
          <div class="logout">退出登录</div>
        </div>
      </section>

      <!-- ========== 套餐与积分 ========== -->
      <section v-else-if="panel === 'plan'" class="panel">
        <div class="card">
          <div class="plan-head">
            <span class="plan-name">Free</span>
            <span class="btn dark">升级套餐</span>
          </div>
          <div class="plan-total">
            <span class="plan-num">349.65</span>
            <span class="plan-unit">总剩余积分</span>
          </div>
          <div class="plan-grid">
            <div><p class="plan-label">套餐基础积分</p><p class="plan-num sm">100</p></div>
            <div><p class="plan-label">平台奖励积分</p><p class="plan-num sm">249.65</p></div>
            <div><p class="plan-label">购买积分</p><p class="plan-num sm">0</p></div>
          </div>
        </div>

        <p class="sec">积分明细</p>
        <div class="card">
          <p class="detail-name">套餐基础积分</p>
          <div class="detail-row">
            <span class="row-desc">下次刷新时间 2026/11/01 00:00:00</span>
            <span class="row-desc">已使用 0/100 剩余100%</span>
          </div>
          <div class="bar"><i style="width: 100%" /></div>

          <p class="detail-name second">平台奖励积分</p>
          <div class="detail-row">
            <span class="row-desc">最近到期时间 2026/10/28 18:13:33</span>
            <span class="row-desc">已使用 0.35/250 剩余99%</span>
          </div>
          <div class="bar"><i style="width: 99.86%" /></div>
          <p class="detail-link">查看明细
            <svg viewBox="0 0 16 16" width="11" height="11"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </p>
        </div>
      </section>

      <!-- ========== 快捷键（无截图，留空） ========== -->
      <section v-else-if="panel === 'shortcuts'" class="panel" />

      <!-- ========== 个性化 ========== -->
      <section v-else-if="panel === 'personalize'" class="panel">
        <div class="card">
          <div class="row">
            <span class="row-label">WorkBuddy AI 对你的称呼</span>
            <span class="select dim">暂无内容，点击编辑添加</span>
          </div>
          <div class="row">
            <span class="row-label">WorkBuddy AI 的名字</span>
            <span class="select dim">暂无内容，点击编辑添加</span>
          </div>
        </div>
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">回复风格</p>
              <p class="row-desc">选择 WorkBuddy AI 回复的默认语气。</p>
            </div>
            <span class="select">默认 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">欢迎语</p>
              <p class="row-desc">当对话加载较慢时，用一句问候陪你等待。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">显示文件修改过程</p>
              <p class="row-desc">开启后，WorkBuddy AI 会逐步展示每次文件改动的过程与结果。</p>
            </div>
            <span class="toggle"><i /></span>
          </div>
        </div>
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">自定义指令</p>
              <p class="row-desc">规定 WorkBuddy AI 的工作规范与行为准则，对所有任务生效。</p>
            </div>
            <span class="btn ghost">编辑</span>
          </div>
          <div class="textarea">例如：回答先给结论再展开…</div>
        </div>
      </section>

      <!-- ========== 记忆与进化 ========== -->
      <section v-else-if="panel === 'memory'" class="panel">
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">对话记忆</p>
              <p class="row-desc">记住对话中的重要信息，让后续回答更贴合你。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">本地记忆与技能</p>
              <p class="row-desc">自动记录工作过程并优化技能，数据仅保存在你的设备上。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
        </div>
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">管理记忆</p>
              <p class="row-desc">每晚自动整理更新，可随时查看和编辑。</p>
            </div>
            <span class="btn ghost">导入</span>
          </div>
        </div>
        <p class="foot-note">记忆内容遵循 <u>WorkBuddy AI 隐私政策</u>，仅你本人可见</p>
      </section>

      <!-- ========== 智能体 ========== -->
      <section v-else-if="panel === 'agents'" class="panel">
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">智能体团队管理
                <i class="badge-off">禁用中</i>
              </p>
              <p class="row-desc">开启后，复杂任务会自动拆给多个智能体协作完成。专家团任务不受此设置影响。</p>
            </div>
            <span class="select">禁用 <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.chevDown[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </div>
        </div>
      </section>

      <!-- ========== 模型 ========== -->
      <section v-else-if="panel === 'models'" class="panel">
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">自定义模型</p>
              <p class="row-desc">模型添加后会自动写入到本地 <u>%USERPROFILE%\.workbuddy-ai\models.json</u> 文件中。</p>
            </div>
            <span class="btn ghost">添加模型</span>
          </div>
        </div>
      </section>

      <!-- ========== 助理 ========== -->
      <section v-else-if="panel === 'assistant'" class="panel">
        <p class="sec plain">远程通道</p>
        <p class="row-desc lead">连接第三方消息通道，即可远程指挥电脑端 WorkBuddy 执行任务。<u>配置指南</u></p>
        <div class="ch-grid">
          <div v-for="c in CHANNELS" :key="c.name" class="ch">
            <div class="ch-head">
              <span class="ch-ico" :style="{ background: c.color }">{{ c.mark }}</span>
              <span class="ch-name">{{ c.name }}</span>
              <span class="btn dark sm">连接</span>
            </div>
            <p class="ch-desc">{{ c.desc }}</p>
          </div>
        </div>
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">上下文管理</p>
              <p class="row-desc">启用后，本地助理长时间无输入时会话将自动重置，有效降低积分消耗。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">自动截断上下文时间</p>
              <p class="row-desc">超过设定时间后，将会自动截断上下文记忆。</p>
            </div>
            <span class="num-input"><b>6</b> 小时</span>
          </div>
        </div>
      </section>

      <!-- ========== 数据管理 ========== -->
      <section v-else-if="panel === 'data'" class="panel">
        <div class="data-tabs">
          <span
            v-for="(t, i) in DATA_TABS"
            :key="t"
            class="data-tab"
            :class="{ on: dataTab === i }"
            @click="dataTab = i"
          >{{ t }}</span>
        </div>
        <div class="card empty-card">
          {{ dataTab === 0 ? '暂无分享文件' : dataTab === 1 ? '暂无分享任务' : '暂无归档任务' }}
        </div>
      </section>

      <!-- ========== 安全中心 ========== -->
      <section v-else-if="panel === 'security'" class="panel">
        <div class="card">
          <div class="row tall">
            <div>
              <p class="row-label">沙箱安全
                <svg viewBox="0 0 16 16" width="12" height="12" class="q" aria-hidden="true"><path v-for="(d, i) in ICONS.help" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
              </p>
              <p class="row-desc">AI 运行于隔离沙箱，并配置文件、命令、网络访问策略。</p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
          <div class="row tall link">
            <div>
              <p class="row-label">文件安全</p>
              <p class="row-desc">按优先级控制文件路径的读取、写入和删除。</p>
            </div>
            <svg viewBox="0 0 16 16" width="13" height="13" class="chev"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
          <div class="row tall link">
            <div>
              <p class="row-label">命令安全</p>
              <p class="row-desc">按优先级控制命令前缀的放行或询问。</p>
            </div>
            <svg viewBox="0 0 16 16" width="13" height="13" class="chev"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
          <div class="row tall link">
            <div>
              <p class="row-label">网络安全</p>
              <p class="row-desc">按优先级控制 URL 和域名访问。</p>
            </div>
            <svg viewBox="0 0 16 16" width="13" height="13" class="chev"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
          <div class="row tall">
            <div>
              <p class="row-label">自动备份
                <svg viewBox="0 0 16 16" width="12" height="12" class="q" aria-hidden="true"><path v-for="(d, i) in ICONS.help" :key="i" :d="d" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
              </p>
              <p class="row-desc">每轮对话修改文件之前自动备份。</p>
              <p class="backup-row">备份总上限 <span class="num-input plain"><b>3000</b> MB</span>
                <span class="btn ghost disabled">打开备份目录</span>
              </p>
            </div>
            <span class="toggle on"><i /></span>
          </div>
        </div>
        <div class="card">
          <div class="row tall link">
            <div>
              <p class="row-label">智能体工具管控</p>
              <p class="row-desc">控制智能体可调用的 Tool 和 MCP。</p>
            </div>
            <svg viewBox="0 0 16 16" width="13" height="13" class="chev"><path :d="ICONS.chevRight[0]" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </div>
        </div>
        <div class="card">
          <p class="row-label">数据安全</p>
          <p class="row-desc">数据流转及删除行为的安全防护。</p>
          <div class="row tall">
            <div>
              <p class="row-label">安全网关</p>
              <p class="row-desc">工作空间出入流量统一经过安全网关安全处理。</p>
            </div>
            <span class="on-badge">已开启</span>
          </div>
        </div>
      </section>

      <!-- ========== 关于 ========== -->
      <section v-else-if="panel === 'about'" class="panel">
        <div class="card">
          <div class="row tall">
            <span class="row-label">当前版本 <span class="ver">v5.7.6</span></span>
            <span class="btn ghost">检查更新</span>
          </div>
          <div class="row tall">
            <span class="row-label">关于 WorkBuddy AI</span>
            <span class="btn ghost">前往官网
              <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.ext[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
            </span>
          </div>
        </div>
        <p class="foot-note center"><u>隐私政策</u>&ensp;|&ensp;<u>服务协议</u></p>
      </section>

      <!-- ========== 获取帮助 ========== -->
      <section v-else-if="panel === 'help'" class="panel">
        <div class="card">
          <div class="row tall">
            <span class="row-label">意见反馈</span>
            <span class="btn ghost">填写反馈</span>
          </div>
          <div class="row tall">
            <span class="row-label">帮助文档</span>
            <span class="btn ghost">查看文档
              <svg viewBox="0 0 16 16" width="12" height="12"><path :d="ICONS.ext[0]" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
            </span>
          </div>
        </div>
      </section>
    </div>
    </div>
  </div>
</template>

<style scoped>
/*
  居中悬浮小弹窗：主窗口仍可见，背景整体压暗。
  尺寸取主窗口的 84% —— 够容纳左侧导航 + 面板内容，又明显小于主窗口，
  和截图里"设置弹出页"是一个独立悬浮窗的形态一致。
*/
.st-wrap {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(15, 15, 18, 0.34);
}

.st {
  position: relative;
  width: 84%;
  height: 84%;
  display: flex;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(5, 1, 10, 0.3);
  background: #fff;
  color: #1f1f23;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC',
    'Hiragino Sans GB', sans-serif;
  font-size: 13px;
}

.x {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #4c4c52;
  cursor: pointer;
}

.x:hover {
  background: #f0f0f1;
}

/* ---------- 左侧导航 ---------- */
.nav {
  display: flex;
  width: 244px;
  flex-shrink: 0;
  flex-direction: column;
  padding: 34px 14px 20px;
  background: #fff;
}

.nav-title {
  margin: 0 0 10px;
  padding: 0 8px;
  color: #9aa0a6;
  font-size: 12.5px;
}

.nav-group {
  margin: 18px 0 4px;
  padding: 0 8px;
  color: #9aa0a6;
  font-size: 12px;
}

.nav-bottom-gap {
  height: 34px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: none;
  border-radius: 9px;
  background: none;
  color: #1f1f23;
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: left;
}

.nav-item.on {
  background: #ececee;
  font-weight: 600;
}

.nav-item:hover:not(.on) {
  background: #f5f5f6;
}

/* ---------- 右侧面板 ---------- */
.panel-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 34px 40px 40px;
}

.panel {
  max-width: 860px;
}

.sec {
  margin: 0 0 10px;
  color: #9aa0a6;
  font-size: 13px;
}

.sec.plain {
  margin: 0;
  color: #1f1f23;
  font-size: 14.5px;
  font-weight: 700;
}

.card {
  margin-bottom: 18px;
  border-radius: 14px;
  background: #f7f7f8;
  padding: 6px 18px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
}

.row.tall {
  align-items: flex-start;
  padding: 16px 0;
}

.row .row-label {
  font-size: 14px;
  font-weight: 600;
}

.row-desc {
  margin: 5px 0 0;
  color: #9aa0a6;
  font-size: 12px;
  line-height: 1.6;
}

.row.link {
  cursor: default;
}

.chev {
  flex-shrink: 0;
  color: #9aa0a6;
}

.q {
  color: #b8b8bc;
}

.ver {
  color: #9aa0a6;
  font-weight: 400;
  font-size: 13px;
}

/* 下拉框（静态） */
.select {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  min-width: 128px;
  justify-content: space-between;
  padding: 7px 12px;
  border-radius: 9px;
  background: #fff;
  border: 1px solid #e4e4e6;
  color: #1f1f23;
  font-size: 13px;
  cursor: default;
}

.select.dim {
  color: #b8b8bc;
}

/* 开关（静态） */
.toggle {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 21px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #d8d8dc;
}

.toggle i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #fff;
}

.toggle.on {
  background: #12b76a;
}

.toggle.on i {
  left: auto;
  right: 2px;
}

/* 字体大小滑杆（静态） */
.slider {
  width: 240px;
  flex-shrink: 0;
}

.slider-track {
  position: relative;
  height: 3px;
  border-radius: 999px;
  background: #e4e4e6;
}

.slider-track i {
  position: absolute;
  top: 50%;
  left: 25%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1f1f23;
  transform: translateY(-50%);
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: #9aa0a6;
  font-size: 11px;
}

/* 按钮（静态） */
.btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9px;
  font-size: 12.5px;
  cursor: default;
}

.btn.ghost {
  border: 1px solid #e4e4e6;
  background: #fff;
  color: #1f1f23;
}

.btn.ghost.disabled {
  color: #c9c9cd;
}

.btn.dark {
  background: #1f1f23;
  color: #fff;
}

.btn.sm {
  padding: 5px 12px;
}

/* 个人主页 */
.profile-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
}

.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #ececee;
  font-size: 16px;
  font-weight: 600;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.profile-mail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.profile-plan {
  margin: 3px 0 0;
  color: #9aa0a6;
  font-size: 12.5px;
}

.logout {
  padding: 13px 0;
  text-align: center;
  font-size: 13.5px;
  cursor: default;
}

/* 套餐与积分 */
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
}

.plan-name {
  font-size: 14px;
  font-weight: 700;
}

.plan-total {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 0 14px;
}

.plan-num {
  font-size: 34px;
  font-weight: 700;
}

.plan-num.sm {
  font-size: 20px;
}

.plan-unit {
  color: #9aa0a6;
  font-size: 12.5px;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 4px 0 16px;
}

.plan-label {
  margin: 0 0 6px;
  color: #9aa0a6;
  font-size: 12px;
}

.detail-name {
  margin: 10px 0 4px;
  font-size: 14px;
  font-weight: 700;
}

.detail-name.second {
  margin-top: 22px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.bar {
  height: 5px;
  margin-top: 10px;
  border-radius: 999px;
  background: #e4e4e6;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #b8b8bc;
}

.detail-link {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 14px 0 8px;
  color: #9aa0a6;
  font-size: 12.5px;
  cursor: default;
}

.foot-note {
  margin: 4px 0 0;
  color: #9aa0a6;
  font-size: 12px;
  text-align: right;
}

.foot-note.center {
  text-align: center;
}

/* 个性化 */
.textarea {
  min-height: 130px;
  margin: 2px 0 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e4e4e6;
  color: #b8b8bc;
  font-size: 13px;
}

/* 智能体 */
.badge-off {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #fde8e8;
  color: #d92d20;
  font-size: 10.5px;
  font-style: normal;
  font-weight: 600;
  vertical-align: 2px;
}

/* 助理 */
.row-desc.lead {
  margin: 8px 0 16px;
}

.ch-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.ch {
  padding: 16px;
  border-radius: 14px;
  background: #f7f7f8;
}

.ch-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ch-ico {
  display: grid;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 7px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.ch-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
}

.ch-desc {
  margin: 10px 0 0;
  color: #9aa0a6;
  font-size: 12.5px;
  line-height: 1.6;
}

.num-input {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 9px;
  background: #fff;
  border: 1px solid #e4e4e6;
  font-size: 12.5px;
  color: #9aa0a6;
}

.num-input b {
  color: #1f1f23;
  font-weight: 600;
}

.num-input.plain {
  background: transparent;
  border: none;
  padding: 0;
}

.backup-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0 4px;
  font-size: 13px;
  color: #1f1f23;
}

.on-badge {
  flex-shrink: 0;
  padding: 2px 9px;
  border-radius: 999px;
  background: #e7f7f0;
  color: #12b76a;
  font-size: 11px;
  font-weight: 600;
}

/* 数据管理 */
.data-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
}

.data-tab {
  padding: 7px 14px;
  border-radius: 9px;
  color: #4c4c52;
  font-size: 13px;
  cursor: pointer;
}

.data-tab.on {
  background: #ececee;
  color: #1f1f23;
  font-weight: 600;
}

.empty-card {
  display: grid;
  min-height: 110px;
  place-items: center;
  color: #9aa0a6;
  font-size: 13px;
}

/* ---------- 面板里的控件：点下去弹"未实现"提示 ----------
   光标给 pointer，否则用户不会去点；悬停不额外加高亮，控件自身样式已够清楚。
   原来这几个类写的是 cursor: default，现在它们点了有反应（弹提示），改成手型。 */
.row,
.row.link,
.btn,
.toggle,
.select,
.chev,
.link,
.plan-btn,
.num-input,
.q,
.card {
  cursor: pointer;
}

.detail-link,
.logout {
  cursor: pointer;
}
</style>
