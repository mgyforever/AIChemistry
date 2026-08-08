<template>
  <div
    class="h-screen w-screen flex flex-col bg-[var(--color-surface)]"
    :class="{ 'page-resizing': dragging }"
  >
    <!-- 顶部栏（复用 LabTopBar 全局导航） -->
    <LabTopBar title="文献复现工作台">
      <template #actions>
        <button v-if="currentProjectId" type="button" class="tb-act" @click="importDocs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <span>上传文献</span>
        </button>
        <button v-else type="button" class="tb-act" disabled title="请先在左侧创建项目">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <span>先创建项目再上传</span>
        </button>
        <button v-if="currentProjectId" type="button" class="tb-act" @click="togglePause">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{{ pauseLabel }}</span>
        </button>
        <button v-if="currentProjectId && showMarkComplete" type="button" class="tb-act" @click="markComplete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>标记为已完成</span>
        </button>
      </template>
    </LabTopBar>

    <!-- 主体：三面板，可拖拽调整宽度 -->
    <main ref="mainRef" class="main-cols">
      <ProjectSidebar
        class="panel-left"
        :style="{ width: leftWidth + 'px' }"
        :projects="reproStore.projects"
        :current-id="reproStore.currentProjectId"
        @select="handleSelect"
        @create="createProject"
        @delete="deleteProject"
      />

      <!-- 左分隔条 -->
      <div
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整左侧项目栏宽度"
        tabindex="0"
        @mousedown.prevent="startResize('left', $event)"
        @dblclick="resetWidths"
        @keydown="onHandleKeydown('left', $event)"
      >
        <span class="rh-grip" />
      </div>

      <!-- 中部详情 -->
      <section class="flex-1 flex flex-col min-w-0">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="tab"
            :class="{ active: activeTab === t.key }"
            @click="switchTab(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
        <p v-if="tabWarning" class="tab-warning">{{ tabWarning }}</p>
        <!-- 实验中断恢复横幅：上次进度已保留，点击继续 -->
        <div v-if="resumeInfo" class="resume-banner">
          <div class="rb-text">
            <b>实验已暂停</b>
            <span>{{ resumeInfo.text }}</span>
          </div>
          <button type="button" class="rb-btn" @click="resume">继续实验</button>
        </div>
        <div class="tab-body">
          <PlanPanel v-if="activeTab === 'plan'" :ctx="reproStore.context" />
          <PhasePanel v-else-if="activeTab === 'phase'" :ctx="reproStore.context" />
          <FigurePanel v-else-if="activeTab === 'figure'" :project-id="reproStore.currentProjectId" />
          <PaperPanel v-else-if="activeTab === 'paper'" :project-id="reproStore.currentProjectId" :ctx="reproStore.context" />
          <ReferenceProjectsPanel v-else-if="activeTab === 'reference'" :project-id="reproStore.currentProjectId" />

          <!-- tab-body 确认按钮：仅复现方案页显示，确认后进入下一阶段 -->
          <div v-if="activeTab === 'plan' && currentProjectId" class="plan-confirm">
            <div class="plan-confirm-hint">
              <template v-if="isPlanConfirmed">✓ 复现方案已确认，可进入「阶段与记录」。</template>
              <template v-else>
                请与 AI 助手确认复现方案无误后，点击下方按钮进入「阶段与记录」；未确认前无法切换阶段。
              </template>
            </div>
            <button
              type="button"
              class="plan-confirm-btn"
              :class="{ confirmed: isPlanConfirmed }"
              @click="confirmPlanAndNext"
            >
              {{ isPlanConfirmed ? '重新确认并进入阶段与记录' : '确认方案，进入阶段与记录' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 右分隔条 -->
      <div
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整右侧 AI 助手宽度"
        tabindex="0"
        @mousedown.prevent="startResize('right', $event)"
        @dblclick="resetWidths"
        @keydown="onHandleKeydown('right', $event)"
      >
        <span class="rh-grip" />
      </div>

      <AgentPanel class="panel-right" :style="{ width: rightWidth + 'px' }" />
    </main>

    <!-- 文献分析进度浮层（阶段动画与主进程解析阶段同步） -->
    <ImportProgressOverlay v-if="showImportOverlay" :progress="importProgress" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { reproStore, loadLastProjectId } from '../stores/repro'
import LabTopBar from '../components/lab/LabTopBar.vue'
import ProjectSidebar from '../components/repro/ProjectSidebar.vue'
import PlanPanel from '../components/repro/PlanPanel.vue'
import PhasePanel from '../components/repro/PhasePanel.vue'
import FigurePanel from '../components/repro/FigurePanel.vue'
import PaperPanel from '../components/repro/PaperPanel.vue'
import ReferenceProjectsPanel from '../components/repro/ReferenceProjectsPanel.vue'
import AgentPanel from '../components/repro/AgentPanel.vue'
import ImportProgressOverlay, { type ImportProgress } from '../components/repro/ImportProgressOverlay.vue'

const api = window.api

const activeTab = ref('plan')

/* ---------- 文献导入进度浮层（与主进程 document-import:progress 阶段同步） ---------- */
const importProgress = ref<ImportProgress | null>(null)
const showImportOverlay = ref(false)

const tabs = [
  { key: 'plan', label: '复现方案' },
  { key: 'phase', label: '阶段与记录' },
  { key: 'figure', label: '图表解析' },
  { key: 'paper', label: '论文' },
  { key: 'reference', label: '参考项目' }
]

const currentProjectId = computed(() => reproStore.currentProjectId)
/** 项目状态：ongoing 进行中 / paused 已暂停 / completed 已完成 */
const projectStatus = computed(() => reproStore.context?.project.status ?? 'ongoing')
/** 当前项目是否已确认复现方案 */
const isPlanConfirmed = computed(() =>
  reproStore.currentProjectId !== null && reproStore.isPlanConfirmed(reproStore.currentProjectId)
)

/* ---------- 实验中断 / 恢复 ---------- */

/** 暂停/继续按钮文案 */
const pauseLabel = computed(() => {
  if (projectStatus.value === 'paused') return '继续实验'
  if (projectStatus.value === 'completed') return '恢复进行中'
  return '暂停实验'
})

/** 全部阶段已完成且未标记完成时，显示"标记为已完成" */
const showMarkComplete = computed(() => {
  if (projectStatus.value === 'completed') return false
  const phases = reproStore.context?.phases ?? []
  return phases.length > 0 && phases.every((p) => p.status === 'completed')
})

/** 暂停状态下的恢复信息（用于顶部横幅提示上次进度） */
const resumeInfo = computed(() => {
  const ctx = reproStore.context
  if (!ctx || ctx.project.status !== 'paused') return null
  const phases = [...ctx.phases].sort((a, b) => Number(a.phase_order) - Number(b.phase_order))
  const completed = phases.filter((p) => p.status === 'completed').length
  const current = phases.find((p) => p.status !== 'completed')
  const text = current
    ? `上次实验进行到「${current.name}」（已完成 ${completed}/${phases.length} 个阶段），进度已保留，可随时继续。`
    : `已完成全部 ${phases.length} 个阶段，进度已保留，可随时继续或标记完成。`
  return { text }
})

/** 暂停实验 / 继续实验 / 恢复进行中（切换状态不丢失任何进度数据） */
async function togglePause(): Promise<void> {
  if (!currentProjectId.value) return
  const s = projectStatus.value
  if (s === 'paused') {
    console.log('[View] 继续实验（paused → ongoing）, 项目ID:', currentProjectId.value)
    await reproStore.updateStatus('ongoing')
  } else if (s === 'completed') {
    console.log('[View] 恢复进行中（completed → ongoing）, 项目ID:', currentProjectId.value)
    await reproStore.updateStatus('ongoing')
  } else {
    console.log('[View] 暂停实验（ongoing → paused）, 项目ID:', currentProjectId.value)
    await reproStore.updateStatus('paused')
  }
}

/** 恢复实验并跳转到「阶段与记录」，便于从上次位置继续 */
function resume(): void {
  switchTab('phase')
  void togglePause()
}

/** 标记为已完成 */
async function markComplete(): Promise<void> {
  if (!currentProjectId.value) return
  console.log('[View] 标记为已完成, 项目ID:', currentProjectId.value)
  await reproStore.updateStatus('completed')
}

/* ---------- 阶段切换门控：方案确认后才可进入阶段与记录 ---------- */
const tabWarning = ref('')
let tabWarningTimer: ReturnType<typeof setTimeout> | null = null

/** 将当前标签页写入项目恢复点（中断后再进入时恢复到该页） */
function persistActiveTab(key: string): void {
  if (currentProjectId.value === null) return
  const state = { activeTab: key, updatedAt: new Date().toISOString() }
  api.db.project
    .update(currentProjectId.value, { resume_state: JSON.stringify(state) })
    .catch((err) => console.warn('[View] 保存标签页恢复点失败:', err))
}

/** 解析项目恢复点 JSON */
function parseResumeState(s: string): { activeTab?: string } {
  try {
    const obj = JSON.parse(s || '{}') as Record<string, unknown>
    return typeof obj.activeTab === 'string' ? { activeTab: obj.activeTab } : {}
  } catch {
    return {}
  }
}

/** 进入项目后恢复到上次中断时的标签页（未确认方案时仍限制在「复现方案」） */
function applyResumeState(): void {
  const ctx = reproStore.context
  if (!ctx) return
  const state = parseResumeState(ctx.project.resume_state)
  if (state.activeTab && tabs.some((t) => t.key === state.activeTab)) {
    if (state.activeTab === 'plan' || isPlanConfirmed.value) {
      activeTab.value = state.activeTab
    } else {
      activeTab.value = 'plan'
    }
  }
}

function switchTab(key: string): void {
  if (key !== 'plan' && currentProjectId.value !== null && !isPlanConfirmed.value) {
    console.warn('[View] 复现方案未确认，禁止切换到:', key)
    tabWarning.value = '请先在「复现方案」页确认方案后，再进入下一阶段。'
    if (tabWarningTimer) clearTimeout(tabWarningTimer)
    tabWarningTimer = setTimeout(() => {
      tabWarning.value = ''
    }, 3000)
    return
  }
  activeTab.value = key
  persistActiveTab(key)
}

/** 确认方案并进入阶段与记录 */
function confirmPlanAndNext(): void {
  if (currentProjectId.value === null) return
  console.log('[View] 确认复现方案并进入阶段与记录, 项目ID:', currentProjectId.value)
  reproStore.confirmPlan(currentProjectId.value)
  activeTab.value = 'phase'
}

/** 删除项目（主进程会级联清理全部数据） */
async function deleteProject(id: number): Promise<void> {
  console.log('[View] 删除项目:', id)
  await reproStore.deleteProject(id)
  activeTab.value = 'plan'
}

/* ---------- 三面板拖拽调整宽度 ---------- */
const mainRef = ref<HTMLElement | null>(null)
const LEFT_MIN = 150
const LEFT_MAX = 320
const RIGHT_MIN = 280
const RIGHT_MAX = 520
const leftWidth = ref(200)
const rightWidth = ref(340)
const dragging = ref(false)

let onMove: ((ev: MouseEvent) => void) | null = null
let onUp: (() => void) | null = null

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/** 开始拖拽调整某侧面板宽度 */
function startResize(side: 'left' | 'right', e: MouseEvent): void {
  const main = mainRef.value
  if (!main) return
  e.preventDefault()
  const handle = e.currentTarget as HTMLElement
  const grip = handle.querySelector<HTMLElement>('.rh-grip')
  const handleRect = handle.getBoundingClientRect()
  // 记录按下时的宽度和鼠标 X，拖拽时只叠加增量，避免分隔条与鼠标错位
  const startLeft = leftWidth.value
  const startRight = rightWidth.value
  const startX = e.clientX
  // 抓握点定位到鼠标按下位置
  const moveGrip = (clientY: number): void => {
    if (!grip) return
    grip.style.top = `${clamp(clientY - handleRect.top, 16, handleRect.height - 16)}px`
  }
  moveGrip(e.clientY)
  handle.classList.add('dragging')
  dragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  let rafId = 0
  const flush = (): void => {
    rafId = 0
    if (side === 'left') {
      leftWidth.value = clamp(startLeft + (onMove! as any)._dx, LEFT_MIN, LEFT_MAX)
    } else {
      rightWidth.value = clamp(startRight - (onMove! as any)._dx, RIGHT_MIN, RIGHT_MAX)
    }
  }
  onMove = Object.assign(
    (ev: MouseEvent): void => {
      moveGrip(ev.clientY)
      ;(onMove! as any)._dx = ev.clientX - startX
      if (rafId) return
      rafId = requestAnimationFrame(flush)
    },
    { _dx: 0 }
  )
  onUp = (): void => {
    if (rafId) cancelAnimationFrame(rafId)
    flush()
    handle.classList.remove('dragging')
    dragging.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMove!)
    window.removeEventListener('mouseup', onUp!)
    onMove = null
    onUp = null
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 键盘方向键微调宽度（←/→ 移动分隔条，Shift 加速） */
function onHandleKeydown(side: 'left' | 'right', e: KeyboardEvent): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const step = e.shiftKey ? 24 : 8
  if (side === 'left') {
    leftWidth.value = clamp(leftWidth.value + (e.key === 'ArrowRight' ? step : -step), LEFT_MIN, LEFT_MAX)
  } else {
    rightWidth.value = clamp(rightWidth.value + (e.key === 'ArrowLeft' ? step : -step), RIGHT_MIN, RIGHT_MAX)
  }
}

/** 双击分隔条恢复默认宽度 */
function resetWidths(): void {
  leftWidth.value = 200
  rightWidth.value = 340
}

onBeforeUnmount(() => {
  if (onMove) window.removeEventListener('mousemove', onMove)
  if (onUp) window.removeEventListener('mouseup', onUp)
  stopEventListeners?.()
  stopImportProgress?.()
})

/** 主进程事件监听注销函数（v0.10 §10.4） */
let stopEventListeners: (() => void) | null = null
/** 文献导入进度事件注销函数 */
let stopImportProgress: (() => void) | null = null

onMounted(async () => {
  console.log('[View] ReproductionLab 挂载，开始加载项目列表')
  // 注册主进程事件监听：步骤/门禁/分叉/入库/共享等状态变更自动刷新（§10.4）
  stopEventListeners = reproStore.initEventListeners()
  // 文献导入/图表解析进度：驱动等待浮层的阶段动画（与实际解析阶段同步）
  stopImportProgress = api.onExperimentEvent('document-import:progress', (payload) => {
    importProgress.value = (payload ?? {}) as typeof importProgress.value
    console.log('[View] 文献导入进度:', importProgress.value?.stage, importProgress.value?.detail ?? '')
  })
  await reproStore.loadProjects()
  // 优先恢复到上次打开的项目（中断续做），否则默认第一个项目
  const lastId = loadLastProjectId()
  const target = reproStore.projects.find((p) => p.id === lastId) ?? reproStore.projects[0]
  if (target && !reproStore.currentProjectId) {
    console.log('[View] 恢复上次项目:', target.id, target.name)
    await handleSelect(target.id)
  }
  console.log('[View] ReproductionLab 项目加载完成，共', reproStore.projects.length, '个')
  // 入场动画（尊重 reduced-motion）
  const mm = gsap.matchMedia()
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.lab-topbar', { y: -12, autoAlpha: 0, duration: 0.4, ease: 'power2.out' })
    gsap.from('.tabs', { y: 8, autoAlpha: 0, duration: 0.4, ease: 'power2.out', delay: 0.1 })
  })
})

