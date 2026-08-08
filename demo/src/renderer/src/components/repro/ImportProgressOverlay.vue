<template>
  <div class="ipo-backdrop" role="dialog" aria-modal="true" aria-label="文献分析进度">
    <div class="ipo-card">
      <!-- 顶部总进度 -->
      <div class="ipo-topbar">
        <span class="ipo-title">正在分析文献</span>
        <span class="ipo-percent">{{ percent }}</span>
      </div>
      <div class="ipo-track">
        <div class="ipo-track-fill" :style="{ width: percent }" />
      </div>

      <div class="ipo-body">
        <!-- 左侧：阶段步骤条 -->
        <div class="ipo-steps">
          <div
            v-for="(s, i) in steps"
            :key="s.key"
            class="ipo-step"
            :class="{ done: i < activeStep, active: i === activeStep }"
          >
            <div class="ipo-step-row">
              <div
                class="ipo-dot"
                :style="i >= activeStep ? { borderColor: s.color, color: s.color } : {}"
              >
                <svg
                  v-if="i < activeStep"
                  class="ipo-ic done-ic"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" d="M5 13l4 4L19 7" />
                </svg>
                <span v-else class="ipo-dot-idx" :class="{ spin: i === activeStep }">{{ i + 1 }}</span>
              </div>
              <div class="ipo-step-label" :class="{ dim: i > activeStep }">
                {{ s.label }}
              </div>
              <span v-if="i === activeStep" class="ipo-now">进行中</span>
            </div>
            <div v-if="i < steps.length - 1" class="ipo-step-line" :class="{ filled: i < activeStep }" />
          </div>
        </div>

        <!-- 右侧：阶段视觉区 -->
        <div class="ipo-stage">
          <div ref="visualRoot" class="ipo-visual">
            <Transition name="vis" mode="out-in">
              <!-- 解析提取：文档扫描 -->
              <div v-if="stage === 'parsing'" key="parsing" class="sv sv-parsing">
                <div class="p-scene">
                  <div class="p-doc p-back" />
                  <div class="p-doc p-front">
                    <div class="p-line" style="--w: 74%" />
                    <div class="p-line" style="--w: 92%" />
                    <div class="p-line" style="--w: 60%" />
                    <div class="p-line" style="--w: 86%" />
                    <div class="p-line" style="--w: 70%" />
                    <div class="p-line" style="--w: 48%" />
                    <div class="p-scan" />
                  </div>
                </div>
              </div>

              <!-- 入库落盘：文档飞入存储 -->
              <div v-else-if="stage === 'saving'" key="saving" class="sv sv-saving">
                <div class="s-tray">
                  <div class="s-tray-base" />
                  <div class="s-tray-slot" />
                </div>
                <div class="s-fly s-fly-1" />
                <div class="s-fly s-fly-2" />
                <div class="s-fly s-fly-3" />
              </div>

              <!-- 摘要生成：文字汇聚成摘要 -->
              <div v-else-if="stage === 'summarizing'" key="summarizing" class="sv sv-summarizing">
                <div class="m-orb" />
                <div class="m-lines">
                  <div class="m-line" style="--w: 96%" />
                  <div class="m-line" style="--w: 88%" />
                  <div class="m-line" style="--w: 74%" />
                  <div class="m-line" style="--w: 92%" />
                  <div class="m-line" style="--w: 56%" />
                </div>
              </div>

              <!-- 图表识别：图片网格扫描（OCR 切换为打字机） -->
              <div v-else-if="stage === 'recognizing' || stage === 'ocr'" :key="stage" class="sv sv-recog">
                <template v-if="stage === 'recognizing'">
                  <div class="g-grid">
                    <div
                      v-for="k in 9"
                      :key="k"
                      class="g-cell"
                      :class="{ lit: k <= gridLit, scan: k === gridActive }"
                    >
                      <span class="g-corner tl" /><span class="g-corner tr" />
                      <span class="g-corner bl" /><span class="g-corner br" />
                      <svg class="g-check" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="o-pane">
                    <div class="o-line" style="--w: 92%" />
                    <div class="o-line" style="--w: 78%" />
                    <div class="o-line" style="--w: 88%" />
                    <div class="o-line" style="--w: 64%" />
                    <div class="o-line" style="--w: 84%" />
                    <span class="o-caret" />
                  </div>
                </template>
              </div>

              <!-- 方案生成：反应式蓝图 -->
              <div v-else-if="stage === 'planning'" key="planning" class="sv sv-planning">
                <svg class="pl-svg" viewBox="0 0 320 118" fill="none">
                  <g stroke="currentColor" stroke-width="2" class="pl-main">
                    <path class="pl-path pl-a" d="M10 59 H96" />
                    <path class="pl-path pl-b" d="M112 59 H176" />
                    <path class="pl-path pl-c" d="M192 59 H272" />
                  </g>
                  <g class="pl-arrowg" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <path class="pl-arrow" d="M272 59 h34 m-10 -8 l10 8 -10 8" />
                  </g>
                  <g font-family="var(--font-sans)" font-size="20" font-weight="700">
                    <g class="pl-nodeg">
                      <rect class="pl-node" x="14" y="24" width="76" height="70" rx="12" stroke="currentColor" stroke-width="2" />
                      <text class="pl-char" x="52" y="68" text-anchor="middle" fill="currentColor">A</text>
                    </g>
                    <text class="pl-op" x="104" y="68" text-anchor="middle" fill="currentColor">+</text>
                    <g class="pl-nodeg">
                      <rect class="pl-node" x="120" y="24" width="76" height="70" rx="12" stroke="currentColor" stroke-width="2" />
                      <text class="pl-char" x="158" y="68" text-anchor="middle" fill="currentColor">B</text>
                    </g>
                    <g class="pl-nodeg">
                      <rect class="pl-node" x="226" y="24" width="76" height="70" rx="12" stroke="currentColor" stroke-width="2" />
                      <text class="pl-char" x="264" y="68" text-anchor="middle" fill="currentColor">C</text>
                    </g>
                  </g>
                </svg>
                <div class="pl-bars">
                  <div class="pl-bar" style="--h: 46%" />
                  <div class="pl-bar" style="--h: 68%" />
                  <div class="pl-bar" style="--h: 58%" />
                  <div class="pl-bar" style="--h: 84%" />
                </div>
              </div>
            </Transition>
          </div>

          <!-- 阶段标题与说明 -->
          <div class="ipo-stage-title" :style="{ color: stepColor }">{{ stageTitle }}</div>
          <div class="ipo-stage-detail">{{ detail }}</div>
          <div v-if="subText" class="ipo-sub">{{ subText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import gsap from 'gsap'

/** 主进程 document-import:progress 事件负载（与 src/main/ai-server/type.ts 对齐） */
export interface ImportProgress {
  stage: 'parsing' | 'saving' | 'summarizing' | 'recognizing' | 'ocr' | 'planning' | 'done'
  fileIndex?: number
  fileTotal?: number
  fileName?: string
  parser?: string
  imageIndex?: number
  imageTotal?: number
  detail?: string
}

const props = defineProps<{ progress: ImportProgress | null }>()

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const RT = (s: number): number => (reduceMotion ? 0 : s)

/* ---------- 阶段元信息 ---------- */
const steps = [
  { key: 'parsing', label: '解析提取', color: 'var(--color-accent)' },
  { key: 'saving', label: '入库落盘', color: 'var(--color-primary-light)' },
  { key: 'summarizing', label: '摘要生成', color: '#a78bfa' },
  { key: 'recognizing', label: '图表识别', color: '#f472b6' },
  { key: 'planning', label: '方案生成', color: '#f59e0b' }
] as const

const META: Record<string, { title: string; hint: string }> = {
  parsing: { title: '解析提取', hint: '正在读取 PDF 文本、图片与表格…' },
  saving: { title: '入库落盘', hint: '正在将文献与 Markdown 保存到应用数据…' },
  summarizing: { title: '摘要生成', hint: '正在通读全文、提炼论文目的与要点…' },
  recognizing: { title: '图表识别', hint: '多模态模型正在逐张识别论文图表…' },
  ocr: { title: 'OCR 文字识别', hint: 'VLM 未能识别，正在用 OCR 提取图中文字…' },
  planning: { title: '方案生成', hint: '正在根据文献生成复现方案与实验流程…' }
}

const stage = computed(() => props.progress?.stage ?? 'parsing')

function stepIndexOf(s: string): number {
  if (s === 'parsing') return 0
  if (s === 'saving') return 1
  if (s === 'summarizing') return 2
  if (s === 'recognizing' || s === 'ocr') return 3
  return 4
}
const activeStep = computed(() => stepIndexOf(stage.value))
const stepColor = computed(() => steps[activeStep.value]?.color ?? 'var(--color-accent)')
const stageTitle = computed(() => META[stage.value]?.title ?? '分析中')
const detail = computed(() => props.progress?.detail || META[stage.value]?.hint || '')
const percent = computed(() => `${Math.round(((activeStep.value + 1) / steps.length) * 100)}%`)

/* ---------- 图片识别进度（并发完成，按事件计数） ---------- */
const recognizedCount = ref(0)
const ocrCount = ref(0)
const imageTotal = computed(() => props.progress?.imageTotal ?? 0)
watch(
  () => props.progress,
  (p) => {
    if (p?.stage === 'recognizing' && p.imageIndex !== undefined) recognizedCount.value += 1
    if (p?.stage === 'ocr' && p.imageIndex !== undefined) ocrCount.value += 1
  },
  { immediate: true }
)
const gridLit = computed(() => {
  if (!imageTotal.value) return 0
  return Math.min(9, Math.max(1, Math.ceil((recognizedCount.value / imageTotal.value) * 9)))
})
const gridActive = computed(() => (gridLit.value < 9 ? gridLit.value + 1 : 0))
const subText = computed(() => {
  if (stage.value === 'recognizing' && imageTotal.value) return `${recognizedCount.value}/${imageTotal.value} 张已识别`
  if (stage.value === 'ocr' && imageTotal.value) return `OCR ${ocrCount.value}/${imageTotal.value} 张`
  if (props.progress?.fileTotal && props.progress.fileTotal > 1) {
    return `文件 ${props.progress.fileIndex ?? 1}/${props.progress.fileTotal}`
  }
  return ''
})

/* ---------- GSAP 各阶段动画（每阶段风格各异） ---------- */
const visualRoot = ref<HTMLElement | null>(null)
let ctx: gsap.Context | null = null

function animParsing(): void {
  // 文档扫描线往复 + 纸面轻微呼吸
  gsap.fromTo(
    '.p-scan',
    { y: -46 },
    {
      y: () => ((visualRoot.value?.querySelector('.p-scene') as HTMLElement | null)?.offsetHeight ?? 200) + 20,
      duration: RT(1.9),
      ease: 'sine.inOut',
      repeat: -1
    }
  )
  gsap.fromTo('.p-front', { y: 0 }, { y: -5, duration: RT(1.3), ease: 'sine.inOut', repeat: -1, yoyo: true })
}

function animSaving(): void {
  // 文档卡逐个飞入存储盒
  gsap.fromTo(
    '.s-fly',
    { y: -110, autoAlpha: 0, scale: 0.5, rotation: (i) => (i - 1) * 10 },
    {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      rotation: 0,
      duration: RT(0.6),
      ease: 'back.out(1.6)',
      stagger: RT(0.34),
      repeat: -1,
      repeatDelay: RT(0.7)
    }
  )
  gsap.fromTo('.s-tray-slot', { scaleX: 0.2 }, { scaleX: 1, duration: RT(0.8), ease: 'power3.out', repeat: -1, yoyo: true, delay: RT(0.4) })
}

function animSummarizing(): void {
  // 文字行从两侧汇聚、由模糊变清晰，中央光球脉动
  gsap.fromTo(
    '.m-line',
    { autoAlpha: 0, x: (i) => (i % 2 ? 30 : -30), filter: 'blur(5px)' },
    { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: RT(0.7), ease: 'power2.out', stagger: RT(0.12) }
  )
  gsap.fromTo('.m-orb', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: RT(0.8), ease: 'back.out(1.8)' })
  gsap.to('.m-orb', { scale: 1.14, duration: RT(1.1), ease: 'sine.inOut', repeat: -1, yoyo: true, delay: RT(0.9) })
}

function animRecognizing(): void {
  // 已点亮格子回弹（扫描角框为 CSS 动画，随激活格子切换）
  pulseGrid()
}

function pulseGrid(): void {
  gsap.fromTo(
    '.g-cell.lit',
    { scale: 0.86, autoAlpha: 0.4 },
    { scale: 1, autoAlpha: 1, duration: RT(0.45), ease: 'back.out(2.2)', stagger: RT(0.06) }
  )
}

function animOcr(): void {
  // 打字机逐行揭示 + 光标闪烁
  gsap.fromTo(
    '.o-line',
    { clipPath: 'inset(0 100% 0 0)', autoAlpha: 0.35 },
    {
      clipPath: 'inset(0 0% 0 0)',
      autoAlpha: 1,
      duration: RT(0.55),
      ease: 'power2.out',
      stagger: RT(0.32),
      repeat: -1,
      repeatDelay: RT(1.1)
    }
  )
  gsap.to('.o-caret', { autoAlpha: 0, duration: RT(0.5), ease: 'steps(1)', repeat: -1, yoyo: true })
}

function animPlanning(): void {
  // 反应式蓝图逐笔绘制 + 数据柱升起
  gsap.fromTo(
    '.pl-path',
    {
      strokeDashoffset: (_i, el: SVGPathElement) => el.getTotalLength(),
      strokeDasharray: (_i, el: SVGPathElement) => el.getTotalLength()
    },
    { strokeDashoffset: 0, duration: RT(1.3), ease: 'power2.inOut', stagger: RT(0.2) }
  )
  gsap.fromTo('.pl-nodeg', { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: RT(0.5), ease: 'back.out(2)', stagger: RT(0.14), delay: RT(0.5) })
  gsap.fromTo(
    '.pl-bar',
    { scaleY: 0 },
    { scaleY: 1, transformOrigin: 'bottom', duration: RT(0.7), ease: 'power3.out', stagger: RT(0.16), delay: RT(0.9) }
  )
}

const anims: Record<string, () => void> = {
  parsing: animParsing,
  saving: animSaving,
  summarizing: animSummarizing,
  recognizing: animRecognizing,
  ocr: animOcr,
  planning: animPlanning
}

watch(
  stage,
  async (s) => {
    await nextTick()
    ctx?.revert()
    ctx = gsap.context(() => {
      anims[s]?.()
    }, visualRoot.value ?? undefined)
  },
  { immediate: true }
)

watch(gridLit, async () => {
  if (stage.value !== 'recognizing') return
  await nextTick()
  pulseGrid()
})

onBeforeUnmount(() => ctx?.revert())
</script>

<style scoped>
/* ---------- 遮罩与卡片 ---------- */
.ipo-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 18, 0.66);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.ipo-card {
  width: min(680px, calc(100vw - 48px));
  border: 1px solid var(--lab-glass-border);
  border-radius: var(--radius-xl);
  background: var(--lab-glass);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  padding: 22px 24px 26px;
}
.ipo-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ipo-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-text);
}
.ipo-percent {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-accent-ink);
}
.ipo-track {
  height: 4px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
  margin-bottom: 20px;
}
.ipo-track-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  transition: width 0.5s ease;
}

