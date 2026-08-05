<template>
  <div class="rc">
    <div class="rc-head">
      <span class="rc-title">{{ data.title || '统计图' }}</span>
      <span class="rc-axis">{{ axisText }}</span>
    </div>
    <div ref="chartRef" class="rc-body" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'
import type { ChartRecordData } from './ChartDataRecorder.vue'

const props = defineProps<{ data: ChartRecordData }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const axisText = computed(() => {
  const parts: string[] = []
  if (props.data.x_label) parts.push(`X: ${props.data.x_label}`)
  if (props.data.y_label) parts.push(`Y: ${props.data.y_label}`)
  if (props.data.unit) parts.push(`单位: ${props.data.unit}`)
  return parts.join('  ')
})

function render(): void {
  if (!chart) return
  const series = props.data.series.map((s) => ({
    name: s.name,
    type: props.data.type === 'scatter' ? 'scatter' : props.data.type === 'bar' ? 'bar' : 'line',
    data: s.data,
    smooth: props.data.type === 'line',
    symbolSize: 7
  }))
  const xAxis =
    props.data.type === 'bar'
      ? { type: 'category' as const, data: props.data.series.flatMap((s) => s.data.map((d) => String(d[0]))), name: props.data.x_label }
      : { type: 'value' as const, name: props.data.x_label, scale: true }
  chart.setOption(
    {
      grid: { left: 48, right: 24, top: 32, bottom: 48 },
      tooltip: { trigger: 'axis' },
      legend: { show: series.length > 1 },
      xAxis,
      yAxis: { type: 'value', name: props.data.y_label, scale: true },
      series
    },
    true
  )
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
.rc { margin-top: 8px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); overflow: hidden; }
.rc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--color-border); }
.rc-title { font-size: 12px; font-weight: 600; color: var(--color-text); }
.rc-axis { font-size: 11px; color: var(--color-text-muted); }
.rc-body { width: 100%; height: 220px; }
</style>
