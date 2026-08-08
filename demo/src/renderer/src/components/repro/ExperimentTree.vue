<template>
  <div class="et-wrap">
    <div ref="chartRef" class="et-chart" />
    <div class="et-legend">
      <span class="et-leg"><i class="et-dot" style="background: #818cf8" />项目根</span>
      <span class="et-leg"><i class="et-dot" style="background: #38bdf8" />当前分支</span>
      <span class="et-leg"><i class="et-dot" style="background: #a78bfa" />并行实验</span>
      <span class="et-leg"><i class="et-sq" style="background: #34d399" />步骤·已完成</span>
      <span class="et-leg"><i class="et-sq" style="background: #fbbf24" />步骤·进行中</span>
      <span class="et-leg"><i class="et-sq" style="background: #38bdf8" />步骤·可开始</span>
      <span class="et-leg"><i class="et-sq" style="background: #64748b" />步骤·待开始</span>
      <span class="et-leg"><i class="et-dia" style="background: #f472b6" />步骤变体</span>
      <span class="et-leg hint">Ctrl+左键点击节点：切换分支 / 打开步骤详情</span>
    </div>
    <div v-if="selected" class="et-selected">
      <b :style="{ color: activeColor }">{{ selected.name }}</b>
      <span class="et-sel-status" :class="selected.index_status">{{ selected.index_status === 'indexed' ? '已入库' : '待整理' }}</span>
      <span v-if="selected.parent_branch_id !== null" class="et-sel-sub">子分叉</span>
      <span v-if="selected.description" class="et-sel-desc">{{ selected.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ProjectContextUI, StepUI } from '../../stores/repro'
import { themeStore } from '../../stores/theme'

/**
 * 实验树状图（并行实验 + 步骤可视化）
 * 层级：项目名（根）→ 主线流程 与 顶层并行实验同级 → 各路径内步骤 → 步骤级并行变体（变体树）
 * - 数据源：项目上下文 branches / steps / stepExperiments（DB 持久化），每项目仅一棵树
 * - 交互：Ctrl+左键点击分支/主线节点切换分支；Ctrl+左键点击步骤/变体节点打开步骤详情窗口
 * - 创建并行实验后由父组件刷新 ctx，本组件 watch 重建树，新节点出现在对应父节点之下
 * - 注意：ECharts canvas 不支持 CSS 变量，节点颜色一律用按主题解析的十六进制色值
 */
const props = defineProps<{
  ctx: ProjectContextUI | null
  currentBranchId: number | null
}>()
const emit = defineEmits<{ switch: [branchId: number | null]; openStep: [stepId: number] }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
/** 容器尺寸观察：面板拖拽改变宽度时自动 resize 图表 */
let ro: ResizeObserver | null = null

const isLight = computed(() => themeStore.mode === 'light')
const textColor = computed(() => (isLight.value ? '#0f172a' : '#cdd6f4'))
const lineColor = computed(() => (isLight.value ? '#cbd5e1' : '#45475a'))
const activeColor = computed(() => (isLight.value ? '#0e7490' : '#22d3ee'))

/** 节点配色（canvas 用十六进制；明暗主题分离，层级与状态用色更克制） */
const palette = computed(() =>
  isLight.value
    ? {
        root: '#6366f1', // 项目根
        main: '#0e7490', // 主线流程
        current: '#0284c7', // 当前分支高亮
        branchPending: '#7c3aed', // 并行实验·待整理
        branchDone: '#059669', // 并行实验·已入库
        stepIdle: '#64748b', // 步骤·待开始
        stepReady: '#0284c7', // 步骤·可开始
        stepProgress: '#d97706', // 步骤·进行中（琥珀提醒）
        stepDone: '#059669', // 步骤·已完成
        stepSkipped: '#94a3b8', // 步骤·已跳过
        variant: '#db2777', // 步骤变体·待整理
        variantDone: '#059669', // 步骤变体·已入库
        line: '#cbd5e1',
        ring: '#ffffff',
        glow: 'rgba(2,132,199,0.45)'
      }
    : {
        root: '#818cf8',
        main: '#22d3ee',
        current: '#38bdf8',
        branchPending: '#a78bfa',
        branchDone: '#34d399',
        stepIdle: '#64748b',
        stepReady: '#38bdf8',
        stepProgress: '#fbbf24',
        stepDone: '#34d399',
        stepSkipped: '#475569',
        variant: '#f472b6',
        variantDone: '#34d399',
        line: '#45475a',
        ring: '#e2e8f0',
        glow: 'rgba(56,189,248,0.55)'
      }
)

/* ---------- 树数据（每项目一棵，根=项目名） ---------- */
type NodeKind = 'project' | 'main' | 'branch' | 'step' | 'variant'

interface TreeNode {
  kind: NodeKind
  /** 树内展示名（已截断） */
  name: string
  /** 完整名（tooltip 用） */
  full: string
  branchId: number | null
  stepId?: number
  variantId?: number
  status?: string
  indexStatus?: string
  symbol: string
  symbolSize: number
  /** 节点填充样式（canvas 必须用具体色值，烘焙进数据节点；当前分支带描边光晕） */
  itemStyle: {
    color: string
    borderColor: string
    borderWidth: number
    shadowBlur: number
    shadowColor: string
  }
  /** 节点标签样式（同样烘焙进数据节点） */
  label: { color: string; fontWeight: number }
  children: TreeNode[]
}

function stepLabel(s: StepUI): string {
  const map: Record<string, string> = {
    pending: '待开始',
    ready: '可开始',
    in_progress: '进行中',
    completed: '已完成',
    skipped: '已跳过'
  }
  return map[s.status] ?? s.status
}

function stepColor(s: StepUI): string {
  if (s.status === 'completed') return palette.value.stepDone
  if (s.status === 'in_progress') return palette.value.stepProgress
  if (s.status === 'ready') return palette.value.stepReady
  if (s.status === 'skipped') return palette.value.stepSkipped
  return palette.value.stepIdle
}

/** 节点标签样式：当前分支高亮，其余常规 */
function nodeLabel(branchId: number | null, isProject = false): { color: string; fontWeight: number } {
  if (!isProject && branchId === props.currentBranchId) {
    return { color: palette.value.current, fontWeight: 700 }
  }
  return { color: textColor.value, fontWeight: 400 }
}

/** 节点填充样式：当前分支加白色描边 + 光晕，其余仅填色 */
function nodeItemStyle(color: string, isCurrent: boolean): { color: string; borderColor: string; borderWidth: number; shadowBlur: number; shadowColor: string } {
  if (!isCurrent) return { color, borderColor: 'transparent', borderWidth: 0, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)' }
  return { color, borderColor: palette.value.ring, borderWidth: 2, shadowBlur: 10, shadowColor: palette.value.glow }
}

/** 步骤级并行变体树（按 parent_experiment_id 嵌套） */
function buildVariantTree(stepId: number): TreeNode[] {
  const variants = (props.ctx?.stepExperiments ?? []).filter((v) => v.step_id === stepId)
  if (!variants.length) return []
  const byParent = new Map<number | null, TreeNode[]>()
  for (const v of variants) {
    const key = v.parent_experiment_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push({
      kind: 'variant',
      name: (v.name || '变体').slice(0, 14),
      full: v.name || '变体',
      branchId: null,
      stepId,
      variantId: v.id,
      status: v.status,
      symbol: 'diamond',
      symbolSize: 6,
      itemStyle: nodeItemStyle(v.status === 'indexed' ? palette.value.variantDone : palette.value.variant, false),
      label: nodeLabel(null),
      children: []
    })
  }
  for (const nodes of byParent.values()) {
    for (const n of nodes) {
      n.children = byParent.get(n.variantId ?? -1) ?? []
    }
  }
  return byParent.get(null) ?? []
}

function buildStepNode(s: StepUI): TreeNode {
  return {
    kind: 'step',
    name: `步骤 ${s.step_no}${s.title ? ` ${s.title.slice(0, 12)}` : ''}`,
    full: `步骤 ${s.step_no}. ${s.title || '（无标题）'}`,
    branchId: s.branch_id ?? null,
    stepId: s.id,
    status: s.status,
    symbol: 'rect',
    symbolSize: 7,
    itemStyle: nodeItemStyle(stepColor(s), false),
    label: nodeLabel(null),
    children: buildVariantTree(s.id)
  }
}

/** 单个并行实验节点：内含该分支的步骤 + 子分叉 */
function buildBranchNode(branchId: number): TreeNode {
  const branch = (props.ctx?.branches ?? []).find((b) => b.id === branchId)
  const steps = (props.ctx?.steps ?? [])
    .filter((s) => (s.branch_id ?? null) === branchId)
    .sort((a, b) => Number(a.step_no) - Number(b.step_no))
  const childBranches = (props.ctx?.branches ?? [])
    .filter((b) => (b.parent_branch_id ?? null) === branchId)
    .map((b) => buildBranchNode(b.id))
  const isCurrent = branchId === props.currentBranchId
  const color = isCurrent
    ? palette.value.current
    : branch?.index_status === 'indexed'
      ? palette.value.branchDone
      : palette.value.branchPending
  return {
    kind: 'branch',
    name: (branch?.name ?? '并行实验').slice(0, 14),
    full: branch?.name ?? '并行实验',
    branchId,
    indexStatus: branch?.index_status,
    symbol: 'circle',
    symbolSize: isCurrent ? 13 : 9,
    itemStyle: nodeItemStyle(color, isCurrent),
    label: nodeLabel(branchId),
    children: [...steps.map(buildStepNode), ...childBranches]
  }
}

/** 整棵树：项目名（根）→ 主线流程 与 顶层分叉同级 */
function buildTree(): TreeNode {
  const mainSteps = (props.ctx?.steps ?? [])
    .filter((s) => (s.branch_id ?? null) === null)
    .sort((a, b) => Number(a.step_no) - Number(b.step_no))
  const topBranches = (props.ctx?.branches ?? [])
    .filter((b) => (b.parent_branch_id ?? null) === null)
    .map((b) => buildBranchNode(b.id))
  const name = props.ctx?.project.name ?? '实验项目'
  const mainIsCurrent = props.currentBranchId === null
  const mainColor = mainIsCurrent ? palette.value.current : palette.value.main
  return {
    kind: 'project',
    name: name.slice(0, 14),
    full: name,
    branchId: null,
    symbol: 'circle',
    symbolSize: 14,
    itemStyle: nodeItemStyle(palette.value.root, false),
    label: { color: textColor.value, fontWeight: 700 },
    children: [
      {
        kind: 'main',
        name: '主线流程',
        full: '主线流程（主实验路径）',
        branchId: null,
        symbol: 'circle',
        symbolSize: 10,
        itemStyle: nodeItemStyle(mainColor, mainIsCurrent),
        label: nodeLabel(null),
        children: mainSteps.map(buildStepNode)
      },
      ...topBranches
    ]
  }
}

/** 当前选中的分支信息（null = 主线） */
const selected = computed(() => {
  const branches = props.ctx?.branches ?? []
  if (props.currentBranchId === null) return null
  return branches.find((b) => b.id === props.currentBranchId) ?? null
})

function statusText(d: TreeNode): string {
  if (d.kind === 'project') return '项目'
  if (d.kind === 'step') {
    const s = (props.ctx?.steps ?? []).find((x) => x.id === d.stepId)
    return s ? stepLabel(s) : ''
  }
  if (d.kind === 'variant') return d.status === 'indexed' ? '已入库' : '待整理'
  if (d.kind === 'main') return '主线流程'
  return d.indexStatus === 'indexed' ? '已入库' : '待整理'
}

function descOf(d: TreeNode): string {
  if (d.kind === 'project') return props.ctx?.project.description || ''
  if (d.kind === 'main') return '主线流程（主实验路径）'
  if (d.kind === 'branch') return (props.ctx?.branches ?? []).find((b) => b.id === d.branchId)?.description || ''
  if (d.kind === 'step') return (props.ctx?.steps ?? []).find((s) => s.id === d.stepId)?.description || ''
  if (d.kind === 'variant') return (props.ctx?.stepExperiments ?? []).find((v) => v.id === d.variantId)?.description || ''
  return ''
}

/** 从 ECharts 回调参数中取节点数据 */
function dOf(params: unknown): TreeNode {
  return (params as { data?: TreeNode })?.data as TreeNode
}

function buildOption(): Record<string, unknown> {
  const root = buildTree()
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: isLight.value ? 'rgba(255,255,255,0.96)' : 'rgba(17,17,27,0.94)',
      borderColor: lineColor.value,
      textStyle: { color: textColor.value, fontSize: 12 },
      formatter: (params: unknown) => {
        const d = dOf(params)
        if (!d) return ''
        const status = statusText(d)
        const desc = descOf(d)
        const action =
          d.kind === 'step' || d.kind === 'variant'
            ? '（Ctrl+左键 打开步骤详情）'
            : d.kind === 'main' || d.kind === 'branch'
              ? '（Ctrl+左键 切换）'
              : ''
        return `<b>${d.full}</b>${desc ? `<br/>${desc}` : ''}${status ? `<br/>状态：${status}` : ''}${action}`
      }
    },
    series: [
      {
        type: 'tree',
        data: [root],
        orient: 'LR',
        left: 6,
        right: 110,
        top: 8,
        bottom: 8,
        initialTreeDepth: -1,
        expandAndCollapse: true,
        // 节点颜色/标签已烘焙进各数据节点的 itemStyle/label（canvas 不支持函数回调时按节点生效）
        label: { position: 'right', distance: 7, fontSize: 11.5, color: textColor.value },
        lineStyle: { color: palette.value.line, width: 1.3, curveness: 0.5 },
        animationDuration: 500,
        animationDurationUpdate: 700,
        emphasis: {
          focus: 'ancestor',
          lineStyle: { width: 2.2, color: palette.value.current }
        },
        leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } }
      }
    ]
  }
}