async function handleSelect(id: number): Promise<void> {
  console.log('[View] 切换项目:', id)
  await reproStore.selectProject(id)
  // 恢复到该项目上次中断时的标签页
  applyResumeState()
  console.log('[View] 项目切换完成:', id)
}

async function createProject(name: string): Promise<void> {
  console.log('[View] 创建项目:', name.slice(0, 50))
  const id = await reproStore.createProject(name)
  await reproStore.selectProject(id)
  activeTab.value = 'plan'
  console.log('[View] 项目创建完成:', id)
}

async function importDocs(): Promise<void> {
  console.log('[View] 导入文献开始')
  // 打开进度浮层：阶段动画随主进程 document-import:progress 事件同步切换
  showImportOverlay.value = true
  importProgress.value = { stage: 'parsing', detail: '准备导入文献…' }
  const results = await reproStore.importDocuments()
  if (!results.length) {
    console.warn('[View] 未导入任何文献，关闭浮层')
    showImportOverlay.value = false
    return
  }
  const ids = (results as Array<{ documentId: number }>).map((r) => r.documentId)
  console.log('[View] 文献导入完成, document_ids:', ids.join(','))
  if (!currentProjectId.value) {
    console.warn('[View] 未选中项目，无法解析文献')
    showImportOverlay.value = false
    return
  }
  // 确定性解析到当前项目（不依赖 agent 决策）；解析结果仅在「复现方案」页展示，不注入聊天框
  importProgress.value = { stage: 'planning', detail: '正在根据文献生成复现方案…' }
  try {
    await reproStore.parseDocumentsToProject(ids)
  } catch (err) {
    console.error('[View] 文献解析失败:', err)
  } finally {
    showImportOverlay.value = false
  }
}
</script>

