<template>
  <div class="panel">
    <div v-if="!ctx" class="panel-empty"><p>选择左侧项目查看阶段与记录</p></div>
    <div v-else class="panel-body">
      <!-- 分支管理（v0.8 树分叉） -->
      <BranchPanel
        :ctx="ctx"
        :current-branch-id="currentBranchId"
        @switch="switchBranch"
        @changed="refresh"
      />

      <!-- 步骤执行（v0.7 DAG + v3 步骤 CRUD/独立窗口详情） -->
      <section class="card">
        <h3>步骤执行（{{ branchSteps.length }}）</h3>
        <p class="card-hint">步骤可并行；点击"打开详情"打开独立步骤详情窗口，在该窗口录入步骤的变量/事件/记录/数据/图表与预测。</p>
        <div v-if="branchSteps.length" class="steps">
          <div v-for="s in branchSteps" :key="s.id" class="step" :class="s.status">
            <span class="step-no">{{ s.step_no }}</span>
            <div class="step-main">
              <div class="step-head">
                <b>{{ s.title || `步骤 ${s.step_no}` }}</b>
                <span class="step-status" :class="s.status">{{ stepLabel(s.status) }}</span>
              </div>
              <div class="step-desc"><MarkdownRenderer :content="s.description" /></div>
              <p v-if="s.depends_on.length" class="step-deps">
                前置：{{ s.depends_on.map((d) => stepTitle(d) || `步骤 ${d}`).join(' → ') }}
              </p>
              <p v-if="s.duration" class="step-dur">时长：{{ s.duration }}</p>
            </div>
            <div class="step-actions">
              <button
                v-if="s.status === 'ready'"
                type="button"
                class="sa-btn start"
                @click="setStep(s, 'in_progress')"
              >开始</button>
              <template v-if="s.status === 'in_progress'">
                <button type="button" class="sa-btn ok" @click="setStep(s, 'completed')">完成</button>
                <button type="button" class="sa-btn skip" @click="setStep(s, 'skipped')">跳过</button>
              </template>
              <button
                v-if="s.status === 'pending'"
                type="button"
                class="sa-btn skip"
                @click="setStep(s, 'skipped')"
              >跳过</button>
              <button type="button" class="sa-btn detail" @click="openDetail(s)">打开详情</button>
              <div class="step-more">
                <button type="button" class="sa-mini" title="编辑步骤信息（在详情窗口内）" @click="openDetail(s)">✎</button>
                <button type="button" class="sa-mini danger" title="删除步骤" @click="deleteStep(s)">🗑</button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="muted">暂无步骤，请先在「复现方案」页解析文献生成方案。</p>
        <button type="button" class="add-step" @click="addStep">＋ 新增步骤</button>
      </section>

      <!-- 阶段时间线（v0.7 门禁 + 小结） -->
      <section class="card">
        <h3>实验阶段（{{ phases.length }}）</h3>
        <div class="phases">
          <div
            v-for="(p, i) in phases"
            :key="p.id"
            class="phase"
            :class="[p.status, { current: i === currentPhaseIndex }]"
          >
            <span class="ph-order">{{ p.phase_order }}</span>
            <div class="ph-info">
              <b>{{ p.name }}</b>
              <span class="ph-status">{{ phaseLabel(p.status) }} · 门禁:{{ gateLabel(p.gate_status) }}</span>
            </div>
            <p v-if="p.expected" class="ph-expected">预期：{{ p.expected }}</p>
            <p v-if="phaseMetrics(p).length" class="ph-metrics">
              <b>量化指标</b>：{{ phaseMetrics(p).map((m) => `${m.name} ${m.target}${m.range ? `（${m.range}）` : ''}${m.unit}`).join('；') }}
            </p>

            <div v-if="p.summary" class="ph-summary">
              <MarkdownRenderer :content="p.summary" class="ps-content" />
            </div>

            <div class="ph-actions">
              <button
                v-if="i === currentPhaseIndex && canSummarize(p)"
                type="button"
                class="ph-act-btn gen"
                :disabled="busyIds.has(p.id)"
                @click="generateSummary(p)"
              >
                {{ busyIds.has(p.id) ? '生成中…' : '生成阶段小结' }}
              </button>
              <button
                v-if="p.status === 'pending_review'"
                type="button"
                class="ph-act-btn pass"
                @click="confirmGate(p, 'pass')"
              >确认放行</button>
              <button
                v-if="p.status === 'pending_review'"
                type="button"
                class="ph-act-btn back"
                @click="confirmGate(p, 'back')"
              >返回修改</button>
              <span v-if="p.gate_status === 'locked'" class="ph-locked">等待上一阶段放行</span>
            </div>
          </div>
        </div>
        <p v-if="!phases.length" class="muted">暂无阶段，请先在「复现方案」页解析文献生成阶段。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ProjectContextUI, PhaseUI, StepUI } from '../../stores/repro'
