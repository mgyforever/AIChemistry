<template>
  <div class="sdp">
    <div v-if="!ctx" class="sdp-empty">
      <p>正在加载项目上下文…</p>
    </div>
    <template v-else>
      <div class="sdp-top">
        <b class="sdp-project">{{ ctx.project.name }}</b>
        <label class="sdp-branch">
          分支
          <select v-model="currentBranchId" @change="switchBranch">
            <option :value="null">主线</option>
            <option v-for="b in ctx.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
      </div>
      <StepDetailWindow
        ref="detail"
        :ctx="ctx"
        :current-branch-id="currentBranchId"
        mode="window"
        :on-request-refresh="reloadContext"
        @changed="reloadContext"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ProjectContextUI } from '../stores/repro'
import StepDetailWindow from '../components/repro/StepDetailWindow.vue'

/**
 * 步骤详情独立窗口页面（v3 问题③）
 * - 挂载后从主进程领取初始 { projectId, stepId }（window:step-detail-claim）
 * - 之后点击主窗口其它步骤 → 主进程推送 step-detail:add-tab → 本窗口新增标签（复用同一窗口）
 * - 数据变更由主进程 experiment:* 事件广播刷新
 */

const api = window.api

const projectId = ref<number | null>(null)
const ctx = ref<ProjectContextUI | null>(null)
const currentBranchId = ref<number | null>(null)
const detail = ref<InstanceType<typeof StepDetailWindow> | null>(null)

async function loadContext(): Promise<void> {
  if (projectId.value === null) return
  try {
    ctx.value = (await api.db.project.context(projectId.value)) as ProjectContextUI
  } catch (err) {
    console.error('[StepDetailPage] 加载项目上下文失败:', err)
  }
}

function reloadContext(): void {
  void loadContext()
}

function openStep(stepId: number): void {
  const step = ctx.value?.steps.find((s) => s.id === stepId)
  if (step) detail.value?.openStep(step)
}

function switchBranch(): void {
  // 分支切换后重载上下文（步骤/记录按分支过滤在 StepDetailWindow 内部完成）
  void loadContext()
}

/** 处理主进程推送的"新增步骤标签"事件（窗口已存在时） */
function handleAddTab(payload: unknown): void {
  const p = (payload ?? {}) as { projectId?: number; stepId?: number }
  if (typeof p.stepId !== 'number') return
  if (typeof p.projectId === 'number' && p.projectId !== projectId.value) {
    projectId.value = p.projectId
    currentBranchId.value = null
    void loadContext().then(() => openStep(p.stepId as number))
    return
  }
  openStep(p.stepId)
}

onMounted(async () => {
  // 领取初始步骤数据（新建窗口时由主进程记录）
  const init = await api.window.claimStepDetailInit()
  if (init) {
    projectId.value = init.projectId
    await loadContext()
    openStep(init.stepId)
  }
  // 窗口已存在时新增标签
  api.window.onStepDetailEvent('step-detail:add-tab', handleAddTab)
  // 主进程状态变更广播 → 刷新上下文（记录/事件/变量/分叉/预测等）
  const channels = [
    'experiment:state-changed',
    'experiment:index-done',
    'experiment:share-request-received',
    'experiment:share-resolved'
  ]
  channels.forEach((ch) => {
    api.onExperimentEvent(ch, () => {
      if (projectId.value !== null) void loadContext()
    })
  })
})
</script>

<style scoped>
.sdp { height: 100vh; display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box; background: var(--color-surface); overflow-y: auto; }
.sdp-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.sdp-top { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); }
.sdp-project { font-size: 13px; color: var(--color-text); }
.sdp-branch { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); }
.sdp-branch select {
  padding: 4px 8px; border: 1px solid var(--color-border); border-radius: 7px;
  background: var(--color-surface); color: var(--color-text); font-size: 12px; outline: none;
}
</style>
