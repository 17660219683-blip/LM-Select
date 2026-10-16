<script setup>
/**
 * deepseek HARNESS 的鲸鱼标记（透明底）。
 *
 * 来源：用户提供的 1024×1024 应用图标 `图标.png`。
 * 应用图标自带圆角浅色底，直接内嵌在文字旁边会多出一个方块，
 * 所以另存了一份**只保留鲸鱼、背景透明**的版本 ——
 * 抠图时按 alpha 阈值处理，圆角外的全透明像素不会被误当成深色。
 *
 * 原始尺寸 752 × 554（比例约 1.36），比正方形宽，摆放时别当正方形用。
 */
import { computed } from 'vue'

const props = defineProps({
  /** 高度（像素）。宽度按原始比例自动算。 */
  size: { type: Number, default: 22 },
})

const LOGO_W = 752
const LOGO_H = 554

const width = computed(() => Math.round((props.size * LOGO_W) / LOGO_H))
</script>

<template>
  <img
    class="mark"
    src="/logos/deepseek-whale.png"
    :width="width"
    :height="size"
    alt=""
    aria-hidden="true"
  />
</template>

<style scoped>
.mark {
  display: block;
}
</style>
