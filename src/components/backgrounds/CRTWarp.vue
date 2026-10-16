<script setup>
/**
 * CRTWarp —— ReactBits 背景组件的 Vue 3 移植版。
 *
 * 顶点着色器、片元着色器、渲染循环逻辑与原版完全一致，只改了「外壳」：
 *   useRef                       -> 模板 ref / setup 内的普通变量
 *   useEffect(..., [])           -> onMounted + onBeforeUnmount
 *   useEffect(..., [deps])       -> watch(() => [deps...], syncUniforms)
 *   pausedRef / fpsRef           -> 直接在 RAF 里读 props（响应式，永远是最新值）
 *
 * 唯一的逻辑改动：指针监听从 container 移到 window。
 * 因为作为背景时外层设了 pointer-events: none（否则会挡住页面所有点击），
 * 挂在 container 上收不到 pointermove，mouseReact 会失效。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  color: { type: String, default: '#c755f7' },
  backgroundColor: { type: String, default: '#05010a' },
  speed: { type: Number, default: 0.5 },
  curvature: { type: Number, default: 0.25 },
  scanlineStrength: { type: Number, default: 0.25 },
  scanlineFrequency: { type: Number, default: 200 },
  waveAmplitude: { type: Number, default: 0.3 },
  waveFrequency: { type: Number, default: 2.5 },
  bloom: { type: Number, default: 1.5 },
  bloomRadius: { type: Number, default: 1 },
  noise: { type: Number, default: 0.1 },
  vignette: { type: Number, default: 0 },
  brightness: { type: Number, default: 1.25 },
  pixelation: { type: Number, default: 1 },
  rgbShift: { type: Number, default: 0.015 },
  mouseReact: { type: Boolean, default: true },
  mouseStrength: { type: Number, default: 0.5 },
  dpr: { type: Number, default: 1 },
  fps: { type: Number, default: 30 },
  paused: { type: Boolean, default: false },
})

const container = ref(null)

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uBackgroundColor;
uniform float uCurvature;
uniform float uScanlineStrength;
uniform float uScanlineFrequency;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uBloom;
uniform float uBloomRadius;
uniform float uNoise;
uniform float uVignette;
uniform float uBrightness;
uniform float uPixelation;
uniform float uRgbShift;
uniform vec2 uPointer;
uniform float uMouseStrength;
uniform float uMouseReact;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 crtCurve(vec2 uv, float radius) {
  vec2 p = (uv - 0.5) * 2.0;
  float safeRadius = max(radius, 1.415);
  float cornerScale = safeRadius / sqrt(max(safeRadius * safeRadius - 2.0, 0.001));
  p = safeRadius * p / sqrt(max(safeRadius * safeRadius - dot(p, p), 0.001));
  p /= cornerScale;
  return p * 0.5 + 0.5;
}

float referencePlasma(vec2 uv, float t) {
  float frequencyScale = max(uWaveFrequency / 2.2, 0.001);
  uv = (uv - 0.5) * frequencyScale + 0.5;

  float scanline = 0.5 - 0.5 * cos(uv.y * 3.14159265 * uScanlineFrequency);
  scanline = mix(1.0, scanline, uScanlineStrength);

  uv *= vec2(80.0, 24.0);
  uv = ceil(uv);
  uv /= vec2(80.0, 24.0);

  float amplitude = uWaveAmplitude / 0.28;
  float field = 0.0;
  field += 0.7 * sin(0.5 * uv.x + t / 5.0);
  field += 3.0 * sin(1.6 * uv.y + t / 5.0);
  field += sin(10.0 * (uv.y * sin(t / 2.0) + uv.x * cos(t / 5.0)) + t / 2.0);

  float cx = uv.x + 0.5 * sin(t / 2.0);
  float cy = uv.y + 0.5 * cos(t / 4.0);
  field += 0.4 * sin(sqrt(100.0 * cx * cx + 100.0 * cy * cy + 1.0) + t);
  field += 0.9 * sin(sqrt(75.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field -= 1.4 * sin(sqrt(256.0 * cx * cx + 25.0 * cy * cy + 1.0) + t);
  field += 0.3 * sin(0.5 * uv.y + uv.x + sin(t));

  return scanline * floor(3.0 * (0.5 + 0.499 * sin(field * amplitude))) / 3.0;
}

void main() {
  vec2 uv = vUv;
  if (uPixelation > 1.001) {
    vec2 cells = max(uResolution / uPixelation, vec2(1.0));
    uv = (floor(uv * cells) + 0.5) / cells;
  }

  float curveRadius = 1.1 + 0.42 / max(uCurvature, 0.001);
  if (uMouseReact > 0.5) {
    curveRadius *= exp(-uPointer.y * uMouseStrength * 0.4);
  }
  vec2 curvedUv = crtCurve(uv, curveRadius);
  if (uMouseReact > 0.5) {
    curvedUv.x -= uPointer.x * uMouseStrength * 0.035;
  }

  float signal = referencePlasma(curvedUv, uTime);
  float radius = 0.01 * uBloomRadius;
  float glow = signal * 0.2;
  glow += referencePlasma(curvedUv + vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(radius, 0.0), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv - vec2(0.0, radius), uTime) * 0.12;
  glow += referencePlasma(curvedUv + vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv - vec2(radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(radius, -radius), uTime) * 0.08;
  glow += referencePlasma(curvedUv + vec2(-radius, radius), uTime) * 0.08;

  float redSignal = referencePlasma(curvedUv + vec2(uRgbShift, 0.0), uTime);
  float blueSignal = referencePlasma(curvedUv - vec2(uRgbShift, 0.0), uTime);
  vec3 channelSignal = vec3(redSignal, signal, blueSignal);
  vec3 waveColor = uColor * (0.3 + signal * 0.7 + glow * uBloom * 0.65);
  waveColor += (channelSignal - signal) * 0.42;

  float edge = clamp(1.0 - dot(vUv - 0.5, vUv - 0.5) * 2.0, 0.0, 1.0);
  float edgeFade = mix(1.0, smoothstep(0.0, 1.0, edge), uVignette);
  float waveMask = clamp(signal * 0.82 + glow * 0.52, 0.0, 1.0) * edgeFade;

  float grain = hash21(gl_FragCoord.xy + vec2(fract(uTime) * 173.0));
  waveColor = max(waveColor * uBrightness, vec3(0.0));
  vec3 color = mix(uBackgroundColor, waveColor, waveMask);
  color += (grain - 0.5) * uNoise;
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

/* 非响应式中继变量，等价于原版里的 materialRef.current / rendererRef.current */
let material = null
let renderer = null
let frameId = 0
let visible = true
let lastFrame = 0
let teardown = null

