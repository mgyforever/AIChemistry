<template>
  <div class="panel">
    <div v-if="!ctx" class="panel-empty"><p>选择左侧项目查看阶段与记录</p></div>
    <div v-else class="panel-body">
      <!-- 阶段进度 + 确认按钮 -->
      <section class="card">
        <h3>实验阶段</h3>
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
              <span class="ph-status">{{ phaseLabel(p.status) }}</span>
            </div>
            <p v-if="p.expected" class="ph-expected">预期：{{ p.expected }}</p>
            <p v-if="phaseMetrics(p).length" class="ph-metrics">
              <b>量化指标</b>：{{ phaseMetrics(p).map((m) => `${m.name} ${m.target}${m.range ? `（${m.range}）` : ''}${m.unit}`).join('；') }}
            </p>

            <!-- 阶段确认按钮：当前阶段可确认完成，点击自动进入下一阶段 -->
            <button
              v-if="i === currentPhaseIndex && !isAllCompleted"
              type="button"
              class="ph-confirm-btn"
              :disabled="confirming"
              @click="confirmPhase(p, i)"
            >
              {{ confirming ? '确认中…' : '确认完成本阶段' }}
            </button>
            <button v-else-if="isAllCompleted" type="button" class="ph-confirm-btn done" disabled>
              ✓ 全部阶段已完成
            </button>
          </div>
          <p v-if="!phases.length" class="muted">暂无阶段，请先在「复现方案」页解析文献生成阶段。</p>
        </div>
      </section>

      <!-- 记录与现象（主界面表单提交，不再经过 agent） -->
      <section class="card">
        <h3>新增记录 / 现象</h3>
        <form class="record-form" @submit.prevent="submitRecord">
          <div class="rf-row">
            <label class="rf-label">所属阶段</label>
            <select v-model="form.phaseId" class="rf-input" required>
              <option :value="null" disabled>请选择阶段</option>
              <option v-for="p in phases" :key="p.id" :value="p.id">
                {{ p.phase_order }}. {{ p.name }}
              </option>
            </select>
          </div>
          <div class="rf-row">
            <label class="rf-label">记录名称</label>
            <input v-model="form.name" class="rf-input" type="text" placeholder="如：实验现象1-黄色沉淀" required maxlength="60" />
          </div>
          <div class="rf-row">
            <label class="rf-label">记录内容</label>
            <textarea
              v-model="form.content"
              class="rf-input rf-textarea"
              rows="4"
              placeholder="填写该阶段的现象/数据（Markdown，可含化学式），如：产物为黄色沉淀，质量 4.2 g，收率 82%…"
              required
            />
          </div>
          <div class="rf-actions">
            <p v-if="formError" class="rf-error">{{ formError }}</p>
            <button type="submit" class="rf-submit" :disabled="submitting">
              {{ submitting ? '分析保存中…' : '保存记录（自动分析符合度）' }}
            </button>
          </div>
        </form>

        <!-- 保存结果展示 -->
        <div v-if="lastResult" class="record-result">
          <MarkdownRenderer :content="lastResult" class="rec-content" />
          <div v-if="resultCharts.length" class="charts">
            <ChartCard v-for="c in resultCharts" :key="c.id" :spec="c" />
          </div>
        </div>
      </section>

      <!-- 已有记录 -->
      <section class="card">
        <h3>历史记录（{{ ctx.records.length }}）</h3>
        <div v-for="r in ctx.records" :key="r.id" class="record" :class="{ unexpected: r.is_expected === 0 }">
          <div class="rec-head">
            <b>{{ r.name }}</b>
            <span class="badge" :class="r.is_expected === 1 ? 'ok' : 'bad'">
              {{ r.is_expected === 1 ? '符合' : '不符合' }} · {{ r.compliance_percent ?? 'N/A' }}%
            </span>
          </div>
          <MarkdownRenderer :content="r.content" class="rec-content" />
          <p v-if="r.cause_analysis" class="rec-cause"><b>原因分析</b>：{{ r.cause_analysis }}</p>
        </div>
        <p v-if="!ctx.records.length" class="muted">暂无记录，请在上方表单填写并保存。</p>
      </section>

      <!-- 自定义数据 -->
      <section class="card">
        <h3>自定义数据（{{ ctx.customData.length }}）</h3>
        <table v-if="ctx.customData.length" class="tbl">
          <thead><tr><th>名称</th><th>类型</th><th>数值</th><th>单位</th></tr></thead>
          <tbody>
            <tr v-for="d in ctx.customData" :key="d.id">
              <td>{{ d.data_name }}</td><td>{{ d.data_type }}</td><td>{{ d.data_value }}</td><td>{{ d.unit }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">暂无自定义数据</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ProjectContextUI, ChartSpecUI } from '../../stores/repro'
import { reproStore } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ChartCard from './ChartCard.vue'

const props = defineProps<{ ctx: ProjectContextUI | null }>()
const emit = defineEmits<{ saved: [] }>()

const api = window.api

onMounted(() => {
  console.log('[Component] PhasePanel 挂载')
})

const phases = computed(() => [...(props.ctx?.phases ?? [])].sort((a, b) => Number(a.phase_order) - Number(b.phase_order)))

/** 当前进行中的阶段下标（第一个未完成的阶段） */
const currentPhaseIndex = computed(() => phases.value.findIndex((p) => p.status !== 'completed'))

const isAllCompleted = computed(() => phases.value.length > 0 && phases.value.every((p) => p.status === 'completed'))

function phaseLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '进行中'
  return '待开始'
}