<style scoped>
/* ---------- 三面板布局与分隔条 ---------- */
.main-cols {
  flex: 1;
  display: flex;
  align-items: stretch;
  min-height: 0;
  padding: 0 16px 16px;
}
.panel-left,
.panel-right {
  flex-shrink: 0;
  min-width: 0;
}
/* 拖拽期间临时关闭毛玻璃模糊与投影，避免 Electron 每帧重算合成层造成滞后 */
.page-resizing :deep(.lab-topbar),
.page-resizing :deep(.proj-sidebar),
.page-resizing :deep(.agent-panel) {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}
.resize-handle {
  position: relative;
  z-index: 5;
  flex-shrink: 0;
  width: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
  outline: none;
}
.resize-handle::before {
  content: '';
  width: 2px;
  height: 100%;
  border-radius: 3px;
  background: transparent;
  transition: background-color var(--transition-fast);
}
.resize-handle:hover::before,
.resize-handle.dragging::before {
  background: rgba(6, 182, 212, 0.45);
}
.resize-handle:focus-visible::before {
  background: rgba(6, 182, 212, 0.65);
}
.rh-grip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 30px;
  border-radius: 3px;
  background: var(--color-text-muted);
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: opacity var(--transition-fast);
  pointer-events: none;
}
.resize-handle:hover .rh-grip,
.resize-handle.dragging .rh-grip {
  opacity: 0.75;
}