const pointerTarget = new THREE.Vector2(0, 0)
const pointerCurrent = new THREE.Vector2(0, 0)

/** 对应原版第二个 useEffect：把 props 写进 uniform 并同步渲染尺寸 */
function syncUniforms() {
  if (!material || !renderer) return

  const u = material.uniforms
  u.uColor.value.set(props.color)
  u.uBackgroundColor.value.set(props.backgroundColor)
  u.uSpeed.value = props.speed
  u.uCurvature.value = props.curvature
  u.uScanlineStrength.value = props.scanlineStrength
  u.uScanlineFrequency.value = props.scanlineFrequency
  u.uWaveAmplitude.value = props.waveAmplitude
  u.uWaveFrequency.value = props.waveFrequency
  u.uBloom.value = props.bloom
  u.uBloomRadius.value = props.bloomRadius
  u.uNoise.value = props.noise
  u.uVignette.value = props.vignette
  u.uBrightness.value = props.brightness
  u.uPixelation.value = props.pixelation
  u.uRgbShift.value = props.rgbShift
  u.uMouseReact.value = props.mouseReact ? 1 : 0
  u.uMouseStrength.value = props.mouseStrength

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, props.dpr))

  const el = container.value
  if (el) {
    renderer.setSize(Math.max(el.clientWidth, 1), Math.max(el.clientHeight, 1), false)
    u.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
  }
}

