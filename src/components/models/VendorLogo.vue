<script setup>
/**
 * 厂商标识。
 *
 * 对外只暴露一个 size，内部三种形态都按同一比例（容器的 84%）渲染，
 * 所以同一张列表里所有 logo 的视觉大小严格一致。
 *
 * 84% 不是随手取的：本地 PNG 已统一成 128x128、图形占 108px（约 84%），
 * SVG 与首字母照这个比例对齐，三者混排才不会有大小差。
 */
import { computed } from 'vue'

import { vendorBrand } from '@/utils/vendorBrand'

const props = defineProps({
  code: { type: String, required: true },
  /** 边长（px）。全站统一传同一个值，保证大小一致 */
  size: { type: Number, default: 22 },
})

const brand = computed(() => vendorBrand(props.code))
</script>

<template>
  <span
    class="logo"
    :style="{ '--size': `${size}px`, '--brand': brand.color }"
    :title="brand.label"
    role="img"
    :aria-label="brand.label"
  >
    <!-- 有本地图片优先用图片 -->
    <img v-if="brand.file" class="mark bitmap" :src="brand.file" :alt="brand.label" />

    <!-- 其次是内联 SVG，用品牌色填充 -->
    <svg v-else-if="brand.icon" class="mark glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path :d="brand.icon" fill="currentColor" />
    </svg>

    <!-- 都没有就退回品牌色首字母 -->
    <span v-else class="mark initial" aria-hidden="true">{{ brand.initial }}</span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-grid;
  flex-shrink: 0;
  place-items: center;
  box-sizing: border-box;
  width: var(--size);
  height: var(--size);
  color: var(--brand);
  user-select: none;
}

/* 三种形态共用同一尺寸，这是"大小统一"的关键一行 */
.mark {
  display: block;
  width: 84%;
  height: 84%;
}

.bitmap {
  object-fit: contain;
}

.initial {
  display: grid;
  place-items: center;
  font-size: calc(var(--size) * 0.72);
  font-weight: 800;
  line-height: 1;
}
</style>
