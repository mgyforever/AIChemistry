<template>
  <div class="panel">
    <div v-if="!projectId" class="panel-empty"><p>选择左侧项目查看文献图表解析结果</p></div>
    <div v-else class="panel-body">
      <section class="card">
        <h3>文献图表识别（{{ figures.length }}）</h3>
        <p class="hint">图片通过多模态大模型（SiliconFlow Kimi-K2.6）识别；未配置或失败时标记"待人工确认"，请核对原图与识别结果。</p>
        <div v-if="figures.length" class="figs">
          <div v-for="f in figures" :key="f.id" class="fig">
            <div class="fig-head">
              <span class="fig-type">{{ typeLabel(f.figure_type) }}</span>
              <span v-if="parsed(f).subtype" class="fig-subtype">{{ parsed(f).subtype }}</span>
              <span class="fig-status" :class="f.status">{{ statusLabel(f.status) }}</span>
            </div>
            <img
              v-if="f.image_path && imgSrc(f.image_path)"
              :src="imgSrc(f.image_path)"
              class="fig-img"
              alt="原图"
            />
            <p v-if="f.caption" class="fig-caption"><FormulaText :content="f.caption" /></p>
            <FigureChartCard v-if="chartData(f)" :data="chartData(f)!" />
            <MarkdownRenderer v-if="parsed(f).description" :content="parsed(f).description || ''" />
            <table v-if="tableRows(f).length" class="tbl">
              <tbody>
                <tr v-for="(row, ri) in tableRows(f)" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci">
                    <FormulaText :content="cellText(cell)" />
                  </td>
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
import { ref, reactive, watch, onMounted } from 'vue'
import type { FigureUI } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'
import FormulaText from './FormulaText.vue'
import FigureChartCard from './FigureChartCard.vue'

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
  table?: unknown[][] | string
  smiles?: string
  subtype?: string
  description?: string
  spectrum?: { x?: number[]; y?: number[] }
  chart?: { series?: unknown[] }
}

function parsed(f: FigureUI): ParsedFigure {
  try {
    return JSON.parse(f.structured_data || '{}') as ParsedFigure
  } catch {
    console.warn('[Component] FigurePanel 图表结构化数据解析失败')
    return {}
  }
}

/** 将 HTML 表格字符串解析为二维数组（兼容模型输出的脏数据） */
function htmlTableToRows(html: string): unknown[][] | null {
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows: unknown[][] = []
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(html)) !== null) {
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    const cells: unknown[] = []
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      cells.push(cellText(tdMatch[1]))
    }
    if (cells.length) rows.push(cells)
  }
  return rows.length ? rows : null
}

/** 兼容模型输出的表格（数组 / JSON 数组字符串 / HTML 字符串），返回可渲染的二维数组 */
function tableRows(f: FigureUI): unknown[][] {
  const t = parsed(f).table
  if (Array.isArray(t)) return t
  if (typeof t === 'string') {
    const trimmed = t.trim()
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed) as unknown
        if (Array.isArray(arr)) return arr as unknown[][]
      } catch {
        /* 继续尝试 HTML 解析 */
      }
    }
    return htmlTableToRows(trimmed) ?? []
  }
  return []
}

/** 与 FigureChartCard 兼容的图表数据形状 */
interface FigureChartData {
  table?: unknown[][]
  spectrum?: { x: number[]; y: number[] }
  chart?: { series: Array<{ name: string; data: Array<number | [number, number]> }> }
  x_label?: string
  y_label?: string
}

/** 有可渲染的 ECharts 数据（数据图/谱图）时返回图表数据，否则 null */
function chartData(f: FigureUI): FigureChartData | null {
  const p = parsed(f)
  const hasSeries = Array.isArray(p.chart?.series) && (p.chart?.series?.length ?? 0) > 0
  const hasSpectrum = Array.isArray(p.spectrum?.x) && (p.spectrum?.x?.length ?? 0) > 0
  return hasSeries || hasSpectrum ? (p as unknown as FigureChartData) : null
}

/** 原图本地路径 → data URL（复用 readMedia 模式；reactive Map 保证异步加载完成后触发重渲染） */
const imgCache = reactive(new Map<string, string>())
const imgLoading = new Set<string>()

function imgSrc(p: string): string {
  const cached = imgCache.get(p)
  if (cached) return cached
  if (imgLoading.has(p)) return ''
  imgLoading.add(p)
  void window.api.file.readMedia(p).then((url) => {
    if (url) imgCache.set(p, url)
    imgLoading.delete(p)
  })
  return ''
}

/** 清洗模型输出的表格单元格：剔除 HTML 标签并还原常见实体，避免显示成乱码 */
function cellText(cell: unknown): string {
  return String(cell ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
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
.fig-subtype { padding: 2px 8px; border-radius: 6px; font-size: 11px; background: rgba(16, 185, 129, 0.12); color: var(--color-success); }
.fig-img { display: block; max-width: 100%; max-height: 240px; margin: 0 0 8px; border: 1px solid var(--color-border); border-radius: 8px; object-fit: contain; background: #fff; }
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
