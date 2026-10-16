<script setup>
/**
 * Agent 界面复刻弹窗。
 *
 * 只放复刻件本身，**不带自己的头部与说明文字** ——
 * 任何常驻在复刻件上方的东西都会挡住它，让"像不像"打折扣。
 *
 * ⚠️ 代价是没有可见的关闭按钮，所以下面两种关闭方式必须可靠：
 *    Esc，以及点击复刻件周围的空白。
 *    这不是装饰性代码，去掉任何一条用户就会被困在弹窗里。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'

import StubToast from '@/components/common/StubToast.vue'

const props = defineProps({
  agent: { type: Object, required: true },
})

/*
  复刻件按各自截图的宽高比放进框里（agent.aspect，缺省 1603/1028）。
  比例不能改：一变，内部所有元素的相对尺寸都会跟着走形。
*/
const aspect = computed(() => props.agent.aspect ?? 1603 / 1028)
const frameStyle = computed(() => ({
  width: `min(85vw, calc(78vh * ${aspect.value}))`,
  aspectRatio: String(aspect.value),
}))

const emit = defineEmits(['close'])

function onKeydown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // 弹窗打开期间锁住页面滚动，否则背景会跟着滚
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- 点复刻件以外的区域即可关闭；@click.self 保证点复刻件内部不会误关 -->
  <div class="backdrop" @click.self="emit('close')">
    <div class="stack">
      <div class="frame" :style="frameStyle">
        <component :is="agent.component" />
      </div>
      <!--
        常驻说明放在复刻件**外面**（下方），不压在上面 ——
        界面复刻得越像，这条标识越必要：没有它，用户分不清
        哪些是真能用的、哪些只是样子。
      -->
      <p class="note">
        界面复刻件 · <b>对话真实可用</b>（走本项目的 DeepSeek 后端，非原产品能力）；
        菜单与设置页可以打开，其中未实现的功能点击后会给出提示。
      </p>
    </div>

    <!--
      提示条挂在弹窗这一层，不放进复刻件内部：复刻件有 overflow: hidden 会被裁掉，
      而且三个复刻件共用一条，不必各写一份。
    -->
    <StubToast />
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(14, 8, 24, 0.45);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

/*
  宽高比由 agent.aspect 内联决定（见 script），这里只保留外观。
  高度留一档给下面那行常驻说明 —— 不留的话它会把复刻件顶出屏幕。
*/
.stack {
  display: flex;
  max-width: 92vw;
  flex-direction: column;
  gap: 10px;
}

.frame {
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(5, 1, 10, 0.34);
}

.note {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.74rem;
  line-height: 1.6;
  text-align: center;
}

.note b {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}
</style>