.ipo-body {
  display: flex;
  gap: 28px;
}

/* ---------- 步骤条 ---------- */
.ipo-steps {
  flex-shrink: 0;
  width: 150px;
  display: flex;
  flex-direction: column;
}
.ipo-step {
  display: flex;
  flex-direction: column;
}
.ipo-step-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ipo-dot {
  position: relative;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  transition: border-color 0.3s, color 0.3s;
}
.ipo-step.done .ipo-dot {
  border-color: var(--color-success);
  color: var(--color-success);
  background: rgba(166, 227, 161, 0.1);
}
.ipo-step.active .ipo-dot {
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.15);
}
.ipo-dot-idx {
  font-size: 12.5px;
  font-weight: 700;
}
.ipo-dot-idx.spin {
  animation: ipo-spin 2.4s linear infinite;
}
@keyframes ipo-spin {
  to {
    transform: rotate(360deg);
  }
}
.ipo-ic {
  width: 14px;
  height: 14px;
}
.ipo-step-label {
  font-size: 12.5px;
  color: var(--color-text);
  transition: color 0.3s;
}
.ipo-step-label.dim {
  color: var(--color-text-muted);
}
.ipo-now {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--color-accent-ink);
  white-space: nowrap;
  animation: ipo-blink 1.6s ease-in-out infinite;
}
@keyframes ipo-blink {
  50% {
    opacity: 0.35;
  }
}
.ipo-step-line {
  position: relative;
  width: 2px;
  height: 26px;
  margin: 4px 0 4px 12px;
  border-radius: 2px;
  background: var(--color-border);
  overflow: hidden;
}
.ipo-step-line.filled {
  background: var(--color-success);
}