/** 解析阶段量化指标（metrics_json） */
function phaseMetrics(p: { metrics_json?: string }): Array<{ name?: string; target?: string; range?: string; unit?: string }> {
  try {
    const arr = JSON.parse(p.metrics_json || '[]') as Array<{ name?: string; target?: string; range?: string; unit?: string }>
    return Array.isArray(arr) ? arr : []
  } catch {
    console.warn('[Component] PhasePanel 量化指标解析失败')
    return []
  }
}

/* ---------- 阶段确认：标记当前阶段完成并自动进入下一阶段 ---------- */
const confirming = ref(false)

async function confirmPhase(p: { id: number }, index: number): Promise<void> {
  if (!props.ctx) return
  confirming.value = true
  try {
    // 当前阶段标记为完成
    await api.db.experiment.updatePhase(p.id, { status: 'completed' })
    console.log('[Component] PhasePanel 阶段确认完成:', p.id)
    // 自动进入下一阶段（标记 in_progress）
    const next = phases.value[index + 1]
    if (next) {
      await api.db.experiment.updatePhase(next.id, { status: 'in_progress' })
      console.log('[Component] PhasePanel 自动进入下一阶段:', next.id)
    } else if (props.ctx) {
      // 最后一个阶段完成 → 项目自动标记为已完成
      await api.db.project.update(props.ctx.project.id, { status: 'completed' })
      console.log('[Component] PhasePanel 全部阶段完成，项目自动标记完成:', props.ctx.project.id)
    }
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 阶段确认失败:', err)
  } finally {
    confirming.value = false
  }
}

/* ---------- 记录表单 ---------- */
const form = reactive<{ phaseId: number | null; name: string; content: string }>({
  phaseId: null,
  name: '',
  content: ''
})
const submitting = ref(false)
const formError = ref('')
const lastResult = ref('')
const resultCharts = ref<ChartSpecUI[]>([])

async function submitRecord(): Promise<void> {
  if (!props.ctx || form.phaseId === null) {
    formError.value = '请选择所属阶段。'
    return
  }
  if (!form.name.trim() || !form.content.trim()) {
    formError.value = '请填写记录名称与内容。'
    return
  }
  formError.value = ''
  submitting.value = true
  try {
    const result = await api.ai.saveRecord({
      project_id: props.ctx.project.id,
      phase_id: form.phaseId,
      name: form.name.trim(),
      content: form.content.trim()
    })
    lastResult.value = result.text
    resultCharts.value = Array.isArray(result.charts) ? (result.charts as ChartSpecUI[]) : []
    console.log('[Component] PhasePanel 记录保存成功:', { recordId: result.recordId })
    // 清空表单，刷新数据
    form.phaseId = null
    form.name = ''
    form.content = ''
    await refresh()
  } catch (err) {
    console.error('[Component] PhasePanel 记录保存失败:', err)
    formError.value = `保存失败：${err instanceof Error ? err.message : String(err)}`
  } finally {
    submitting.value = false
  }
}

async function refresh(): Promise<void> {
  // 刷新上下文（阶段状态 / 记录列表）
  if (props.ctx) {
    await reproStore.refreshContext()
  }
  emit('saved')
}
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 10px; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.phases { display: flex; flex-direction: column; gap: 8px; }
.phase { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; }
.phase.completed { border-color: rgba(34, 197, 94, 0.4); }
.phase.current { border-color: var(--color-primary-light); background: rgba(99, 102, 241, 0.08); }
.ph-order { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 8px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 12px; flex-shrink: 0; }
.ph-info { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ph-status { font-size: 11px; color: var(--color-text-muted); }
.ph-expected { margin: 4px 0 0 36px; font-size: 12px; color: var(--color-text-muted); }
.ph-metrics { margin: 4px 0 0 36px; font-size: 12px; color: var(--color-success); }
.ph-confirm-btn {
  margin-left: auto;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981, #06b6d4);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.ph-confirm-btn:hover:not(:disabled) { opacity: 0.9; }
.ph-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ph-confirm-btn.done { background: var(--color-surface-alt); color: var(--color-success); border: 1px solid rgba(34, 197, 94, 0.4); }
.record-form { display: flex; flex-direction: column; gap: 10px; }
.rf-row { display: flex; flex-direction: column; gap: 4px; }
.rf-label { font-size: 12px; color: var(--color-text-muted); }
.rf-input {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12.5px;
  outline: none;
}
.rf-input:focus { border-color: var(--color-primary-light); }
.rf-textarea { resize: vertical; min-height: 70px; line-height: 1.6; }
.rf-actions { display: flex; align-items: center; gap: 12px; }
.rf-error { margin: 0; font-size: 12px; color: var(--color-danger); }
.rf-submit {
  margin-left: auto;
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
.rf-submit:hover:not(:disabled) { opacity: 0.9; }
.rf-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.record-result { margin-top: 12px; padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
.charts { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.record { padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 8px; }
.record.unexpected { border-color: rgba(244, 63, 94, 0.4); }
.rec-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; }
.badge.ok { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.badge.bad { color: var(--color-danger); background: rgba(244, 63, 94, 0.12); }
.rec-content { margin: 4px 0; }
.rec-cause { margin: 6px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
.tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tbl th, .tbl td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--color-border); }
.tbl th { color: var(--color-text-muted); font-weight: 600; }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
