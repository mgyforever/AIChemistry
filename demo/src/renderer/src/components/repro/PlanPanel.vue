<template>
  <div class="panel">
    <div v-if="!ctx" class="panel-empty">
      <p>选择左侧项目查看复现方案</p>
    </div>
    <div v-else class="panel-body">
      <!-- 难度评估 -->
      <section v-if="ctx.assessment" class="card">
        <h3>复现难度评估</h3>
        <div class="assess">
          <div class="assess-score">
            <strong>{{ ctx.assessment.difficulty_score }}</strong>
            <span>/100</span>
          </div>
          <div>
            <p><b>可行性</b>：{{ ctx.assessment.feasibility }}</p>
            <p>{{ ctx.assessment.analysis }}</p>
            <p v-if="riskPoints.length"><b>风险点</b>：{{ riskPoints.join('；') }}</p>
          </div>
        </div>
      </section>

      <!-- 材料 -->
      <section class="card">
        <h3>化学材料 / 试剂（{{ ctx.materials.length }}）</h3>
        <table v-if="ctx.materials.length" class="tbl">
          <thead>
            <tr><th>名称</th><th>化学式</th><th>用量</th><th>纯度</th><th>用途</th></tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in ctx.materials" :key="i">
              <td>{{ m.name }}</td><td><FormulaText :content="m.formula" /></td><td>{{ m.quantity }}</td>
              <td>{{ m.purity }}</td><td>{{ m.purpose }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">暂无材料数据</p>
      </section>

      <!-- 反应方程式 -->
      <section class="card">
        <h3>反应方程式（{{ ctx.reactions.length }}）</h3>
        <ul v-if="ctx.reactions.length" class="reactions">
          <li v-for="(r, i) in ctx.reactions" :key="i">
            <span class="eq"><FormulaText :content="r.equation" /></span>
            <span v-if="r.type" class="tag">{{ r.type }}</span>
            <span v-if="r.purpose" class="muted">{{ r.purpose }}</span>
          </li>
        </ul>
        <p v-else class="muted">暂无反应方程式</p>
      </section>

      <!-- 步骤 -->
      <section class="card">
        <h3>实验步骤（{{ ctx.steps.length }}）</h3>
        <ol class="steps">
          <li v-for="s in sortedSteps" :key="s.id">
            <div class="step-title"><b>{{ s.step_no }}.</b> {{ s.title }}</div>
            <MarkdownRenderer :content="s.description" class="step-desc" />
            <div v-if="formatConditions(s.conditions)" class="step-cond">条件：{{ formatConditions(s.conditions) }}</div>
          </li>
        </ol>
      </section>

      <!-- 仪器 -->
      <section class="card">
        <h3>实验仪器（{{ ctx.instruments.length }}）</h3>
        <p v-if="ctx.instruments.length">{{ ctx.instruments.map((i) => `${i.name}（${i.specification}）`).join('、') }}</p>
        <p v-else class="muted">暂无仪器数据</p>
      </section>

      <!-- 表征/分析方法 -->
      <section class="card">
        <h3>表征 / 分析方法（{{ ctx.characterizations.length }}）</h3>
        <ul v-if="ctx.characterizations.length" class="chars">
          <li v-for="(c, i) in ctx.characterizations" :key="i">
            <b>{{ c.method }}</b>
            <span v-if="c.target" class="tag">{{ c.target }}</span>
            <span v-if="c.conditions" class="muted">条件：<FormulaText :content="c.conditions" /></span>
            <span v-if="c.expected" class="expect">预期：<FormulaText :content="c.expected" /></span>
          </li>
        </ul>
        <p v-else class="muted">暂无表征方法</p>
      </section>

      <!-- 注意事项 -->
      <section class="card">
        <h3>注意事项 / 潜在问题（{{ ctx.concerns.length }}）</h3>
        <ul class="concerns">
          <li v-for="(c, i) in ctx.concerns" :key="i">
            <span class="lvl" :class="riskClass(c.risk_level)">{{ c.risk_level || '中' }}</span>
            {{ c.content }}
            <span v-if="c.solution" class="sol">应对：{{ c.solution }}</span>
          </li>
        </ul>
      </section>

      <!-- 信息缺口 -->
      <section class="card">
        <h3>信息缺口（{{ ctx.gaps.length }}）</h3>
        <p v-if="ctx.gaps.length" class="muted">以下为文献未说明、复现时需假设或人工确认的信息：</p>
        <ul v-if="ctx.gaps.length" class="gaps">
          <li v-for="(g, i) in ctx.gaps" :key="i">
            <span class="tag">{{ gapLabel(g.category) }}</span>
            {{ g.content }}
            <span v-if="g.impact" class="sol">影响：{{ g.impact }}</span>
            <span v-if="g.assumption" class="assume">假设：{{ g.assumption }}</span>
          </li>
        </ul>
        <p v-else class="muted">文献信息完整，暂无信息缺口</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { ProjectContextUI } from '../../stores/repro'
import FormulaText from './FormulaText.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ ctx: ProjectContextUI | null }>()

onMounted(() => {
  console.log('[Component] PlanPanel 挂载')
})

const sortedSteps = computed(() =>
  [...(props.ctx?.steps ?? [])].sort((a, b) => Number(a.step_no) - Number(b.step_no))
)

const riskPoints = computed(() => {
  try {
    const raw = props.ctx?.assessment?.risk_points
    return raw ? JSON.parse(String(raw)) : []
  } catch {
    console.warn('[Component] PlanPanel 风险点数据解析失败')
    return []
  }
})

/** 条件键 → 中文标签 */
const COND_LABELS: Record<string, string> = {
  temperature: '温度',
  time: '时间',
  atmosphere: '气氛',
  pressure: '压强',
  stirring: '搅拌'
}

/**
 * 将步骤的 conditions（结构化对象或 JSON 字符串）格式化为友好文本。
 * 如 {temperature:'40°C',time:'0.5h'} → "温度 40°C · 时间 0.5h"；旧库 JSON 字符串同样兼容。
 */
function formatConditions(raw: string | Record<string, string> | null | undefined): string {
  if (!raw) return ''
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    try {
      obj = JSON.parse(trimmed)
    } catch {
      // 非 JSON 字符串，原样返回（可能是普通文本条件）
      return trimmed
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return typeof raw === 'string' ? raw : ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const label = COND_LABELS[key] ?? key
    parts.push(`${label} ${String(value)}`)
  }
  return parts.join(' · ')
}

/** 缺口类别 → 中文标签 */
function gapLabel(category: string): string {
  const labels: Record<string, string> = {
    condition: '条件',
    procedure: '操作',
    material: '材料',
    instrument: '仪器',
    characterization: '表征',
    other: '其他'
  }
  return labels[category] ?? category
}

function riskClass(level: string): string {
  if (level === '高') return 'high'
  if (level === '低') return 'low'
  return 'mid'
}
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 10px; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.assess { display: flex; gap: 16px; align-items: flex-start; }
.assess-score { font-size: 34px; font-weight: 800; color: var(--color-accent); line-height: 1; }
.assess-score span { font-size: 14px; color: var(--color-text-muted); }
.tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tbl th, .tbl td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--color-border); }
.tbl th { color: var(--color-text-muted); font-weight: 600; }
.steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.step-title { font-size: 13px; }
.step-desc { font-size: 12.5px; color: var(--color-text-muted); }
.step-cond { font-size: 12px; color: var(--color-accent-ink); }
.concerns { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.concerns li { font-size: 12.5px; line-height: 1.6; }
.lvl { display: inline-block; padding: 1px 6px; border-radius: 5px; font-size: 10.5px; margin-right: 6px; }
.lvl.high { color: var(--color-danger); background: rgba(244, 63, 94, 0.12); }
.lvl.mid { color: var(--color-warning); background: rgba(249, 226, 175, 0.14); }
.lvl.low { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.sol { display: block; color: var(--color-accent-ink); font-size: 12px; }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
.tag { display: inline-block; padding: 1px 6px; margin: 0 4px; border-radius: 5px; font-size: 10.5px; color: var(--color-accent-ink); background: rgba(56, 189, 248, 0.12); }
.reactions { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.reactions li { font-size: 12.5px; line-height: 1.6; }
.eq { font-family: 'Times New Roman', serif; font-weight: 600; }
.chars { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.chars li { font-size: 12.5px; line-height: 1.6; }
.expect { display: block; color: var(--color-success); font-size: 12px; }
.gaps { margin: 0 0 6px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.gaps li { font-size: 12.5px; line-height: 1.6; }
.assume { display: block; color: var(--color-warning); font-size: 12px; }
</style>
