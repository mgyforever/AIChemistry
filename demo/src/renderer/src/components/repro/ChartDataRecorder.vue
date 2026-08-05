<template>
  <div class="cdr">
    <div class="cdr-config">
      <label class="cdr-label">图表类型</label>
      <div class="cdr-types">
        <button
          v-for="t in chartTypes"
          :key="t"
          type="button"
          class="cdr-type"
          :class="{ active: form.type === t }"
          @click="form.type = t"
        >
          {{ t }}
        </button>
      </div>
    </div>
    <div class="cdr-grid">
      <label class="cdr-label">图表标题
        <input v-model="form.title" class="cdr-input" type="text" placeholder="如：温度-产率关系" />
      </label>
      <label class="cdr-label">X 轴名称
        <input v-model="form.x_label" class="cdr-input" type="text" placeholder="如：温度" />
      </label>
      <label class="cdr-label">Y 轴名称
        <input v-model="form.y_label" class="cdr-input" type="text" placeholder="如：产率" />
      </label>
      <label class="cdr-label">单位
        <input v-model="form.unit" class="cdr-input" type="text" placeholder="如：°C / %" />
      </label>
      <label class="cdr-label">序列名
        <input v-model="form.seriesName" class="cdr-input" type="text" placeholder="如：实验组A" />
      </label>
    </div>

    <!-- 空白坐标系：点击添加数据点 -->
    <div ref="chartRef" class="cdr-canvas" @click="onCanvasClick" />

    <p class="cdr-hint">点击图表空白处添加数据点；表格中可直接修改 X/Y 值，点击 ✕ 删除该点。</p>

    <!-- 数据点表格 -->
    <table v-if="points.length" class="cdr-tbl">
      <thead>
        <tr>
          <th>序号</th>
          <th>{{ form.x_label || 'X' }}</th>
          <th>{{ form.y_label || 'Y' }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in points" :key="i">
          <td>{{ i + 1 }}</td>
          <td><input v-model="p.x" class="cdr-cell" type="number" step="any" @change="rebuild" /></td>
          <td><input v-model="p.y" class="cdr-cell" type="number" step="any" @change="rebuild" /></td>
          <td><button type="button" class="cdr-del" title="删除该点" @click="removePoint(i)">✕</button></td>
        </tr>
      </tbody>
    </table>

    <div class="cdr-actions">
      <span v-if="points.length" class="cdr-count">{{ points.length }} 个数据点</span>
      <button type="button" class="cdr-clear" @click="clearPoints">清空</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'

/** ECharts 统计图录数（与主进程 ChartRecordData 对应，SQLite JSON 存储） */
export interface ChartRecordData {
  type: string
  title: string
  x_label: string
  y_label: string
  unit: string
  series: Array<{ name: string; data: Array<[number | string, number]> }>
  summary_text?: string
}

const chartTypes = ['line', 'bar', 'scatter'] as const

const form = reactive({
  type: 'line' as 'line' | 'bar' | 'scatter',
  title: '',
  x_label: '',
  y_label: '',
  unit: '',
  seriesName: ''
})

const points = ref<Array<{ x: number | string; y: number }>>([])
const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const emit = defineEmits<{ change: [data: ChartRecordData | null] }>()

/** 解析当前录入数据为 ChartRecordData（供父组件随记录保存） */
function buildChartData(): ChartRecordData | null {
  if (!form.title && points.value.length === 0) return null
  return {
    type: form.type,
    title: form.title,
    x_label: form.x_label,
    y_label: form.y_label,
    unit: form.unit,
    series: [{ name: form.seriesName || form.y_label || '数值', data: points.value.map((p) => [p.x, p.y]) }]
  }
}

function emitChange(): void {
  emit('change', buildChartData())
}

/** 渲染空白坐标系 + 数据点 */
function renderChart(): void {
  if (!chart) return
  const pointsData = points.value.map((p) => [p.x, p.y])
  const series: echarts.SeriesOption[] = [
    {
      name: form.seriesName || form.y_label || '数值',
      type: form.type,
      data: pointsData,
      symbolSize: 8,
      // line 平滑连接
      ...(form.type === 'line' ? { smooth: true } : {})
    }
  ]
  // bar 需要 category 轴，scatter/line 用 value 轴
  const xAxis =
    form.type === 'bar'
      ? { type: 'category' as const, data: points.value.map((p) => String(p.x)), name: form.x_label }
      : { type: 'value' as const, name: form.x_label, scale: true }
  chart.setOption(
    {
      grid: { left: 48, right: 24, top: 32, bottom: 48 },
      tooltip: { trigger: 'axis' },
      xAxis,
      yAxis: { type: 'value', name: form.y_label, scale: true },
      series
    },
    true
  )
}

function rebuild(): void {
  renderChart()
  emitChange()
}

function onCanvasClick(e: MouseEvent): void {
  if (!chart || !chartRef.value) return
  const rect = chartRef.value.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  const point = chart.convertFromPixel({ seriesIndex: 0 }, [px, py]) as [number, number] | undefined
  if (!point || !Array.isArray(point) || point.length < 2) return
  const [x, y] = point
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return
  points.value.push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) })
  rebuild()
}