/* ---------- 阶段视觉区 ---------- */
.ipo-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.ipo-visual {
  position: relative;
  width: 100%;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(17, 17, 27, 0.35);
  overflow: hidden;
  margin-bottom: 16px;
}
.sv {
  display: flex;
  align-items: center;
  justify-content: center;
}
.ipo-stage-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  margin-bottom: 4px;
}
.ipo-stage-detail {
  max-width: 380px;
  font-size: 12.5px;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.ipo-sub {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-accent-ink);
}

/* 切换过渡 */
.vis-enter-active,
.vis-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}
.vis-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.vis-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* ---------- 解析提取：文档扫描 ---------- */
.p-scene {
  position: relative;
  width: 132px;
  height: 172px;
}
.p-doc {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: rgba(205, 214, 244, 0.05);
}
.p-back {
  transform: translate(10px, 8px) rotate(2deg);
  opacity: 0.5;
}
.p-front {
  padding: 16px 12px;
  background: linear-gradient(160deg, rgba(49, 50, 68, 0.55), rgba(24, 24, 37, 0.6));
  overflow: hidden;
}
.p-line {
  height: 7px;
  width: var(--w);
  border-radius: 4px;
  background: rgba(108, 112, 134, 0.45);
  margin-bottom: 13px;
}
.p-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 38px;
  background: linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.3), transparent);
}

