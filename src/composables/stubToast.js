import { ref } from 'vue'

/**
 * 复刻件里"看着能点、其实没实现"的元素的统一提示。
 *
 * 为什么要有这个：三个复刻件都刻意只复刻了界面，按钮点下去没反应。
 * 但"没反应"和"坏了"在用户那里分不清 —— 点一次没动静，就会怀疑是页面卡了。
 * 所以凡是看起来能点、实际是摆设的地方，点下去都给一句统一的说明，
 * 让"这里是复刻件"这件事在用户点下去的瞬间被说明白。
 */
export const STUB_TOAST_TEXT = '网站试用版部分功能不可用，具体功能请下载客户端体验'

/** 提示条是否可见。三个复刻件共用一份状态 —— 同一时刻只可能有一个复刻件在弹窗里 */
export const stubToastVisible = ref(false)

let timer = 0

/** 连点多下时重新计时，而不是叠出好几条 */
export function showStubToast() {
  stubToastVisible.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    stubToastVisible.value = false
  }, 2600)
}
