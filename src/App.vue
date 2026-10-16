<script setup>
/**
 * App.vue 是「常驻外壳」：路由切换时它不会被销毁重建，
 * 所以 CRTWarp 只会初始化一次，所有页面共用同一个 WebGL 实例 ——
 * 既不会闪，也不会反复创建 WebGL 上下文把显卡资源耗光。
 *
 * 顶部导航栏也是全局的，挂在这里。
 *
 * 登录入口不再是弹窗：改成 /login 整页（见 views/AuthView.vue）。
 * 弹窗放不下注册表单的五个字段，也展示不清"等待审核"这个结果态。
 * 整页还有个好处是登录页有独立 URL，可以直接分享/刷新。
 */
import AppHeader from '@/components/common/AppHeader.vue'
import CRTWarp from '@/components/backgrounds/CRTWarp.vue'
</script>

<template>
  <!-- 背景层：固定在视口上，滚页面时不动；aria-hidden 让读屏软件忽略它 -->
  <div class="bg-layer" aria-hidden="true">
    <CRTWarp
      color="#d3e4ff"
      background-color="#ffffff"
      :speed="0.1"
      :curvature="0.52"
      :scanline-strength="0.25"
      :scanline-frequency="200"
      :wave-amplitude="0.3"
      :wave-frequency="2"
      :bloom="1.5"
      :bloom-radius="1"
      :noise="0.1"
      :vignette="0"
      :brightness="1.25"
      :pixelation="1"
      :rgb-shift="0.015"
      mouse-react
      :mouse-strength="0.5"
      :dpr="1"
      :fps="30"
    />
  </div>

  <AppHeader />

  <!-- 页面内容：叠在背景之上 -->
  <main class="app-content">
    <RouterView />
  </main>
</template>

<style scoped>
.bg-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  /* 让鼠标事件穿透到页面内容，否则背景会吃掉所有点击 */
  pointer-events: none;
}

.app-content {
  position: relative;
  z-index: 1;
  /* 给固定在顶部的导航栏让出高度 */
  padding-top: var(--nav-h);
}
</style>