function removePoint(index: number): void {
  points.value.splice(index, 1)
  rebuild()
}

function clearPoints(): void {
  points.value = []
  rebuild()
}

watch(
  () => [form.type, form.title, form.x_label, form.y_label, form.unit, form.seriesName],
  () => {
    renderChart()
    emitChange()
  }
)

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    renderChart()
    window.addEventListener('resize', onResize)
  }
})

function onResize(): void {
  chart?.resize()
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})

/** 父组件可通过该计算属性主动获取（如提交记录时） */
const chartData = computed(() => buildChartData())
defineExpose({ chartData, clear: clearPoints })
</script>

<style scoped>
.cdr { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px dashed var(--color-border); border-radius: 12px; background: var(--color-surface); }
.cdr-config { display: flex; align-items: center; gap: 10px; }
.cdr-types { display: flex; gap: 6px; }
.cdr-type {
  padding: 5px 12px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; color: var(--color-text-muted); font-size: 12px; cursor: pointer; transition: all var(--transition-fast);
}
.cdr-type.active { border-color: var(--color-primary-light); color: var(--color-primary); background: rgba(99, 102, 241, 0.1); }
.cdr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.cdr-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--color-text-muted); }
.cdr-input {
  padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 8px;
  background: var(--color-surface-alt); color: var(--color-text); font-size: 12.5px; outline: none;
}
.cdr-input:focus { border-color: var(--color-primary-light); }
.cdr-canvas { width: 100%; height: 260px; border: 1px solid var(--color-border); border-radius: 10px; cursor: crosshair; }
.cdr-hint { margin: 0; font-size: 11.5px; color: var(--color-text-muted); }
.cdr-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.cdr-tbl th, .cdr-tbl td { padding: 5px 8px; text-align: left; border-bottom: 1px solid var(--color-border); }
.cdr-tbl th { color: var(--color-text-muted); font-weight: 600; }
.cdr-cell {
  width: 90px; padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 6px;
  background: var(--color-surface-alt); color: var(--color-text); font-size: 12px; outline: none;
}
.cdr-cell:focus { border-color: var(--color-primary-light); }
.cdr-del { border: none; background: transparent; color: var(--color-danger); cursor: pointer; font-size: 13px; }
.cdr-actions { display: flex; align-items: center; justify-content: space-between; }
.cdr-count { font-size: 12px; color: var(--color-text-muted); }
.cdr-clear {
  padding: 5px 12px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; color: var(--color-text-muted); font-size: 12px; cursor: pointer; transition: all var(--transition-fast);
}
.cdr-clear:hover { color: var(--color-danger); border-color: var(--color-danger); }
</style>
