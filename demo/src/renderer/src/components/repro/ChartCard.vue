<template>
  <div class="chart-card" :class="{ 'is-light': isLight }">
    <div class="cc-head">
      <span class="cc-title">{{ spec.title }}</span>
      <button class="cc-export" type="button" title="导出 PNG" @click="exportPng">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
          />
        </svg>
      </button>
    </div>
    <div ref="chartRef" class="cc-body" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as echarts from 'echarts'
import type { ChartSpecUI } from '../../stores/repro'
import { themeStore } from '../../stores/theme'

const props = defineProps<{ spec: ChartSpecUI }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const isLight = computed(() => themeStore.mode === 'light')

function applyOption(): void {
  if (!chart || !props.spec.echartsOption) return
  const option = JSON.parse(JSON.stringify(props.spec.echartsOption)) as Record<string, unknown>
  // 跟随主题的基础样式
  const textColor = isLight.value ? '#0f172a' : '#cdd6f4'
  const muted = isLight.value ? '#64748b' : '#6c7086'
  const axis = { axisLabel: { color: muted }, axisLine: { lineStyle: { color: isLight.value ? '#cbd5e1' : '#45475a' } } }
  option.textStyle = { color: textColor }
  option.xAxis = Array.isArray(option.xAxis) ? option.xAxis.map((a: Record<string, unknown>) => ({ ...a, ...axis })) : option.xAxis
  option.yAxis = Array.isArray(option.yAxis) ? option.yAxis.map((a: Record<string, unknown>) => ({ ...a, ...axis })) : option.yAxis
  chart.setOption(option, true)
}

function resize(): void {
  chart?.resize()
}

function exportPng(): void {
  if (!chart) return
  console.log('[Component] ChartCard 导出 PNG:', props.spec.title)
  const url = chart.getDataURL({ type: 'png', pixelRatio: 2 })
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.spec.title || 'chart'}.png`
  a.click()
}

onMounted(() => {
  console.log('[Component] ChartCard 挂载, 图表:', props.spec.title, '类型:', props.spec.type)
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    applyOption()
    window.addEventListener('resize', resize)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})

watch(
  () => [props.spec.echartsOption, isLight.value],
  () => applyOption(),
  { deep: true }
)
</script>

<style scoped>
.chart-card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-alt);
  overflow: hidden;
}
.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.cc-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
}
.cc-export {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.cc-export:hover {
  color: var(--color-text);
  border-color: var(--color-border);
}
.cc-body {
  width: 100%;
  height: 260px;
}
</style>
