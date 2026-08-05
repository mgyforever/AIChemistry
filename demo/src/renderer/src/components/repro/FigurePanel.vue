<template>
  <div class="panel">
    <div v-if="!projectId" class="panel-empty"><p>选择左侧项目查看文献图表解析结果</p></div>
    <div v-else class="panel-body">
      <section class="card">
        <h3>文献图表识别（{{ figures.length }}）</h3>
        <p class="hint">图片通过 DeepSeek-VL2 识别；未配置或失败时标记"待人工确认"，请核对原图与识别结果。</p>
        <div v-if="figures.length" class="figs">
          <div v-for="f in figures" :key="f.id" class="fig">
            <div class="fig-head">
              <span class="fig-type">{{ typeLabel(f.figure_type) }}</span>
              <span class="fig-status" :class="f.status">{{ statusLabel(f.status) }}</span>
            </div>
            <p v-if="f.caption" class="fig-caption">{{ f.caption }}</p>
            <MarkdownRenderer v-if="parsed(f).description" :content="parsed(f).description || ''" />
            <table v-if="parsed(f).table" class="tbl">
              <tbody>
                <tr v-for="(row, ri) in parsed(f).table" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="parsed(f).smiles" class="smiles"><b>SMILES</b>：{{ parsed(f).smiles }}</p>
            <p v-if="f.ocr_text" class="ocr">OCR：{{ f.ocr_text.slice(0, 200) }}</p>
          </div>
        </div>
        <p v-else class="muted">暂无图表，上传文献后自动解析。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { FigureUI } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ projectId: number | null }>()

const figures = ref<FigureUI[]>([])

onMounted(() => {
  console.log('[Component] FigurePanel 挂载')
})

async function load(): Promise<void> {
  if (!props.projectId) {
    figures.value = []
    return
  }
  console.log('[Component] FigurePanel 加载图表, 项目ID:', props.projectId)
  figures.value = (await window.api.db.figure.listByProject(props.projectId)) as FigureUI[]
  console.log('[Component] FigurePanel 图表加载完成, 数量:', figures.value.length)
}

watch(() => props.projectId, load, { immediate: true })

interface ParsedFigure {
  table?: string[][]
  smiles?: string
  description?: string
}

function parsed(f: FigureUI): ParsedFigure {
  try {
    return JSON.parse(f.structured_data || '{}') as ParsedFigure
  } catch {
    console.warn('[Component] FigurePanel 图表结构化数据解析失败')
    return {}
  }
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    table: '表格',
    chemical_structure: '结构式',
    spectrum: '谱图',
    chart: '数据图',
    photograph: '照片'
  }
  return map[t] || '未知'
}

function statusLabel(s: string): string {
  if (s === 'parsed') return '已识别'
  if (s === 'manual') return '待人工确认'
  return '未处理'
}
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 6px; font-size: 13.5px; font-weight: 700; }
.hint { margin: 0 0 10px; font-size: 12px; color: var(--color-text-muted); }
.figs { display: flex; flex-direction: column; gap: 10px; }
.fig { padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
.fig-head { display: flex; gap: 6px; margin-bottom: 6px; }
.fig-type { padding: 2px 8px; border-radius: 6px; font-size: 11px; background: rgba(99, 102, 241, 0.12); color: var(--color-primary-light); }
.fig-status { padding: 2px 8px; border-radius: 6px; font-size: 11px; }
.fig-status.parsed { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.fig-status.manual { color: var(--color-warning); background: rgba(249, 226, 175, 0.14); }
.fig-caption { margin: 0 0 6px; font-size: 12.5px; font-weight: 600; }
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.tbl td { padding: 4px 8px; border: 1px solid var(--color-border); }
.smiles { font-size: 12.5px; color: var(--color-accent-ink); }
.ocr { font-size: 11.5px; color: var(--color-text-muted); }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