function render(): void {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

function resize(): void {
  chart?.resize()
}

function onChartClick(params: unknown): void {
  // 仅 Ctrl+左键 触发节点操作（普通点击不响应，避免误触）
  const ev = (params as { event?: { ctrlKey?: boolean; event?: { ctrlKey?: boolean } } })?.event
  const ctrl = Boolean(ev?.ctrlKey ?? ev?.event?.ctrlKey)
  if (!ctrl) return
  const d = (params as { data?: TreeNode })?.data
  if (!d) return
  if (d.kind === 'step' || d.kind === 'variant') {
    if (d.stepId !== undefined) emit('openStep', d.stepId)
    return
  }
  if (d.kind === 'project') return // 项目根节点仅展示，不可切换
  if (d.branchId === props.currentBranchId) return
  emit('switch', d.branchId)
}

onMounted(() => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.on('click', onChartClick)
  render()
  window.addEventListener('resize', resize)
  // 面板/列宽变化（拖拽分隔条）时同步图表尺寸
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => chart?.resize())
    ro.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', resize)
  chart?.off('click', onChartClick)
  chart?.dispose()
  chart = null
})

watch(
  () => [props.ctx?.branches, props.ctx?.steps, props.ctx?.stepExperiments, props.currentBranchId, themeStore.mode],
  () => render(),
  { deep: true }
)
</script>

<style scoped>
.et-wrap {
  margin-top: 10px;
}
.et-chart {
  width: 100%;
  height: 300px;
}
.et-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.et-leg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.et-leg.hint {
  margin-left: auto;
  color: var(--color-text-muted);
  opacity: 0.8;
}
.et-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.et-sq {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.et-dia {
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
}
.et-selected {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  font-size: 12px;
}
.et-selected b {
  color: var(--color-text);
}
.et-sel-status {
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
}
.et-sel-status.indexed {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.12);
}
.et-sel-sub {
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-accent-ink);
  background: rgba(56, 189, 248, 0.12);
}
.et-sel-desc {
  width: 100%;
  color: var(--color-text-muted);
  line-height: 1.6;
}
</style>