/* ---------- 入库落盘：飞入存储 ---------- */
.sv-saving {
  position: relative;
  width: 220px;
  height: 190px;
}
.s-tray {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
}
.s-tray-base {
  width: 150px;
  height: 46px;
  border-radius: 10px;
  border: 1.5px solid var(--color-primary-light);
  background: rgba(79, 70, 229, 0.12);
  box-shadow: 0 10px 26px rgba(79, 70, 229, 0.22);
}
.s-tray-slot {
  position: absolute;
  top: -7px;
  left: 12px;
  right: 12px;
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.55), rgba(34, 211, 238, 0.55));
  transform-origin: center;
}
.s-fly {
  position: absolute;
  left: 50%;
  top: 52px;
  width: 72px;
  height: 50px;
  border-radius: 8px;
  border: 1px solid;
}
.s-fly-1 {
  margin-left: -58px;
  border-color: rgba(99, 102, 241, 0.8);
  background: rgba(99, 102, 241, 0.18);
}
.s-fly-2 {
  margin-left: -18px;
  border-color: rgba(34, 211, 238, 0.8);
  background: rgba(34, 211, 238, 0.16);
}
.s-fly-3 {
  margin-left: 22px;
  border-color: rgba(167, 139, 250, 0.8);
  background: rgba(167, 139, 250, 0.16);
}