import { reproStore } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'
import BranchPanel from './BranchPanel.vue'

const props = defineProps<{ ctx: ProjectContextUI | null }>()
const emit = defineEmits<{ saved: [] }>()

const api = window.api

onMounted(() => {
  console.log('[Component] PhasePanel 挂载')
})

/** 当前工作分支（null = 主线） */
const currentBranchId = ref<number | null>(null)

/* ---------- 分支数据 ---------- */
const phases = computed(() => {
  const all = props.ctx?.phases ?? []
  return all
    .filter((p) => (p.branch_id ?? null) === currentBranchId.value)
    .sort((a, b) => Number(a.phase_order) - Number(b.phase_order))
})

const branchSteps = computed(() => {
  const all = props.ctx?.steps ?? []
  return all
    .filter((s) => (s.branch_id ?? null) === currentBranchId.value)
    .sort((a, b) => Number(a.step_no) - Number(b.step_no))
})

function switchBranch(branchId: number | null): void {
  currentBranchId.value = branchId
  void refresh()
}

/* ---------- 步骤状态机 ---------- */
const busyIds = ref<Set<number>>(new Set())

function stepLabel(s: string): string {
  const map: Record<string, string> = {
    pending: '待开始',
    ready: '可开始',
    in_progress: '进行中',
    completed: '已完成',
    skipped: '已跳过'
  }
  return map[s] ?? s
}

function stepTitle(id: number): string {
  return branchSteps.value.find((s) => s.id === id)?.title ?? ''
}

async function setStep(s: StepUI, status: string): Promise<void> {
  busyIds.value.add(s.id)
  try {
    await api.db.experiment.updateStepStatus(s.id, status)
    void refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 步骤状态更新失败:', err)
  } finally {
    busyIds.value.delete(s.id)
  }
}

/* ---------- 步骤详情窗口（v3 问题③：独立 Electron 窗口） ---------- */
function openDetail(s: StepUI): void {
  if (!props.ctx) return
  void api.window.openStepDetail(props.ctx.project.id, s.id)
}

