<template>
  <div class="panel">
    <div v-if="!projectId" class="panel-empty"><p>选择左侧项目进行预测实验</p></div>
    <div v-else class="panel-body">
      <section class="card">
        <h3>AI 预测实验（能力⑤）</h3>
        <p class="hint">预测基于理论推演（反应式/定律/公式），标注"预测/未验证"，实际需实验确认。</p>
        <div class="vars">
          <div v-for="(v, i) in variables" :key="i" class="var-row">
            <input v-model="v.name" class="inp inp-sm" placeholder="变量名（如 反应温度）" />
            <input v-model="v.value" class="inp inp-sm" placeholder="取值" />
            <input v-model="v.unit" class="inp inp-unit" placeholder="单位" />
            <button type="button" class="del" @click="variables.splice(i, 1)">✕</button>
          </div>
          <button type="button" class="add" @click="variables.push({ name: '', value: '', unit: '' })">+ 添加变量</button>
        </div>
        <button type="button" class="run" :disabled="loading" @click="runPrediction">
          {{ loading ? '预测中…' : '运行 AI 预测实验' }}
        </button>
      </section>

      <section class="card">
        <h3>历史预测（{{ ctx?.predictions?.length ?? 0 }}）</h3>
        <div v-for="p in predictions" :key="p.id" class="pred">
          <div class="pred-head">
            <b>{{ p.name }}</b>
            <span class="pred-tag">预测/未验证</span>
          </div>
          <MarkdownRenderer :content="predText(p)" />
        </div>
        <p v-if="!predictions.length" class="muted">暂无预测记录</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reproStore, type ProjectContextUI, type PredictionUI } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ projectId: number | null; ctx: ProjectContextUI | null }>()

onMounted(() => {
  console.log('[Component] PredictionPanel 挂载')
})

const loading = ref(false)
const variables = ref<Array<{ name: string; value: string; unit: string }>>([
  { name: '反应温度', value: '', unit: '°C' },
  { name: '反应时间', value: '', unit: 'h' }
])

const predictions = computed(() => props.ctx?.predictions ?? [])

async function runPrediction(): Promise<void> {
  if (!props.projectId) return
  console.log('[Component] PredictionPanel 运行预测实验, 项目ID:', props.projectId, '变量数:', variables.value.length)
  loading.value = true
  try {
    const desc = variables.value
      .filter((v) => v.name && v.value)
      .map((v) => `${v.name}: ${v.value}${v.unit}`)
      .join('；')
    await reproStore.sendMessage(
      `请对本项目进行 AI 预测实验（理论依据必须充分）。基于当前实验流程，变量设定为：${desc}。请调用 run_prediction_experiment 工具并给出预测结果、性质分析与理论依据。`
    )
    await reproStore.refreshContext()
    console.log('[Component] PredictionPanel 预测实验完成')
  } catch (err) {
    console.error('[Component] PredictionPanel 预测实验异常:', err)
  } finally {
    loading.value = false
  }
}

function predText(p: PredictionUI): string {
  let vars = ''
  try {
    const arr = JSON.parse(p.variables || '[]') as Array<Record<string, unknown>>
    vars = arr.map((v) => `${v.name}: ${v.value}${v.unit}`).join('；')
  } catch {
    /* 忽略 */
    console.warn('[Component] PredictionPanel 预测变量数据解析失败')
  }
  return `**变量设定**：${vars || '—'}\n\n${p.predicted_result}\n\n**性质分析**：${p.property_analysis}\n\n**理论依据**：${p.theory_basis}`
}
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; }
.hint { margin: 0 0 10px; font-size: 12px; color: var(--color-text-muted); }
.vars { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.var-row { display: flex; gap: 6px; }
.inp { padding: 7px 9px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text); font-size: 12.5px; outline: none; }
.inp:focus { border-color: var(--color-primary-light); }
.inp-sm { flex: 1; }
.inp-unit { width: 76px; }
.del { width: 28px; border: none; background: transparent; color: var(--color-danger); cursor: pointer; font-size: 13px; }
.add { align-self: flex-start; padding: 5px 10px; border: 1px dashed var(--color-border); border-radius: 8px; background: transparent; color: var(--color-text-muted); font-size: 12px; cursor: pointer; }
.add:hover { color: var(--color-accent-ink); border-color: var(--color-accent); }
.run { padding: 9px 14px; border: none; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #06b6d4); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast); }
.run:hover { opacity: 0.9; }
.run:disabled { opacity: 0.5; cursor: not-allowed; }
.pred { padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 8px; background: var(--color-surface); }
.pred-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.pred-tag { padding: 2px 8px; border-radius: 6px; font-size: 10.5px; color: var(--color-warning); background: rgba(249, 226, 175, 0.14); }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
