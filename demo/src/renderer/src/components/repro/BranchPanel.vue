<template>
  <section class="card">
    <div class="bp-head">
      <h3>并行实验分叉（{{ branches.length }}）</h3>
      <button type="button" class="bp-create-btn" :disabled="!currentPhases.length" @click="openCreate">
        + 创建并行实验
      </button>
    </div>

    <p class="bp-hint">树状图每个节点代表一条并行实验路径（可再分叉）；点击节点切换查看。创建并行实验后，新节点会出现在对应父节点之下。</p>

    <!-- 实验树状图（v0.8 树分叉 + 步骤/变体节点，数据持久化于项目 branches/steps，每项目一棵树） -->
    <ExperimentTree :ctx="ctx" :current-branch-id="currentBranchId" @switch="switchTo" @open-step="openStep" />

    <!-- 创建分叉表单 -->
    <form v-if="showCreate" class="bp-form" @submit.prevent="createBranch">
      <div class="bp-row">
        <label class="bp-label">分叉点阶段（该阶段起之后完全独立）</label>
        <select v-model="form.fork_phase_id" class="bp-input" required>
          <option :value="null" disabled>请选择分叉点阶段</option>
          <option v-for="p in currentPhases" :key="p.id" :value="p.id">
            {{ p.phase_order }}. {{ p.name }}
          </option>
        </select>
      </div>
      <div class="bp-row">
        <label class="bp-label">分支名</label>
        <input v-model="form.name" class="bp-input" type="text" placeholder="如：实验组A-分批加铜粉" required maxlength="60" />
      </div>
      <div class="bp-row">
        <label class="bp-label">分支说明（变量设定、目的）</label>
        <textarea v-model="form.description" class="bp-input" rows="2" placeholder="如：改变柠檬酸用量对比产率影响…" />
      </div>
      <div class="bp-actions">
        <span v-if="bpError" class="bp-error">{{ bpError }}</span>
        <button type="button" class="bp-cancel" @click="showCreate = false">取消</button>
        <button type="submit" class="bp-ok" :disabled="bpSubmitting">
          {{ bpSubmitting ? '创建中…' : '创建分叉' }}
        </button>
      </div>
    </form>

    <!-- 完成当前并行实验 -->
    <div v-if="currentBranchId !== null" class="bp-finish">
      <button
        type="button"
        class="bp-finish-btn"
        :disabled="finishing"
        @click="finishCurrent"
      >
        {{ finishing ? '整理中…' : '完成本次并行实验（压缩数据入库）' }}
      </button>
      <p class="bp-finish-hint">完成后后台自动整理该分支全部记录/事件/统计图并写入知识库，不阻塞界面操作。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ProjectContextUI } from '../../stores/repro'
import ExperimentTree from './ExperimentTree.vue'

const props = defineProps<{
  ctx: ProjectContextUI | null
  currentBranchId: number | null
}>()
const emit = defineEmits<{ switch: [branchId: number | null]; changed: [] }>()

const api = window.api

const branches = computed(() => props.ctx?.branches ?? [])

/** 当前分支的阶段（分叉点选择用） */
const currentPhases = computed(() => {
  const all = props.ctx?.phases ?? []
  return all
    .filter((p) => (p.branch_id ?? null) === props.currentBranchId)
    .sort((a, b) => Number(a.phase_order) - Number(b.phase_order))
})

/* ---------- 切换分支 ---------- */
function switchTo(branchId: number | null): void {
  if (props.currentBranchId === branchId) return
  emit('switch', branchId)
}

/** 打开步骤详情窗口（树中步骤/变体节点点击） */
function openStep(stepId: number): void {
  if (!props.ctx) return
  void api.window.openStepDetail(props.ctx.project.id, stepId)
}

/* ---------- 创建分叉 ---------- */
const showCreate = ref(false)
const form = reactive<{ fork_phase_id: number | null; name: string; description: string }>({
  fork_phase_id: null,
  name: '',
  description: ''
})
const bpError = ref('')
const bpSubmitting = ref(false)

function openCreate(): void {
  showCreate.value = true
  bpError.value = ''
}

async function createBranch(): Promise<void> {
  if (!props.ctx || form.fork_phase_id === null) {
    bpError.value = '请选择分叉点阶段。'
    return
  }
  if (!form.name.trim()) {
    bpError.value = '请填写分支名。'
    return
  }
  bpError.value = ''
  bpSubmitting.value = true
  try {
    await api.db.experiment.createBranch({
      project_id: props.ctx.project.id,
      parent_branch_id: props.currentBranchId,
      fork_phase_id: form.fork_phase_id,
      name: form.name.trim(),
      description: form.description.trim()
    })
    showCreate.value = false
    form.fork_phase_id = null
    form.name = ''
    form.description = ''
    emit('changed')
  } catch (err) {
    console.error('[Component] BranchPanel 创建分叉失败:', err)
    bpError.value = `创建失败：${err instanceof Error ? err.message : String(err)}`
  } finally {
    bpSubmitting.value = false
  }
}

/* ---------- 完成当前并行实验（标记完成 + 后台压缩入库 §7.11） ---------- */
const finishing = ref(false)

async function finishCurrent(): Promise<void> {
  if (!props.ctx || props.currentBranchId === null) return
  finishing.value = true
  try {
    await api.db.experiment.finishBranch(props.currentBranchId, props.ctx.project.id)
    // 完成主线 → 若主线还有分支则自动切回主线展示
    emit('changed')
  } catch (err) {
    console.error('[Component] BranchPanel 完成并行实验失败:', err)
  } finally {
    finishing.value = false
  }
}
</script>

<style scoped>
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.bp-head { display: flex; align-items: center; justify-content: space-between; }
.bp-head h3 { margin: 0; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.bp-create-btn {
  padding: 6px 12px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast);
}
.bp-create-btn:hover:not(:disabled) { opacity: 0.9; }
.bp-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bp-hint { margin: 6px 0 0; font-size: 11.5px; color: var(--color-text-muted); }
.bp-form { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; padding: 12px; border: 1px dashed var(--color-primary-light); border-radius: 12px; }
.bp-row { display: flex; flex-direction: column; gap: 4px; }
.bp-label { font-size: 12px; color: var(--color-text-muted); }
.bp-input {
  padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px;
  background: var(--color-surface); color: var(--color-text); font-size: 12.5px; outline: none;
}
.bp-input:focus { border-color: var(--color-primary-light); }
.bp-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.bp-error { margin-right: auto; font-size: 12px; color: var(--color-danger); }
.bp-cancel {
  padding: 6px 12px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; color: var(--color-text-muted); font-size: 12px; cursor: pointer;
}
.bp-ok {
  padding: 6px 14px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
}
.bp-ok:disabled { opacity: 0.5; cursor: not-allowed; }
.bp-finish { margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; background: rgba(56, 189, 248, 0.08); }
.bp-finish-btn {
  width: 100%; padding: 8px 12px; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #10b981, #06b6d4); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast);
}
.bp-finish-btn:hover:not(:disabled) { opacity: 0.9; }
.bp-finish-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bp-finish-hint { margin: 6px 0 0; font-size: 11.5px; color: var(--color-text-muted); }
</style>
