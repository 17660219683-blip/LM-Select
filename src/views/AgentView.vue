<script setup>
/**
 * Agent 页。
 *
 * 初始状态是一排 agent 卡片（图标 + 名称 + 一句话描述），
 * 点开后在约占页面 80% 的弹窗里看它的界面复刻件。
 *
 * 这里回答的是「**这种 agent 长什么样、用起来是什么感觉**」，
 * 而不是「哪个 agent 更强」—— 所以页面里全是形态展示，没有任何评测数据。
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AgentCard from '@/components/agent/AgentCard.vue'
import AgentModal from '@/components/agent/AgentModal.vue'
import { AGENTS, findAgent } from '@/utils/agentCatalog'

const route = useRoute()
const router = useRouter()

/** 当前打开的 agent id，空串表示没开弹窗 */
const openedId = ref('')

const opened = computed(() => (openedId.value ? findAgent(openedId.value) : null))

/*
  把打开的 agent 同步到地址栏（?open=xxx）。
  一是弹窗状态变得可分享、可直接跳转；二是没有浏览器也能按 URL 截图核对，
  这页没有可交互测试，能不能"用地址复现某个状态"就很重要。
*/
onMounted(() => {
  const id = String(route.query.open ?? '')
  if (id && findAgent(id)) openedId.value = id
})

function open(id) {
  openedId.value = id
  router.replace({ query: { ...route.query, open: id } })
}

function close() {
  openedId.value = ''
  const query = { ...route.query }
  delete query.open
  router.replace({ query })
}
</script>

<template>
  <div class="agent-page">
    <header class="page-head">
      <h1>Agent试用</h1>
      <p class="lead">
        根据各家agent客户端复刻的<strong>网页端试用</strong>部分功能可用。
        基础对话、可设置部分、UI界面<strong>「这种形态适不适合我的工作方式」</strong>
        —— 本地文件树、对话式还是任务式、用量透不透明，这些在界面上最直观。
      
      </p>
    </header>

    <section class="grid">
      <AgentCard v-for="a in AGENTS" :key="a.id" :agent="a" @open="open" />
    </section>

    <!--
      试用页管「用起来什么感觉」，规格页管「差在哪」——
      两件事分开两页，但中间要给一座桥，不然规格页没有入口。

      这里刻意不写「这几款」的数量：试用卡片只有做成了复刻件的那几款，
      而规格页读的是数据库里的全部 Agent，两边的数字对不上（写死哪个都会误导）。
    -->
    <p class="spec-link">
      想对比各家的规格与能力差异？
      <RouterLink to="/agent/spec">查看规格对比（数据库全部 Agent × 25 项能力）→</RouterLink>
    </p>

    <p class="foot">
      注：本页收录 {{ AGENTS.length }} 款<strong>可试玩的界面复刻件</strong>；
      数据库里另收录了更多 Agent 的规格数据（见上方「规格对比」）。
      本页仅是<strong>界面复刻</strong>——外观按原产品还原，
      <strong>不是产品全部的能力</strong>；
      若想要使用全部功能，请点卡片底部链接<strong>前往官网</strong>下载客户端使用。
    </p>

    <AgentModal v-if="opened" :agent="opened" @close="close" />
  </div>
</template>

<style scoped>
.agent-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 76rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}

.page-head h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
}

.lead {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.86rem;
  line-height: 1.85;
}

.grid {
  display: grid;
  gap: 1rem;
  /* 卡片宽度收在 21~24rem：太窄描述会挤成一条，太宽又会把描述拉成整行 */
  grid-template-columns: repeat(auto-fill, minmax(21rem, 24rem));
  justify-content: start;
}

.spec-link {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.84rem;
}

.spec-link a {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}

.spec-link a:hover {
  text-decoration: underline;
}

.foot {
  margin: 0;
  color: var(--ink-dim);
  font-size: 0.74rem;
  line-height: 1.7;
}

.foot kbd {
  padding: 0.05rem 0.35rem;
  border: 1px solid rgba(27, 20, 37, 0.18);
  border-radius: 4px;
  background: #fff;
  font-family: inherit;
  font-size: 0.7rem;
}
</style>