.tb-act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12.5px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tb-act:hover {
  border-color: var(--color-primary-light);
}
.tabs { display: flex; gap: 4px; padding: 8px 4px 0; }
.tab-warning {
  margin: 4px 6px 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(249, 226, 175, 0.16);
  color: var(--color-warning);
  font-size: 12px;
}
/* 实验中断恢复横幅 */
.resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 4px 6px 0;
  padding: 10px 12px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 10px;
  background: rgba(56, 189, 248, 0.1);
}
.rb-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--color-text);
  line-height: 1.5;
  min-width: 0;
}
.rb-text b {
  flex-shrink: 0;
  color: var(--color-accent-ink);
}
.rb-btn {
  flex-shrink: 0;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.rb-btn:hover {
  opacity: 0.9;
}
.tab {
  padding: 7px 14px; border: 1px solid transparent; border-radius: 10px 10px 0 0;
  background: transparent; color: var(--color-text-muted); font-size: 13px;
  cursor: pointer; transition: all var(--transition-fast);
}
.tab:hover { color: var(--color-text); }
.tab.active {
  color: var(--color-text);
  background: var(--color-surface-alt);
  border-color: var(--color-border);
  border-bottom-color: transparent;
  font-weight: 600;
}
.tab-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 16px 16px;
  background: var(--color-surface);
  padding: 10px;
}
.tab-body > :not(.plan-confirm) {
  flex: 1;
  min-height: 0;
}
.plan-confirm {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-alt);
}
.plan-confirm-hint {
  font-size: 12.5px;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.plan-confirm-btn {
  flex-shrink: 0;
  padding: 9px 16px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.plan-confirm-btn:hover {
  opacity: 0.9;
}
.plan-confirm-btn.confirmed {
  background: linear-gradient(135deg, #10b981, #06b6d4);
}
</style>
