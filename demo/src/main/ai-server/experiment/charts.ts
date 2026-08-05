import type { ChartSpec } from '../type'

/**
 * ECharts 图表构建工具（§8）
 * 供管线/工具生成 ChartSpec，前端 ChartCard 直接渲染
 */

/** 工具输出中的图表标记（包装层从中提取并合并进 AiChat.charts） */
export const CHART_MARKER = '【图表数据】'

/**
 * 在工具返回文本后附加图表数据标记。
 * 包装层（experiment/agent.ts）会扫描工具输出，将图表合并到最终 AiChat.charts。
 */
export function withCharts(text: string, charts: ChartSpec[]): string {
  return text + '\n\n' + CHART_MARKER + '\n' + JSON.stringify(charts)
}

/** 从工具输出中提取图表数组 */
export function extractChartsFromToolOutput(output: string): ChartSpec[] {
  const idx = output.indexOf(CHART_MARKER)
  if (idx < 0) return []
  const raw = output.slice(idx + CHART_MARKER.length).trim()
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? (arr as ChartSpec[]) : []
  } catch {
    return []
  }
}

function baseOption(): Record<string, unknown> {
  return {
    animation: true,
    grid: { left: 40, right: 20, top: 40, bottom: 40 }
  }
}

/** 仪表盘（符合度等百分比） */
export function gaugeChart(id: string, title: string, value: number, label = '符合度'): ChartSpec {
  return {
    id,
    title,
    type: 'gauge',
    echartsOption: {
      ...baseOption(),
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 100,
          progress: { show: true, width: 14 },
          axisLine: { lineStyle: { width: 14 } },
          axisLabel: { distance: 20 },
          detail: { valueAnimation: true, formatter: '{value}%', fontSize: 22 },
          data: [{ value: Math.round(value), name: label }]
        }
      ]
    }
  }
}

/** 柱状图（对比等） */
export function barChart(
  id: string,
  title: string,
  categories: string[],
  series: Array<{ name: string; data: number[] }>
): ChartSpec {
  return {
    id,
    title,
    type: 'bar',
    echartsOption: {
      ...baseOption(),
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
      series: series.map((s) => ({ name: s.name, type: 'bar', data: s.data, barMaxWidth: 40 }))
    }
  }
}

/** 折线图（趋势/扫描曲线） */
export function lineChart(
  id: string,
  title: string,
  x: (number | string)[],
  series: Array<{ name: string; data: number[] }>,
  area = false
): ChartSpec {
  return {
    id,
    title,
    type: 'line',
    echartsOption: {
      ...baseOption(),
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: x },
      yAxis: { type: 'value' },
      series: series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        showSymbol: true,
        areaStyle: area ? { opacity: 0.15 } : undefined,
        data: s.data
      }))
    }
  }
}

/** 饼图（占比） */
export function pieChart(id: string, title: string, data: Array<{ name: string; value: number }>): ChartSpec {
  return {
    id,
    title,
    type: 'pie',
    echartsOption: {
      ...baseOption(),
      tooltip: { trigger: 'item' },
      series: [{ type: 'pie', radius: '62%', data }]
    }
  }
}

/** 雷达图（多维评估） */
export function radarChart(
  id: string,
  title: string,
  indicators: string[],
  values: Array<{ name: string; data: number[] }>
): ChartSpec {
  return {
    id,
    title,
    type: 'radar',
    echartsOption: {
      ...baseOption(),
      radar: { indicator: indicators.map((name) => ({ name, max: 100 })) },
      series: [{ type: 'radar', data: values.map((v) => ({ name: v.name, value: v.data })) }]
    }
  }
}