onMounted(() => {
  const el = container.value
  if (!el) return undefined

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const geometry = new THREE.PlaneGeometry(2, 2)

  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uSpeed: { value: 0.5 },
      uColor: { value: new THREE.Color('#c755f7') },
      uBackgroundColor: { value: new THREE.Color('#05010a') },
      uCurvature: { value: 0.25 },
      uScanlineStrength: { value: 0.25 },
      uScanlineFrequency: { value: 200 },
      uWaveAmplitude: { value: 0.3 },
      uWaveFrequency: { value: 2.5 },
      uBloom: { value: 1.5 },
      uBloomRadius: { value: 1 },
      uNoise: { value: 0.1 },
      uVignette: { value: 0 },
      uBrightness: { value: 1.25 },
      uPixelation: { value: 1 },
      uRgbShift: { value: 0.015 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uMouseStrength: { value: 0.5 },
      uMouseReact: { value: 1 },
    },
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, props.dpr))
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)

  const resize = () => {
    const width = Math.max(el.clientWidth, 1)
    const height = Math.max(el.clientHeight, 1)
    renderer.setSize(width, height, false)
    material.uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  resize()

  const clock = new THREE.Clock()

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
  })
  visibilityObserver.observe(el)

  const render = (now) => {
    frameId = requestAnimationFrame(render)
    if (!visible || document.hidden) return

    const interval = 1000 / Math.max(1, props.fps)
    if (now - lastFrame < interval) return
    lastFrame = now - ((now - lastFrame) % interval)

    const delta = Math.min(clock.getDelta(), 0.1)
    if (!props.paused) material.uniforms.uTime.value += delta * material.uniforms.uSpeed.value

    pointerCurrent.lerp(pointerTarget, 0.08)
    material.uniforms.uPointer.value.copy(pointerCurrent)

    renderer.render(scene, camera)
  }

  render(0)

  /* 挂在 window 上而不是 container 上：背景层的 pointer-events 是 none */
  const onPointerMove = (event) => {
    const rect = el.getBoundingClientRect()
    pointerTarget.set(
      ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
      -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1),
    )
  }
  const onPointerLeave = () => pointerTarget.set(0, 0)

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('mouseleave', onPointerLeave)

  /* 对应原版依赖数组 effect 在挂载后先跑一次的行为 */
  syncUniforms()

  teardown = () => {
    cancelAnimationFrame(frameId)
    resizeObserver.disconnect()
    visibilityObserver.disconnect()
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('mouseleave', onPointerLeave)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    material = null
    renderer = null
  }

  return undefined
})

/* 对应原版第二个 useEffect 的依赖数组：任一 prop 变化就同步 uniform */
watch(
  () => [
    props.backgroundColor,
    props.bloom,
    props.bloomRadius,
    props.brightness,
    props.color,
    props.curvature,
    props.dpr,
    props.mouseReact,
    props.mouseStrength,
    props.noise,
    props.pixelation,
    props.rgbShift,
    props.scanlineFrequency,
    props.scanlineStrength,
    props.speed,
    props.fps,
    props.vignette,
    props.waveAmplitude,
    props.waveFrequency,
  ],
  syncUniforms,
)

onBeforeUnmount(() => {
  teardown?.()
  teardown = null
})
</script>

<template>
  <div ref="container" class="crt-warp-container"></div>
</template>

<style scoped>
.crt-warp-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/*
  canvas 是 three.js 运行时创建的，身上没有 scoped 的属性选择器标记，
  必须用 :deep() 才能命中；否则这条规则会被静默忽略。
*/
.crt-warp-container :deep(canvas) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
