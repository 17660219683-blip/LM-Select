<script setup>
/**
 * 复刻件里**所有**弹出层共用的外壳。
 *
 * 只负责"一张浮起来的白卡片"：定位、圆角、阴影、淡入。
 * 里面的条目由调用方用插槽填 —— 各菜单的条目结构差别很大
 * （右侧有的是快捷键、有的是说明文字，有的还分区块），
 * 做成配置驱动的通用菜单要多写一层抽象，改起来更绕。
 *
 * ⚠️ 定位相对**最近的定位祖先**，所以触发元素那层必须 position: relative，
 * 否则卡片会跑到复刻件外面去。
 *
 * ⚠️ 指向"整行宽度"的弹出层（比如输入框下面那个加号菜单）不要挂在按钮上，
 * 要直接挂在 .composer 这种整行容器上 —— 挂在 26px 的圆按钮上，
 * stretch 出来的宽度就只有 26px。
 */
defineProps({
  /** 水平对齐：left 贴左边，right 贴右边，stretch 左右都贴（跟定位祖辈同宽） */
  align: { type: String, default: 'left' },
  /** 垂直方向：down 往下弹，up 往上弹 */
  side: { type: String, default: 'down' },
  /** 最小宽度（像素）。0 表示完全由内容撑开 */
  minWidth: { type: Number, default: 0 },
})
</script>

<template>
  <div
    class="pop"
    :class="[`a-${align}`, `s-${side}`]"
    :style="minWidth ? { minWidth: `${minWidth}px` } : null"
  >
    <slot />
  </div>
</template>

<style scoped>
.pop {
  position: absolute;
  z-index: 30;
  padding: 5px;
  border: 1px solid #ececee;
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 10px 28px rgba(20, 20, 26, 0.13),
    0 1px 3px rgba(20, 20, 26, 0.07);
  animation: pop-in 0.11s ease-out;
}

.a-left {
  left: 0;
}

.a-right {
  right: 0;
}

.a-stretch {
  right: 0;
  left: 0;
}

.s-down {
  top: calc(100% + 6px);
}

.s-up {
  bottom: calc(100% + 6px);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