/* ---------- 摘要生成：汇聚 ---------- */
.sv-summarizing {
  position: relative;
  width: 250px;
  height: 170px;
}
.m-orb {
  position: absolute;
  left: 30%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(34, 211, 238, 0.9), rgba(79, 70, 229, 0.55));
  box-shadow: 0 0 34px rgba(34, 211, 238, 0.45);
}
.m-lines {
  position: absolute;
  left: 52%;
  top: 50%;
  transform: translateY(-50%);
  width: 148px;
}
.m-line {
  height: 8px;
  width: var(--w);
  border-radius: 4px;
  margin: 9px 0;
  background: linear-gradient(90deg, var(--color-text-muted), rgba(205, 214, 244, 0.55));
}

/* ---------- 图表识别：网格扫描 ---------- */
.g-grid {
  display: grid;
  grid-template-columns: repeat(3, 52px);
  gap: 10px;
}
.g-cell {
  position: relative;
  height: 48px;
  border-radius: 8px;
  border: 1px dashed var(--color-border);
  background: rgba(17, 17, 27, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s, background 0.3s;
}
.g-cell.lit {
  border-style: solid;
  border-color: rgba(244, 114, 182, 0.7);
  background: rgba(244, 114, 182, 0.14);
}
.g-cell.scan {
  border-color: var(--color-accent);
}
.g-corner {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 0 solid var(--color-accent);
  opacity: 0.85;
}
.g-cell.scan .g-corner {
  animation: g-corner-pulse 0.9s ease-in-out infinite;
}
@keyframes g-corner-pulse {
  50% {
    opacity: 0.15;
  }
}
.g-corner.tl { top: -2px; left: -2px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 3px; }
.g-corner.tr { top: -2px; right: -2px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 3px; }
.g-corner.bl { bottom: -2px; left: -2px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 3px; }
.g-corner.br { bottom: -2px; right: -2px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 3px; }
.g-check {
  width: 18px;
  height: 18px;
  color: var(--color-success);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.g-cell.lit .g-check {
  opacity: 1;
}

/* ---------- OCR：打字机 ---------- */
.o-pane {
  position: relative;
  width: 220px;
  padding: 18px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: rgba(17, 17, 27, 0.45);
}
.o-line {
  height: 8px;
  width: var(--w);
  border-radius: 4px;
  margin: 10px 0;
  background: linear-gradient(90deg, rgba(167, 139, 250, 0.75), rgba(205, 214, 244, 0.4));
  transform-origin: left;
}
.o-caret {
  position: absolute;
  right: 10px;
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: var(--color-accent);
}

/* ---------- 方案生成：蓝图 ---------- */
.sv-planning {
  flex-direction: column;
  gap: 14px;
}
.pl-svg {
  width: 300px;
  color: var(--color-accent-ink);
}
.pl-main {
  color: var(--color-accent-ink);
}
.pl-arrowg {
  color: var(--color-accent);
}
.pl-nodeg {
  color: var(--color-text);
}
.pl-node {
  fill: rgba(30, 30, 46, 0.6);
}
.pl-char,
.pl-op {
  paint-order: stroke;
  stroke: var(--color-surface-alt);
  stroke-width: 6px;
}
.pl-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 34px;
}
.pl-bar {
  width: 18px;
  height: var(--h);
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg, var(--color-accent), var(--color-primary));
  box-shadow: 0 0 12px rgba(34, 211, 238, 0.3);
}
</style>
