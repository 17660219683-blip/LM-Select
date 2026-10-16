import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { showStubToast } from './composables/stubToast'

import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

/*
  v-stub：标记"看着能点、其实没实现"的元素（三个界面复刻件里用）。
  不带值 → 元素自身（含内部）任何点击都提示；
  带选择器 → 只有点击落在匹配的子元素上才提示 —— 给整块设置面板用，
             免得点面板空白处也弹提示。
  写成全局指令是为了三个复刻件和它们各自的设置组件都用同一份实现。
*/
app.directive('stub', {
  mounted(el, binding) {
    el.__stubOnClick = (e) => {
      const sel = binding.value
      if (typeof sel === 'string') {
        const t = e.target
        if (!(t instanceof Element) || !t.closest(sel)) return
      }
      showStubToast()
    }
    el.addEventListener('click', el.__stubOnClick)
  },
  unmounted(el) {
    el.removeEventListener('click', el.__stubOnClick)
    delete el.__stubOnClick
  },
})

app.mount('#app')
