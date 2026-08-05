<template>
  <div class="fc">
    <div ref="chartRef" class="fc-body" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

/** 图表结构化数据（与主进程 StructuredFigureData / ChartRecordData 兼容） */
interface FigureChartData {
  type?: string
  table?: unknown[][]
  spectrum?: { x: number[]; y: number[]; peaks?: Array<{ ppm: number; multiplicity?: string }> }
  chart?: { series: Array<{ name: string; data: Array<number | [number, number]> }> }
  series?: Array<{ name: string; data: Array<[number | string, number]> }>
  x_label?: string
  y_label?: string
}

const props = defineProps<{ data: FigureChartData }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

function buildOption(data: FigureChartData): echarts.EChartsOption {
  // 1. 表格数据 → bar/line（首行为表头，首列为 X 轴）
  if (Array.isArray(data.table) && data.table.length) {
    const table = data.table
    const header = (table[0] ?? []) as unknown[]
    const rows = table.slice(1) as unknown[][]
    if (!header.length) return {}
    const xData = rows.map((r) => String(r[0] ?? ''))
    const series: echarts.SeriesOption[] = header.slice(1).map((h, si) => ({
      name: String(h),
      type: 'bar',
      data: rows.map((r) => Number(r[si + 1]) || 0)
    }))
    return {
      grid: { left: 48, right: 24, top: 36, bottom: 48 },
      tooltip: { trigger: 'axis' },
      legend: { show: series.length > 1 },
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series
    }
  }
  // 2. 谱图数据 → line（x=化学位移/波数，y=强度）
  if (data.spectrum && Array.isArray(data.spectrum.x)) {
    return {
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', name: data.x_label ?? '', scale: true },
      yAxis: { type: 'value', name: data.y_label ?? '强度' },
      series: [{ type: 'line', data: data.spectrum.x.map((x, i) => [x, data.spectrum?.y?.[i] ?? 0]), symbol: 'none', lineStyle: { width: 1.5 } }]
    }
  }
  // 3. chart.series / series（通用数据序列）
  const seriesArr = data.chart?.series ?? data.series ?? []
  if (seriesArr.length) {
    const series: echarts.SeriesOption[] = seriesArr.map((s) => {
      const pts = s.data.map((d) => (Array.isArray(d) ? d : [d, 0]))
      const allNum = pts.every((p) => typeof p[0] === 'number')
      return {
        name: s.name,
        type: 'line' as const,
        symbolSize: 6,
        data: allNum ? pts : pts.map((p) => [String(p[0]), p[1]])
      }
    })
    const xType = seriesArr.every((s) => s.data.every((d) => typeof d === 'number' || (Array.isArray(d) && typeof d[0] === 'number')))
      ? 'value'
      : 'category'
    return {
      grid: { left: 48, right: 24, top: 36, bottom: 48 },
      tooltip: { trigger: 'axis' },
      legend: { show: series.length > 1 },
      xAxis: { type: xType as 'value' | 'category', name: data.x_label ?? '', scale: true },
      yAxis: { type: 'value', name: data.y_label ?? '' },
      series
    }
  }
  return {}
}

function render(): void {
  if (!chart) return
  const option = buildOption(props.data)
  chart.setOption(option, true)
}

function onResize(): void {
  chart?.resize()
}

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    render()
    window.addEventListener('resize', onResize)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.fc { width: 100%; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-alt); overflow: hidden; }
.fc-body { width: 100%; height: 220px; }
</style>