/* ---------- 步骤 CRUD（v3 问题④） ---------- */
async function addStep(): Promise<void> {
  if (!props.ctx) return
  const title = window.prompt('新步骤标题（可空）') ?? ''
  const desc = window.prompt('步骤描述') ?? ''
  if (!desc.trim()) return
  try {
    await api.db.experiment.addStep(props.ctx.project.id, {
      step_no: branchSteps.value.length + 1,
      title: title.trim(),
      description: desc.trim(),
      branch_id: currentBranchId.value
    })
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 新增步骤失败:', err)
    window.alert(`新增步骤失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

async function deleteStep(s: StepUI): Promise<void> {
  if (!window.confirm(`确认删除步骤「${s.title || s.step_no}」？该步骤的变量/事件/记录/数据/图表归属将一并清理。`)) return
  try {
    await api.db.experiment.deleteStep(s.id)
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 删除步骤失败:', err)
    window.alert(`删除步骤失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

/* ---------- 阶段门禁与小结 ---------- */
const currentPhaseIndex = computed(() => phases.value.findIndex((p) => p.status !== 'completed' && p.gate_status !== 'passed'))

function phaseLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待开始',
    in_progress: '进行中',
    pending_review: '待审阅',
    completed: '已完成'
  }
  return map[status] ?? status
}

function gateLabel(g: string): string {
  const map: Record<string, string> = { locked: '锁定', open: '开放', passed: '已放行' }
  return map[g] ?? g
}

function phaseMetrics(p: { metrics_json?: string }): Array<{ name?: string; target?: string; range?: string; unit?: string }> {
  try {
    const arr = JSON.parse(p.metrics_json || '[]') as Array<{ name?: string; target?: string; range?: string; unit?: string }>
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function canSummarize(p: PhaseUI): boolean {
  return p.gate_status === 'open' && p.status === 'in_progress'
}

async function generateSummary(p: PhaseUI): Promise<void> {
  if (!props.ctx) return
  busyIds.value.add(p.id)
  try {
    await api.db.experiment.summaryAi(props.ctx.project.id, p.id)
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 生成小结失败:', err)
  } finally {
    busyIds.value.delete(p.id)
  }
}

async function confirmGate(p: PhaseUI, decision: 'pass' | 'back'): Promise<void> {
  try {
    if (decision === 'pass') {
      await api.db.experiment.confirmGate(p.id, 'pass', 'passed', 'completed')
    } else {
      await api.db.experiment.confirmGate(p.id, 'back', 'open', 'in_progress')
    }
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 门禁操作失败:', err)
  }
}

async function refresh(): Promise<void> {
  if (props.ctx) {
    await reproStore.refreshContext()
  }
  emit('saved')
}

/** 分支列表变化时确保 currentBranchId 有效 */
watch(
  () => props.ctx?.branches.map((b) => b.id).join(','),
  () => {
    const ids = props.ctx?.branches.map((b) => b.id) ?? []
    if (currentBranchId.value !== null && !ids.includes(currentBranchId.value)) {
      currentBranchId.value = null
    }
  }
)
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 10px; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.card-hint { margin: -6px 0 10px; font-size: 11.5px; color: var(--color-text-muted); }

/* ---------- 步骤 ---------- */
.steps { display: flex; flex-direction: column; gap: 8px; }
.step { display: flex; gap: 10px; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; }
.step.completed { border-color: rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.05); }
.step.in_progress { border-color: var(--color-primary-light); background: rgba(99, 102, 241, 0.08); }
.step.skipped { opacity: 0.6; }
.step-no { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 12px; flex-shrink: 0; }
.step-main { flex: 1; min-width: 0; }
.step-head { display: flex; align-items: center; gap: 8px; }
.step-status { padding: 2px 8px; border-radius: 6px; font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); }
.step-status.in_progress { color: var(--color-primary); background: rgba(99, 102, 241, 0.12); }
.step-status.completed { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.step-desc { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text); line-height: 1.6; }
.step-deps { margin: 4px 0 0; font-size: 11.5px; color: var(--color-accent-ink); }
.step-dur { margin: 4px 0 0; font-size: 11.5px; color: var(--color-text-muted); }
.step-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0; }
.step-more { display: flex; gap: 6px; }
.sa-btn { padding: 5px 12px; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; transition: opacity var(--transition-fast); }
.sa-btn:hover { opacity: 0.9; }
.sa-btn.start { background: linear-gradient(135deg, #4f46e5, #06b6d4); }
.sa-btn.ok { background: linear-gradient(135deg, #10b981, #06b6d4); }
.sa-btn.skip { background: var(--color-surface); color: var(--color-text-muted); border: 1px solid var(--color-border); }
.sa-btn.detail { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.sa-mini { width: 24px; height: 24px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-accent-ink); font-size: 12px; cursor: pointer; }
.sa-mini.danger { color: var(--color-danger); }
.add-step { margin-top: 10px; padding: 6px 14px; border: 1px dashed var(--color-primary-light); border-radius: 8px; background: transparent; color: var(--color-primary); font-size: 12px; cursor: pointer; }

/* ---------- 阶段 ---------- */
.phases { display: flex; flex-direction: column; gap: 8px; }
.phase { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; }
.phase.completed { border-color: rgba(34, 197, 94, 0.4); }
.phase.current { border-color: var(--color-primary-light); background: rgba(99, 102, 241, 0.08); }
.phase.pending_review { border-color: rgba(249, 115, 22, 0.45); background: rgba(249, 115, 22, 0.06); }
.ph-order { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 12px; flex-shrink: 0; }
.ph-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ph-status { font-size: 11px; color: var(--color-text-muted); }
.ph-expected { margin: 4px 0 0 36px; font-size: 12px; color: var(--color-text-muted); }
.ph-metrics { margin: 4px 0 0 36px; font-size: 12px; color: var(--color-success); }
.ph-summary { flex-basis: 100%; margin: 4px 0 0 36px; padding: 10px; border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 10px; background: var(--color-surface); }
.ps-content { font-size: 12.5px; }
.ph-actions { flex-basis: 100%; margin: 6px 0 0 36px; display: flex; align-items: center; gap: 8px; }
.ph-act-btn { padding: 6px 14px; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; transition: opacity var(--transition-fast); }
.ph-act-btn:hover:not(:disabled) { opacity: 0.9; }
.ph-act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ph-act-btn.gen { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.ph-act-btn.pass { background: linear-gradient(135deg, #10b981, #06b6d4); }
.ph-act-btn.back { background: var(--color-surface); color: var(--color-warning); border: 1px solid rgba(249, 115, 22, 0.4); }
.ph-locked { font-size: 12px; color: var(--color-text-muted); }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
