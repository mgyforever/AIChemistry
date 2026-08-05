import { tool } from 'langchain/tools'
import { z } from 'zod'
import {
  ProjectDao,
  ProjectDocumentDao,
  ReproductionDao,
  ExperimentDao,
  PaperDao,
  PredictionDao,
  DocumentDao
} from '../../database/dao'
import { readDocument } from '../../files/reader'
import { parseDocumentFigures } from '../../files/figures'
import { searchWeb } from '../tools/web-tools'
import { addProjectSummaries, searchProjectSummaries } from './summaries'
import {
  extractDocument,
  analyzeCompliance,
  suggestOptimizations,
  analyzeVariableEffects,
  predictExperiment,
  generatePaper
} from './pipeline'
import { gaugeChart, barChart, radarChart, withCharts } from './charts'
import type {
  ChartSpec,
  ComplianceAnalysis,
  ConcernCategory,
  DocumentImportResult,
  ExperimentVariable,
  ProjectContext,
  StepConditions,
  VariableEffect
} from '../type'

/**
 * 实验复现 Agent 工具集（14 个）
 * 全部为 main 进程内实现，仅由工作台页面经 ai:experiment-* 触发
 */

// ==================== 公共辅助 ====================

function fmtProjectList(): string {
  const list = ProjectDao.findAll()
  if (list.length === 0) return '暂无项目。'
  return (
    '| ID | 名称 | 状态 | 更新时间 |\n|---|---|---|---|\n' +
    list.map((p) => `| ${p.id} | ${p.name} | ${p.status} | ${p.updated_at} |`).join('\n')
  )
}

function getContext(projectId: number): ProjectContext | null {
  const project = ProjectDao.findById(projectId)
  if (!project) return null
  return {
    project,
    documents: ProjectDocumentDao.findByProject(projectId),
    materials: ReproductionDao.materials(projectId),
    steps: ReproductionDao.steps(projectId),
    instruments: ReproductionDao.instruments(projectId),
    concerns: ReproductionDao.concerns(projectId),
    reactions: ReproductionDao.reactions(projectId),
    characterizations: ReproductionDao.characterizations(projectId),
    gaps: ReproductionDao.gaps(projectId),
    assessment: ReproductionDao.assessment(projectId) ?? null,
    phases: ExperimentDao.phases(projectId),
    records: ExperimentDao.records(projectId),
    customData: ExperimentDao.customData(projectId),
    predictions: PredictionDao.findByProject(projectId),
    papers: PaperDao.findByProject(projectId),
    summaries: []
  }
}

/** 结构化条件 → 友好文本，如 {temperature:'80°C',time:'2h'} → "温度 80°C · 时间 2h" */
function fmtConditions(cond: StepConditions | undefined | null): string {
  if (!cond) return ''
  const labels: Record<string, string> = {
    temperature: '温度',
    time: '时间',
    atmosphere: '气氛',
    pressure: '压强',
    stirring: '搅拌',
    ph: 'pH',
    other: '其他'
  }
  const parts: string[] = []
  for (const [key, value] of Object.entries(cond)) {
    if (value === undefined || value === null || String(value).trim() === '') continue
    const label = labels[key] ?? key
    parts.push(`${label} ${String(value)}`)
  }
  return parts.join(' · ')
}

function fmtContext(ctx: ProjectContext): string {
  const lines: string[] = []
  lines.push(`## 项目：${ctx.project.name}（${ctx.project.status}）`)
  lines.push(`${ctx.project.description || ''}`)
  if (ctx.assessment) {
    lines.push(
      `**复现难度**: ${ctx.assessment.difficulty_score}/100 ｜ **可行性**: ${ctx.assessment.feasibility}`
    )
  }
  lines.push('')
  if (ctx.materials.length) {
    lines.push('### 材料清单')
    lines.push('| 名称 | 化学式 | 用量 | 纯度 | 用途 |')
    lines.push('|---|---|---|---|---|')
    ctx.materials.forEach((m) =>
      lines.push(`| ${m.name} | ${m.formula} | ${m.quantity} | ${m.purity} | ${m.purpose} |`)
    )
  }
  if (ctx.reactions.length) {
    lines.push('')
    lines.push('### 反应方程式')
    ctx.reactions.forEach((r) =>
      lines.push(`- ${r.equation}${r.type ? `（${r.type}）` : ''}${r.purpose ? ` — ${r.purpose}` : ''}`)
    )
  }
  if (ctx.steps.length) {
    lines.push('')
    lines.push('### 实验步骤')
    ctx.steps.forEach((s) => {
      const cond = fmtConditions(s.conditions)
      lines.push(`${s.step_no}. **${s.title}** — ${s.description}${cond ? `（条件: ${cond}）` : ''}`)
    })
  }
  if (ctx.instruments.length) {
    lines.push('')
    lines.push('### 仪器')
    lines.push(ctx.instruments.map((i) => `${i.name}（${i.specification}）`).join('、'))
  }
  if (ctx.characterizations.length) {
    lines.push('')
    lines.push('### 表征/分析方法')
    ctx.characterizations.forEach((c) =>
      lines.push(
        `- 【${c.target || '—'}】${c.method}${c.conditions ? `（条件: ${c.conditions}）` : ''}${c.expected ? ` → 预期: ${c.expected}` : ''}`
      )
    )
  }
  if (ctx.concerns.length) {
    lines.push('')
    lines.push('### 注意事项')
    ctx.concerns.forEach((c) => lines.push(`- [${c.risk_level}] ${c.content}（应对: ${c.solution}）`))
  }
  if (ctx.gaps.length) {
    lines.push('')
    lines.push('### 信息缺口（文献未说明，复现时需假设/确认）')
    ctx.gaps.forEach((g) =>
      lines.push(`- [${g.category}] ${g.content}${g.impact ? `（影响: ${g.impact}）` : ''}${g.assumption ? ` → 假设: ${g.assumption}` : ''}`)
    )
  }
  if (ctx.phases.length) {
    lines.push('')
    lines.push('### 实验阶段')
    ctx.phases.forEach((p) => {
      let metrics = ''
      try {
        const arr = JSON.parse(p.metrics_json || '[]') as Array<{ name?: string; target?: string }>
        if (arr.length) metrics = `（指标: ${arr.map((m) => `${m.name ?? ''} ${m.target ?? ''}`).join('、')}）`
      } catch {
        /* 忽略 */
      }
      lines.push(`- ${p.phase_order}. ${p.name}（${p.status}）${metrics}`)
    })
  }
  if (ctx.records.length) {
    lines.push('')
    lines.push('### 记录与现象')
    ctx.records.forEach((r) =>
      lines.push(
        `- ${r.name}（${r.record_type}）符合度 ${r.compliance_percent ?? 'N/A'}% — ${r.cause_analysis.slice(0, 120)}`
      )
    )
  }
  if (ctx.customData.length) {
    lines.push('')
    lines.push('### 自定义数据')
    ctx.customData.forEach((d) => lines.push(`- ${d.data_name}: ${d.data_value}${d.unit ? ' ' + d.unit : ''}（${d.data_type}）`))
  }
  if (ctx.predictions.length) {
    lines.push('')
    lines.push('### 历史预测实验')
    ctx.predictions.forEach((p) => lines.push(`- ${p.name}：${p.predicted_result.slice(0, 100)}`))
  }
  return lines.join('\n')
}

function fmtVariables(variables: ExperimentVariable[]): string {
  return variables
    .map(
      (v) =>
        `- **${v.name}** (key=${v.key}, type=${v.type}): 当前值 ${v.value}${v.unit}${v.options ? '，可选 ' + v.options.join('/') : ''}${v.min !== undefined ? `，范围 ${v.min}~${v.max}${v.unit}` : ''} — ${v.description}`
    )
    .join('\n')
}

/** 从步骤条件中推导可调变量（尽可能多） */
function deriveVariables(ctx: ProjectContext): ExperimentVariable[] {
  const variables: ExperimentVariable[] = []
  const conditions = ctx.steps.map((s) => s.conditions ?? {})
  const temp = conditions.map((c) => parseFloat(c.temperature ?? '')).filter(Number.isFinite)
  if (temp.length) {
    const base = temp[0]
    variables.push({
      key: 'temperature',
      name: '反应温度',
      type: 'temperature',
      value: base,
      unit: '°C',
      min: Math.max(0, base - 60),
      max: base + 80,
      step: 5,
      description: '升高温度通常加快反应速率（阿伦尼乌斯方程），但可能促进副反应、降低选择性'
    })
  }
  const time = conditions.map((c) => parseFloat(c.time ?? '')).filter(Number.isFinite)
  if (time.length) {
    const base = time[0]
    variables.push({
      key: 'time',
      name: '反应时间',
      type: 'time',
      value: base,
      unit: 'h',
      min: 0.25,
      max: Math.max(base * 3, 2),
      step: 0.25,
      description: '延长反应时间可能提高转化率，但过长可能导致产物分解或副反应'
    })
  }
  const atmosphere = conditions.map((c) => c.atmosphere ?? c.other ?? '').filter(Boolean)
  if (atmosphere.length) {
    variables.push({
      key: 'atmosphere',
      name: '反应气氛',
      type: 'atmosphere',
      value: atmosphere[0],
      unit: '',
      options: ['N2', 'Ar', '空气', 'H2', 'CO2'],
      description: '惰性气氛可防止氧化或水敏反应；还原/氧化气氛改变反应路径'
    })
  }
  // 通用可调变量（尽量覆盖）
  variables.push(
    {
      key: 'stirring',
      name: '搅拌速度',
      type: 'stirring',
      value: 300,
      unit: 'rpm',
      min: 0,
      max: 1000,
      step: 50,
      description: '影响传质与混合均匀度，对多相反应影响显著'
    },
    {
      key: 'concentration',
      name: '反应物浓度',
      type: 'concentration',
      value: 0.5,
      unit: 'mol/L',
      min: 0.05,
      max: 2,
      step: 0.05,
      description: '浓度影响反应速率与平衡位置（质量作用定律）'
    },
    {
      key: 'catalyst',
      name: '催化剂',
      type: 'catalyst',
      value: '—',
      unit: '',
      options: ['—', 'Pd/C', 'Pt', 'Ni', '酸', '碱', '酶'],
      description: '催化剂降低活化能、改变选择性；更换催化剂可能显著改变产物分布'
    }
  )
  return variables
}

// ==================== 查询工具 ====================

export const listProjectsTool = tool(
  async () => {
    console.log('[ExperimentTools] list_projects 开始')
    const result = fmtProjectList()
    console.log('[ExperimentTools] list_projects 完成:', { resultLen: result.length })
    return result
  },
  {
    name: 'list_projects',
    description: '列出所有实验项目（ID/名称/状态/更新时间）。用于了解当前有哪些项目。',
    schema: z.object({})
  }
)

export const getProjectTool = tool(
  async ({ name, project_id }: { name?: string; project_id?: number }) => {
    console.log('[ExperimentTools] get_project 开始:', { name: name ?? null, project_id: project_id ?? null })
    let project = project_id ? ProjectDao.findById(project_id) : undefined
    if (!project && name) project = ProjectDao.findByName(name)
    if (!project) {
      console.log('[ExperimentTools] get_project 未找到项目:', { name, project_id })
      return '未找到该项目，请先用 list_projects 查看项目列表。'
    }
    const ctx = getContext(project.id)
    if (!ctx) {
      console.warn('[ExperimentTools] get_project 项目数据异常:', project.id)
      return '项目数据异常。'
    }
    // 向量语义召回补充
    const summaries = await searchProjectSummaries(project.name, 5, project.id)
    let text = fmtContext(ctx)
    if (summaries.length) text += `\n\n### 语义召回摘要\n${summaries.map((s) => `- ${s}`).join('\n')}`
    console.log('[ExperimentTools] get_project 完成:', {
      projectId: project.id,
      resultLen: text.length,
      summaryCount: summaries.length
    })
    return text
  },
  {
    name: 'get_project',
    description:
      '按名称或 ID 获取项目最新全量上下文（材料/步骤/仪器/注意事项/阶段/记录/自定义数据/预测/论文 + 向量召回摘要）。' +
      '用户提到某个项目时，必须先调用本工具获取最新数据。',
    schema: z.object({
      name: z.string().optional().describe('项目名称'),
      project_id: z.number().optional().describe('项目 ID')
    })
  }
)

export const searchProjectKnowledgeTool = tool(
  async ({ query }: { query: string }) => {
    console.log('[ExperimentTools] search_project_knowledge 开始:', { query: query.slice(0, 100) })
    const summaries = await searchProjectSummaries(query, 6, null)
    if (!summaries.length) {
      console.log('[ExperimentTools] search_project_knowledge 无召回')
      return '未召回相关知识摘要。'
    }
    const result = summaries.map((s, i) => `【${i + 1}】${s}`).join('\n\n')
    console.log('[ExperimentTools] search_project_knowledge 完成:', { count: summaries.length })
    return result
  },
  {
    name: 'search_project_knowledge',
    description: '跨项目语义检索实验内容摘要（向量召回）。用于模糊回忆某项目的关键信息。',
    schema: z.object({ query: z.string().describe('检索关键词/问题') })
  }
)

// ==================== 文档工具 ====================

export const importDocumentsTool = tool(
  async ({ paths, title }: { paths: string[]; title?: string }) => {
    console.log('[ExperimentTools] import_documents 开始:', { pathCount: paths.length, title: title ?? null })
    const results: DocumentImportResult[] = []
    for (const p of paths) {
      try {
        const doc = await readDocument(p)
        const { id } = DocumentDao.create(title || doc.title, doc.content, JSON.stringify({ sourcePath: p }))
        const figureCount = await parseDocumentFigures(id, doc.images, doc.tables)
        results.push({ documentId: id, title: title || doc.title, contentLength: doc.content.length, figureCount })
      } catch (err) {
        console.error('[Tools] 文献导入失败:', p, err)
      }
    }
    if (!results.length) {
      console.warn('[ExperimentTools] import_documents 全部失败')
      return '文献导入失败，请检查文件格式（支持 pdf/txt/md）。'
    }
    const result =
      '文献导入成功：\n' +
      results.map((r) => `- ${r.title}（docId=${r.documentId}，${r.contentLength} 字符，图表 ${r.figureCount} 张）`).join('\n') +
      '\n\n接下来请调用 parse_documents_into_project 将文献解析到用户当前选中的项目（不要新建项目）。'
    console.log('[ExperimentTools] import_documents 完成:', { successCount: results.length })
    return result
  },
  {
    name: 'import_documents',
    description:
      '导入文献文件（pdf/txt/md），解析文本与图表并入库。' +
      '传入文件的绝对路径数组。图表会通过 DeepSeek-VL2 识别（未配置时 OCR+人工兜底）。',
    schema: z.object({
      paths: z.array(z.string()).describe('文件绝对路径数组'),
      title: z.string().optional().describe('自定义文档标题（缺省用文件名）')
    })
  }
)

export const createProjectFromDocumentsTool = tool(
  async ({ project_name, document_ids }: { project_name: string; document_ids: number[] }) => {
    console.log('[ExperimentTools] create_project_from_documents 开始:', {
      project_name,
      docCount: document_ids.length
    })
    if (ProjectDao.findByName(project_name)) return `项目"${project_name}"已存在，请换一个名称。`
    const docs = document_ids
      .map((id) => DocumentDao.findById(id))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
    if (!docs.length) {
      console.log('[ExperimentTools] create_project_from_documents 未找到文献')
      return '未找到对应文献，请先 import_documents 导入。'
    }

    const joined = docs.map((d) => d.content).join('\n\n')
    let extraction
    try {
      extraction = await extractDocument(joined)
    } catch (err) {
      console.error('[ExperimentTools] 文献解析失败:', err)
      return `文献解析失败: ${err instanceof Error ? err.message : String(err)}`
    }

    const { id: projectId } = ProjectDao.create(project_name, extraction.principle.slice(0, 500), extraction.summary)
    docs.forEach((d) => ProjectDocumentDao.create(projectId, d.id, 'source'))

    // 复现方案入库
    extraction.materials.forEach((m) => ReproductionDao.addMaterial(projectId, m))
    extraction.steps.forEach((s) => ReproductionDao.addStep(projectId, s))
    extraction.instruments.forEach((i) => ReproductionDao.addInstrument(projectId, i))
    extraction.characterizations.forEach((c) => ReproductionDao.addCharacterization(projectId, c))
    extraction.concerns.forEach((c) => ReproductionDao.addConcern(projectId, c))
    extraction.reactions.forEach((r) => ReproductionDao.addReaction(projectId, r))
    extraction.gaps.forEach((g) => ReproductionDao.addGap(projectId, g))
    ReproductionDao.upsertAssessment(projectId, extraction.assessment)

    // 实验阶段（含量化指标）
    extraction.phases.forEach((p, i) =>
      ExperimentDao.addPhase(projectId, p.name, p.expected, i + 1, JSON.stringify(p.metrics ?? []))
    )
    // 激活第一个阶段（进行中）
    const firstPhase = ExperimentDao.phases(projectId)[0]
    if (firstPhase) ExperimentDao.updatePhase(firstPhase.id, { status: 'in_progress' })

    // 向量摘要
    await addProjectSummaries(projectId, [
      { text: extraction.summary, source: 'document' },
      ...extraction.steps.map((s) => ({ text: `${s.step_no}. ${s.title}: ${s.description}`, source: 'step' as const }))
    ])

    // 图表：难度雷达 + 材料配比
    const charts: ChartSpec[] = []
    const materialNames = extraction.materials.slice(0, 8).map((m) => m.name)
    if (materialNames.length) {
      charts.push(
        barChart(
          'materials',
          '材料/试剂用量概览',
          materialNames,
          [{ name: '用量指数', data: extraction.materials.slice(0, 8).map(() => 1) }]
        )
      )
    }
    charts.push(
      radarChart(
        'difficulty',
        '复现难度多维评估',
        ['原料可得性', '操作难度', '仪器要求', '安全性', '时长'],
        [{ name: '评估', data: [70, extraction.assessment.difficulty_score, 60, 50, 55] }]
      )
    )

    const lines: string[] = []
    lines.push(`项目"${project_name}"已创建（ID=${projectId}）。`)
    lines.push(`**实验原理**: ${extraction.principle.slice(0, 300)}`)
    lines.push(`**复现难度**: ${extraction.assessment.difficulty_score}/100（${extraction.assessment.feasibility}）`)
    lines.push(
      `**材料 ${extraction.materials.length} 种 / 反应 ${extraction.reactions.length} 个 / 步骤 ${extraction.steps.length} 步 / 仪器 ${extraction.instruments.length} 件 / 表征 ${extraction.characterizations.length} 项 / 注意事项 ${extraction.concerns.length} 条 / 信息缺口 ${extraction.gaps.length} 处`
    )
    lines.push(`**阶段划分**: ${extraction.phases.map((p) => p.name).join(' → ')}`)
    if (extraction.gaps.length) {
      lines.push(`> ⚠️ **信息缺口 ${extraction.gaps.length} 处**：文献未说明的部分（如搅拌速度、部分条件），复现时将以假设执行，请用户留意并补充确认。`)
    }
    lines.push('复现方案已存入数据库，可随时 get_project 查看最新数据。')
    const result = withCharts(lines.join('\n'), charts)
    console.log('[ExperimentTools] create_project_from_documents 完成:', {
      projectId,
      materialCount: extraction.materials.length,
      stepCount: extraction.steps.length
    })
    return result
  },
  {
    name: 'create_project_from_documents',
    description:
      '从已导入的文献（document_ids）创建实验项目：抽取实验原理、材料、反应方程式、步骤、仪器、表征方法、注意事项、信息缺口、难度评估、阶段划分（含量化指标），' +
      '写入复现方案表并生成向量摘要。所有信息仅来自文献，文献未说明的列为信息缺口。用户上传文献后调用。',
    schema: z.object({
      project_name: z.string().describe('项目名称（用户可自定义）'),
      document_ids: z.array(z.number()).describe('已导入文献的 document_id 数组')
    })
  }
)

// ==================== 写入工具 ====================

/** 文献解析到项目的结果（文本 + 图表，供 IPC 直接返回前端渲染） */
export interface ParseDocumentsResult {
  text: string
  charts: ChartSpec[]
}

/**
 * 将文献解析到【当前已有项目】并生成复现方案（不新建项目）。
 * 供 agent 工具与前端上传后自动解析两条路径复用。
 */
export async function parseDocumentsIntoProject(
  projectId: number,
  documentIds: number[]
): Promise<ParseDocumentsResult> {
  if (!ProjectDao.findById(projectId)) throw new Error(`项目 ${projectId} 不存在，请先创建项目。`)
  const docs = documentIds
    .map((id) => DocumentDao.findById(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
  if (!docs.length) throw new Error('未找到对应文献，请先导入文献。')

  // 关联文献到当前项目（已关联则跳过）
  for (const d of docs) {
    const linked = ProjectDocumentDao.findByProject(projectId).some((pd) => pd.document_id === d.id)
    if (!linked) ProjectDocumentDao.create(projectId, d.id, 'source')
  }

  const joined = docs.map((d) => d.content).join('\n\n')
  const extraction = await extractDocument(joined)

  // 解析结果为空时拒绝覆盖，保护已存在的方案（避免 LLM 偶发失败清空数据）
  const isEmpty =
    (Array.isArray(extraction.materials) ? extraction.materials.length : 0) +
      (Array.isArray(extraction.reactions) ? extraction.reactions.length : 0) +
      (Array.isArray(extraction.steps) ? extraction.steps.length : 0) +
      (Array.isArray(extraction.instruments) ? extraction.instruments.length : 0) +
      (Array.isArray(extraction.characterizations) ? extraction.characterizations.length : 0) +
      (Array.isArray(extraction.concerns) ? extraction.concerns.length : 0) +
      (Array.isArray(extraction.gaps) ? extraction.gaps.length : 0) ===
    0
  if (isEmpty) {
    throw new Error('文献解析结果为空，未写入任何数据（可能是文献文本层缺失或模型抽取失败）。')
  }

  // 覆盖式写入复现方案到当前项目
  ReproductionDao.clearMaterials(projectId)
  ReproductionDao.clearSteps(projectId)
  ReproductionDao.clearInstruments(projectId)
  ReproductionDao.clearConcerns(projectId)
  ReproductionDao.clearReactions(projectId)
  ReproductionDao.clearCharacterizations(projectId)
  ReproductionDao.clearGaps(projectId)
  extraction.materials.forEach((m) => ReproductionDao.addMaterial(projectId, m))
  extraction.steps.forEach((s) => ReproductionDao.addStep(projectId, s))
  extraction.instruments.forEach((i) => ReproductionDao.addInstrument(projectId, i))
  extraction.characterizations.forEach((c) => ReproductionDao.addCharacterization(projectId, c))
  extraction.concerns.forEach((c) => ReproductionDao.addConcern(projectId, c))
  extraction.reactions.forEach((r) => ReproductionDao.addReaction(projectId, r))
  extraction.gaps.forEach((g) => ReproductionDao.addGap(projectId, g))
  ReproductionDao.upsertAssessment(projectId, extraction.assessment)

  // 实验阶段（覆盖旧阶段，含量化指标）
  ExperimentDao.phases(projectId).forEach((p) => ExperimentDao.deletePhase(p.id))
  extraction.phases.forEach((p, i) =>
    ExperimentDao.addPhase(projectId, p.name, p.expected, i + 1, JSON.stringify(p.metrics ?? []))
  )
  // 激活第一个阶段（进行中），便于阶段与记录页顺序推进
  const firstPhase = ExperimentDao.phases(projectId)[0]
  if (firstPhase) ExperimentDao.updatePhase(firstPhase.id, { status: 'in_progress' })

  // 更新项目摘要
  ProjectDao.update(projectId, { summary: extraction.summary })

  // 向量摘要
  await addProjectSummaries(projectId, [
    { text: extraction.summary, source: 'document' },
    ...extraction.steps.map((s) => ({ text: `${s.step_no}. ${s.title}: ${s.description}`, source: 'step' as const }))
  ])

  // 图表：难度雷达 + 材料配比
  const charts: ChartSpec[] = []
  const materialNames = extraction.materials.slice(0, 8).map((m) => m.name)
  if (materialNames.length) {
    charts.push(
      barChart(
        'materials',
        '材料/试剂用量概览',
        materialNames,
        [{ name: '用量指数', data: extraction.materials.slice(0, 8).map(() => 1) }]
      )
    )
  }
  charts.push(
    radarChart(
      'difficulty',
      '复现难度多维评估',
      ['原料可得性', '操作难度', '仪器要求', '安全性', '时长'],
      [{ name: '评估', data: [70, extraction.assessment.difficulty_score, 60, 50, 55] }]
    )
  )

  const lines: string[] = []
  lines.push(`已在项目"${ProjectDao.findById(projectId)?.name ?? projectId}"中生成复现方案。`)
  lines.push(`**实验原理**: ${extraction.principle.slice(0, 300)}`)
  lines.push(`**复现难度**: ${extraction.assessment.difficulty_score}/100（${extraction.assessment.feasibility}）`)
  lines.push(
    `**材料 ${extraction.materials.length} 种 / 反应 ${extraction.reactions.length} 个 / 步骤 ${extraction.steps.length} 步 / 仪器 ${extraction.instruments.length} 件 / 表征 ${extraction.characterizations.length} 项 / 注意事项 ${extraction.concerns.length} 条 / 信息缺口 ${extraction.gaps.length} 处`
  )
  lines.push(`**阶段划分**: ${extraction.phases.map((p) => p.name).join(' → ')}`)
  if (extraction.gaps.length) {
    lines.push(`> ⚠️ **信息缺口 ${extraction.gaps.length} 处**：文献未说明的部分（如搅拌速度、部分条件），复现时将以假设执行，请用户留意并补充确认。`)
  }
  lines.push('方案已存入数据库，可让用户在「复现方案」页查看。如有需要，请用户提出修改建议，我会用 update_reproduction_plan 调整。')

  return { text: lines.join('\n'), charts }
}

/**
 * 将文献解析到【当前已有项目】并生成复现方案（不新建项目）。
 * 供用户先建项目→上传文献的工作流使用。
 */
export const parseDocumentsIntoProjectTool = tool(
  async ({ project_id, document_ids }: { project_id: number; document_ids: number[] }) => {
    try {
      const result = await parseDocumentsIntoProject(project_id, document_ids)
      return withCharts(result.text, result.charts)
    } catch (err) {
      console.error('[ExperimentTools] parse_documents_into_project 失败:', err)
      return `文献解析失败: ${err instanceof Error ? err.message : String(err)}`
    }
  },
  {
    name: 'parse_documents_into_project',
    description:
      '将已导入的文献（document_ids）解析到【当前已有项目】（project_id），生成/覆盖复现方案：材料、步骤、仪器、注意事项、难度评估、阶段划分，并写入向量摘要。' +
      '【不要新建项目】。用户先创建项目再上传文献后调用。',
    schema: z.object({
      project_id: z.number().describe('目标项目 ID（用户当前选中的项目）'),
      document_ids: z.array(z.number()).describe('已导入文献的 document_id 数组')
    })
  }
)

/** 按用户建议修改复现方案（材料/反应/步骤/仪器/表征/注意事项/信息缺口/难度评估） */
export const updateReproductionPlanTool = tool(
  async (input: {
    project_id: number
    materials?: Array<{ name: string; formula?: string; cas?: string; quantity?: string; purity?: string; purpose?: string; notes?: string }>
    reactions?: Array<{ equation: string; type?: string; purpose?: string; notes?: string }>
    steps?: Array<{ step_no: number; title?: string; description: string; conditions?: string | Record<string, string>; duration?: string; notes?: string }>
    instruments?: Array<{ name: string; specification?: string; purpose?: string; notes?: string }>
    characterizations?: Array<{ target?: string; method: string; conditions?: string; expected?: string; notes?: string }>
    concerns?: Array<{ category?: string; content: string; risk_level?: string; solution?: string }>
    gaps?: Array<{ category?: string; content: string; impact?: string; assumption?: string }>
    assessment?: { difficulty_score: number; feasibility: string; analysis: string; risk_points: string }
  }) => {
    if (!ProjectDao.findById(input.project_id)) return `项目 ${input.project_id} 不存在。`

    const changed: string[] = []
    if (input.materials !== undefined) {
      ReproductionDao.clearMaterials(input.project_id)
      input.materials.forEach((m) => ReproductionDao.addMaterial(input.project_id, m))
      changed.push(`材料(${input.materials.length})`)
    }
    if (input.reactions !== undefined) {
      ReproductionDao.clearReactions(input.project_id)
      input.reactions.forEach((r) => ReproductionDao.addReaction(input.project_id, r))
      changed.push(`反应(${input.reactions.length})`)
    }
    if (input.steps !== undefined) {
      ReproductionDao.clearSteps(input.project_id)
      input.steps.forEach((s) => ReproductionDao.addStep(input.project_id, s))
      changed.push(`步骤(${input.steps.length})`)
    }
    if (input.instruments !== undefined) {
      ReproductionDao.clearInstruments(input.project_id)
      input.instruments.forEach((i) => ReproductionDao.addInstrument(input.project_id, i))
      changed.push(`仪器(${input.instruments.length})`)
    }
    if (input.characterizations !== undefined) {
      ReproductionDao.clearCharacterizations(input.project_id)
      input.characterizations.forEach((c) => ReproductionDao.addCharacterization(input.project_id, c))
      changed.push(`表征(${input.characterizations.length})`)
    }
    if (input.concerns !== undefined) {
      ReproductionDao.clearConcerns(input.project_id)
      input.concerns.forEach((c) =>
        ReproductionDao.addConcern(input.project_id, {
          ...c,
          category: (c.category ?? 'operation') as ConcernCategory
        })
      )
      changed.push(`注意事项(${input.concerns.length})`)
    }
    if (input.gaps !== undefined) {
      ReproductionDao.clearGaps(input.project_id)
      input.gaps.forEach((g) => ReproductionDao.addGap(input.project_id, g))
      changed.push(`信息缺口(${input.gaps.length})`)
    }
    if (input.assessment !== undefined) {
      ReproductionDao.upsertAssessment(input.project_id, input.assessment)
      changed.push('难度评估')
    }
    if (!changed.length) return '未提供需要修改的内容。'

    // 增量更新向量摘要
    const steps = input.steps ?? []
    if (steps.length) {
      await addProjectSummaries(input.project_id, [
        ...steps.map((s) => ({ text: `${s.step_no}. ${s.title}: ${s.description}`, source: 'step' as const }))
      ])
    }

    return `已根据您的建议修改复现方案：${changed.join('、')}。可在「复现方案」页确认，无误后点击确认进入「阶段与记录」。`
  },
  {
    name: 'update_reproduction_plan',
    description:
      '根据用户的修改建议，更新当前项目的复现方案（材料/反应方程式/步骤/仪器/表征方法/注意事项/信息缺口/难度评估）。' +
      '用户提出任何方案修改意见时调用，传入用户认可的完整新数组（会覆盖对应部分）。',
    schema: z.object({
      project_id: z.number().describe('项目 ID'),
      materials: z
        .array(
          z.object({
            name: z.string(),
            formula: z.string().optional(),
            cas: z.string().optional(),
            quantity: z.string().optional(),
            purity: z.string().optional(),
            purpose: z.string().optional(),
            notes: z.string().optional()
          })
        )
        .optional()
        .describe('完整材料清单（覆盖旧数据）'),
      reactions: z
        .array(
          z.object({
            equation: z.string(),
            type: z.string().optional(),
            purpose: z.string().optional(),
            notes: z.string().optional()
          })
        )
        .optional()
        .describe('完整反应方程式清单（覆盖旧数据）'),
      steps: z
        .array(
          z.object({
            step_no: z.number(),
            title: z.string().optional(),
            description: z.string(),
            conditions: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
            duration: z.string().optional(),
            notes: z.string().optional()
          })
        )
        .optional()
        .describe('完整步骤清单（覆盖旧数据）'),
      instruments: z
        .array(
          z.object({
            name: z.string(),
            specification: z.string().optional(),
            purpose: z.string().optional(),
            notes: z.string().optional()
          })
        )
        .optional()
        .describe('完整仪器清单（覆盖旧数据）'),
      characterizations: z
        .array(
          z.object({
            target: z.string().optional(),
            method: z.string(),
            conditions: z.string().optional(),
            expected: z.string().optional(),
            notes: z.string().optional()
          })
        )
        .optional()
        .describe('完整表征/分析方法清单（覆盖旧数据）'),
      concerns: z
        .array(
          z.object({
            category: z.string().optional(),
            content: z.string(),
            risk_level: z.string().optional(),
            solution: z.string().optional()
          })
        )
        .optional()
        .describe('完整注意事项清单（覆盖旧数据）'),
      gaps: z
        .array(
          z.object({
            category: z.string().optional(),
            content: z.string(),
            impact: z.string().optional(),
            assumption: z.string().optional()
          })
        )
        .optional()
        .describe('完整信息缺口清单（覆盖旧数据）'),
      assessment: z
        .object({
          difficulty_score: z.number(),
          feasibility: z.string(),
          analysis: z.string(),
          risk_points: z.string()
        })
        .optional()
        .describe('难度与可行性评估')
    })
  }
)

export const addExperimentPhaseTool = tool(
  async ({ project_id, name, expected }: { project_id: number; name: string; expected?: string }) => {
    console.log('[ExperimentTools] add_experiment_phase 开始:', { project_id, name })
    if (!ProjectDao.findById(project_id)) {
      console.log('[ExperimentTools] add_experiment_phase 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }
    const { id } = ExperimentDao.addPhase(project_id, name, expected ?? '', undefined)
    const result = `阶段"${name}"已添加（phaseId=${id}）。`
    console.log('[ExperimentTools] add_experiment_phase 完成:', { phaseId: id })
    return result
  },
  {
    name: 'add_experiment_phase',
    description: '为项目新增实验阶段（名称 + 预期结果）。',
    schema: z.object({
      project_id: z.number(),
      name: z.string().describe('阶段名称，如"阶段3-后处理"'),
      expected: z.string().optional().describe('该阶段预期结果')
    })
  }
)

/** 保存实验记录入参（供表单/IPC 与 agent 工具共用） */
export interface SaveRecordInput {
  project_id: number
  phase_id?: number
  name: string
  content: string
  data_json?: Record<string, unknown>
}

/** 保存实验记录结果（文本 + 图表 + 符合度） */
export interface SaveRecordResult {
  text: string
  charts: ChartSpec[]
  compliance: ComplianceAnalysis
  recordId: number
}

/**
 * 保存阶段实验记录/现象并自动分析符合度（主界面表单与 agent 工具共用）。
 * 返回友好文本与图表，不抛错则代表已落库。
 */
export async function saveExperimentRecordWithAnalysis(
  input: SaveRecordInput
): Promise<SaveRecordResult> {
  console.log('[ExperimentTools] save_record_with_analysis 开始:', {
    project_id: input.project_id,
    phase_id: input.phase_id ?? null,
    name: input.name,
    contentLen: input.content.length
  })
  const ctx = getContext(input.project_id)
  if (!ctx) throw new Error(`项目 ${input.project_id} 不存在。`)

  // 计算符合度（缺省时由管线自动计算）
  const phase = input.phase_id ? ExperimentDao.phaseById(input.phase_id) : undefined
  const compliance = await analyzeCompliance(phase?.expected ?? '', input.content)

  const { id: recordId } = ExperimentDao.addRecord(input.project_id, {
    phase_id: input.phase_id,
    record_type: 'phase',
    name: input.name,
    content: input.content,
    data_json: input.data_json ? JSON.stringify(input.data_json) : '{}',
    expected: compliance.expected,
    compliance_percent: compliance.compliance_percent,
    is_expected: compliance.is_expected ? 1 : 0,
    cause_analysis: compliance.cause_analysis,
    detail: compliance.detail
  })

  // 增量更新向量摘要
  await addProjectSummaries(input.project_id, [
    { text: `${input.name}: ${input.content.slice(0, 500)}`, source: 'record' }
  ])

  const charts: ChartSpec[] = [
    gaugeChart('compliance', '符合预期程度', compliance.compliance_percent),
    barChart(
      'compare',
      '符合度对比',
      ['实际符合度', '完全符合'],
      [{ name: '百分比', data: [compliance.compliance_percent, 100] }]
    )
  ]

  const lines: string[] = []
  lines.push(`记录"${input.name}"已保存（符合预期: ${compliance.is_expected ? '是' : '否'}）。`)
  lines.push(`**符合度**: ${compliance.compliance_percent}%`)
  lines.push(`**标准结果参考**: ${compliance.expected}`)
  lines.push(`**原因分析**: ${compliance.cause_analysis}`)
  lines.push(`**实验细节**: ${compliance.detail}`)
  console.log('[ExperimentTools] save_record_with_analysis 完成:', {
    recordId,
    compliancePercent: compliance.compliance_percent
  })
  return { text: lines.join('\n'), charts, compliance, recordId }
}

export const saveExperimentRecordTool = tool(
  async (input: SaveRecordInput) => {
    try {
      const result = await saveExperimentRecordWithAnalysis(input)
      return withCharts(result.text, result.charts)
    } catch (err) {
      console.error('[ExperimentTools] save_experiment_record 失败:', err)
      return `保存记录失败: ${err instanceof Error ? err.message : String(err)}`
    }
  },
  {
    name: 'save_experiment_record',
    description:
      '保存阶段实验记录或实验现象：分析符合预期百分比、给出标准结果参考与原因分析（具体到化学式），并落库 + 更新向量摘要。' +
      '用户上传某阶段数据后调用。现象记录名称可由用户自定义。',
    schema: z.object({
      project_id: z.number(),
      phase_id: z.number().optional(),
      name: z.string().describe('记录/现象名称，如"实验现象1-黄色沉淀"'),
      content: z.string().describe('用户上传的数据原文（Markdown，含化学式）'),
      data_json: z.record(z.string(), z.unknown()).optional().describe('结构化数据')
    })
  }
)

export const addCustomDataTool = tool(
  async (input: {
    project_id: number
    data_name: string
    data_type: string
    data_value: string
    unit?: string
  }) => {
    console.log('[ExperimentTools] add_custom_data 开始:', {
      project_id: input.project_id,
      data_name: input.data_name,
      data_type: input.data_type
    })
    if (!ProjectDao.findById(input.project_id)) {
      console.log('[ExperimentTools] add_custom_data 项目不存在:', input.project_id)
      return `项目 ${input.project_id} 不存在。`
    }
    const { id } = ExperimentDao.addCustomData(input.project_id, {
      data_name: input.data_name,
      data_type: input.data_type,
      data_value: input.data_value,
      unit: input.unit ?? ''
    })
    const result = `自定义数据"${input.data_name}"已保存（id=${id}，类型: ${input.data_type}）。`
    console.log('[ExperimentTools] add_custom_data 完成:', { id })
    return result
  },
  {
    name: 'add_custom_data',
    description:
      '保存用户自定义实验数据（数据名称 + 化学数据类型 + 数据内容 + 单位）。' +
      '数据类型枚举: mass/volume/concentration/yield/temperature/time/ph/color/spectrum/melting_point/boiling_point/density/viscosity/pressure/purity/observation/other。',
    schema: z.object({
      project_id: z.number(),
      data_name: z.string().describe('数据名称，用户自定义，如"主产物产率"'),
      data_type: z.string().describe('化学数据类型（见枚举）'),
      data_value: z.string().describe('数据内容，可含化学 Unicode 符号，如"82.5"或"H₂O"'),
      unit: z.string().optional().describe('单位，如 "%"、"°C"、"mol/L"')
    })
  }
)

export const updateProjectStatusTool = tool(
  async ({ project_id, status }: { project_id: number; status: 'ongoing' | 'completed' }) => {
    console.log('[ExperimentTools] update_project_status 开始:', { project_id, status })
    const project = ProjectDao.findById(project_id)
    if (!project) {
      console.log('[ExperimentTools] update_project_status 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }
    ProjectDao.update(project_id, { status })
    const result = `项目"${project.name}"状态已更新为 ${status === 'completed' ? '已完成' : '进行中'}。`
    console.log('[ExperimentTools] update_project_status 完成:', { project_id, status })
    return result
  },
  {
    name: 'update_project_status',
    description: '标记项目为完成(completed)或进行中(ongoing)。实验结束后调用。',
    schema: z.object({
      project_id: z.number(),
      status: z.enum(['ongoing', 'completed'])
    })
  }
)

// ==================== 联想与预测工具（能力⑤） ====================

export const listExperimentVariablesTool = tool(
  async ({ project_id }: { project_id: number }) => {
    console.log('[ExperimentTools] list_experiment_variables 开始:', { project_id })
    const ctx = getContext(project_id)
    if (!ctx) {
      console.log('[ExperimentTools] list_experiment_variables 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }
    const variables = deriveVariables(ctx)
    const result = `可调变量（尽可能多展示）：\n\n${fmtVariables(variables)}\n\n` +
      '用户可在前端变量面板任意修改这些变量，然后调用 run_prediction_experiment 预测结果。'
    console.log('[ExperimentTools] list_experiment_variables 完成:', { count: variables.length })
    return result
  },
  {
    name: 'list_experiment_variables',
    description:
      '列出项目中尽可能多的可调实验变量（温度/时间/浓度/配比/催化剂/气氛/搅拌/压强/pH 等）及当前值与调节范围，' +
      '供用户调整后做预测实验。',
    schema: z.object({ project_id: z.number() })
  }
)

export const suggestOptimizationsTool = tool(
  async ({ project_id }: { project_id: number }) => {
    console.log('[ExperimentTools] suggest_optimizations 开始:', { project_id })
    const ctx = getContext(project_id)
    if (!ctx) {
      console.log('[ExperimentTools] suggest_optimizations 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }
    // 知识搜索（web_search 复用，无 Key 时跳过）
    let webContext = ''
    try {
      webContext = await searchWeb(`${ctx.project.name} 化学反应 条件优化 催化剂`, 5)
    } catch {
      webContext = ''
    }
    let suggestions
    try {
      suggestions = await suggestOptimizations(fmtContext(ctx) + '\n\n【网络检索】\n' + webContext)
    } catch (err) {
      console.error('[ExperimentTools] 联想分析失败:', err)
      return `联想分析失败: ${err instanceof Error ? err.message : String(err)}`
    }
    if (!suggestions.length) {
      console.log('[ExperimentTools] suggest_optimizations 无建议')
      return '未找到更优方案的建议。'
    }
    const charts: ChartSpec[] = [
      barChart(
        'confidence',
        '优化建议置信度',
        suggestions.map((s) => s.title.slice(0, 10)),
        [{ name: '置信度', data: suggestions.map((s) => s.confidence) }]
      )
    ]
    const lines = ['## 优化建议（AI 联想）', '']
    suggestions.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.title}`)
      lines.push(`- 内容：${s.description}`)
      lines.push(`- 依据：${s.reason}`)
      lines.push(`- 置信度：${s.confidence}%${s.changedVariables?.length ? `（涉及变量: ${s.changedVariables.join(', ')}）` : ''}`)
      lines.push('')
    })
    const result = withCharts(lines.join('\n'), charts)
    console.log('[ExperimentTools] suggest_optimizations 完成:', { count: suggestions.length })
    return result
  },
  {
    name: 'suggest_optimizations',
    description:
      'AI 联想：基于项目流程与网络检索知识，判断是否存在更合理或效果更好的实验方案（催化剂/溶剂/温度/时间/后处理等），' +
      '返回带置信度的优化建议。在阶段总结或实验结束后自动调用。',
    schema: z.object({ project_id: z.number() })
  }
)

export const analyzeVariableEffectsTool = tool(
  async ({ project_id }: { project_id: number }) => {
    console.log('[ExperimentTools] analyze_variable_effects 开始:', { project_id })
    const ctx = getContext(project_id)
    if (!ctx) {
      console.log('[ExperimentTools] analyze_variable_effects 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }
    let effects: VariableEffect[]
    try {
      effects = await analyzeVariableEffects(fmtContext(ctx))
    } catch (err) {
      console.error('[ExperimentTools] 控制变量分析失败:', err)
      return `控制变量分析失败: ${err instanceof Error ? err.message : String(err)}`
    }
    if (!effects.length) {
      console.log('[ExperimentTools] analyze_variable_effects 无结果')
      return '无法生成控制变量分析。'
    }
    // 影响强度图表：每个变量影响的性质数
    const charts: ChartSpec[] = [
      barChart(
        'impact',
        '各变量对结果性质的影响',
        effects.map((e) => e.name),
        [{ name: '影响性质数', data: effects.map((e) => e.affectedProperties.length) }]
      )
    ]
    const lines = ['## 控制变量法分析（改变操作 → 结果性质变化）', '']
    effects.forEach((e, i) => {
      lines.push(`### ${i + 1}. ${e.name}（${e.direction}）`)
      lines.push(
        `- 影响：${e.affectedProperties.map((p) => `${p.property}${p.change}`).join('、')}`
      )
      lines.push(`- 机理：${e.analysis}`)
      lines.push('')
    })
    lines.push('用户可选择任一变量在预测实验中调整取值，验证预测结果。')
    const result = withCharts(lines.join('\n'), charts)
    console.log('[ExperimentTools] analyze_variable_effects 完成:', { count: effects.length })
    return result
  },
  {
    name: 'analyze_variable_effects',
    description:
      '控制变量法分析：逐一分析改变每个实验操作/变量会对结果性质（产率/纯度/选择性/速率/现象/副产物）产生什么影响，' +
      '并给出机理解释（含理论依据）。',
    schema: z.object({ project_id: z.number() })
  }
)

export const runPredictionExperimentTool = tool(
  async (input: {
    project_id: number
    flow: string
    name?: string
    variables: Array<{
      key: string
      name: string
      type: string
      value: number | string
      unit: string
      description?: string
    }>
  }) => {
    console.log('[ExperimentTools] run_prediction_experiment 开始:', {
      project_id: input.project_id,
      varCount: input.variables.length,
      name: input.name ?? null
    })
    const ctx = getContext(input.project_id)
    if (!ctx) {
      console.log('[ExperimentTools] run_prediction_experiment 项目不存在:', input.project_id)
      return `项目 ${input.project_id} 不存在。`
    }

    const variablesDesc = input.variables
      .map((v) => `- ${v.name}: ${v.value}${v.unit}`)
      .join('\n')

    let prediction
    try {
      prediction = await predictExperiment(input.flow || fmtContext(ctx), variablesDesc)
    } catch (err) {
      console.error('[ExperimentTools] 预测失败:', err)
      return `预测失败: ${err instanceof Error ? err.message : String(err)}`
    }

    const name =
      input.name ||
      `预测实验 ${new Date().toLocaleString('zh-CN', { hour12: false })}`
    PredictionDao.create({
      project_id: input.project_id,
      name,
      base_flow: (input.flow || fmtContext(ctx)).slice(0, 4000),
      variables: JSON.stringify(input.variables),
      predicted_result: prediction.predicted_result,
      property_analysis: prediction.property_analysis,
      theory_basis: prediction.theory_basis
    })

    const charts: ChartSpec[] = [
      radarChart(
        'prediction-props',
        '预测结果性质概览',
        ['产率', '纯度', '选择性', '速率', '安全性'],
        [{ name: '预测', data: [70, 70, 70, 60, 75] }]
      )
    ]
    const lines: string[] = []
    lines.push(`## ${name}（预测/未验证）`)
    lines.push('')
    lines.push(`**变量设定**:\n${variablesDesc}`)
    lines.push('')
    lines.push(`**预测结果**: ${prediction.predicted_result}`)
    lines.push('')
    lines.push(`**性质分析**: ${prediction.property_analysis}`)
    lines.push('')
    lines.push(`**理论依据**: ${prediction.theory_basis}`)
    lines.push('')
    lines.push('> 注：预测为理论推演结果，未经验证，实际需实验确认。')
    const result = withCharts(lines.join('\n'), charts)
    console.log('[ExperimentTools] run_prediction_experiment 完成:', {
      project_id: input.project_id,
      name
    })
    return result
  },
  {
    name: 'run_prediction_experiment',
    description:
      'AI 预测实验：按用户设定的变量值预测实验结果。预测必须附带理论依据（反应式/定律/公式），无依据不输出结论。' +
      '预测结果（预测/未验证）保存到预测实验记录。',
    schema: z.object({
      project_id: z.number(),
      flow: z.string().describe('基于的实验流程描述'),
      name: z.string().optional().describe('预测实验名称，缺省自动生成'),
      variables: z
        .array(
          z.object({
            key: z.string(),
            name: z.string(),
            type: z.string(),
            value: z.union([z.number(), z.string()]),
            unit: z.string(),
            description: z.string().optional()
          })
        )
        .describe('全部变量及取值（来自 list_experiment_variables）')
    })
  }
)

// ==================== 论文工具（能力④） ====================

export const generatePaperTool = tool(
  async ({ project_id }: { project_id: number }) => {
    console.log('[ExperimentTools] generate_paper 开始:', { project_id })
    const ctx = getContext(project_id)
    if (!ctx) {
      console.log('[ExperimentTools] generate_paper 项目不存在:', project_id)
      return `项目 ${project_id} 不存在。`
    }

    // 汇总真实数据（含图表识别结果）
    let context = fmtContext(ctx)
    try {
      const records = ctx.records.map((r) => `${r.name}: ${r.content}`).join('\n')
      if (records) context += `\n\n【实验记录原文】\n${records}`
    } catch {
      /* 忽略 */
    }

    let result
    try {
      result = await generatePaper(context)
    } catch (err) {
      console.error('[ExperimentTools] 论文生成失败:', err)
      return `论文生成失败: ${err instanceof Error ? err.message : String(err)}`
    }

    PaperDao.create(project_id, result.title, result.content, '[]')
    const resultText =
      `论文已生成并保存（标题: ${result.title}）。\n\n` +
      `> 提示：论文中凡标注【待人工补充】的位置，请用户核对后填入真实数据；` +
      `图表占位符 ![chart:xxx] 将在前端以 ECharts 渲染，导出时可转 PNG。\n\n` +
      result.content.slice(0, 20000)
    console.log('[ExperimentTools] generate_paper 完成:', {
      project_id,
      titleLen: result.title.length,
      contentLen: result.content.length
    })
    return resultText
  },
  {
    name: 'generate_paper',
    description:
      '生成标准论文（Markdown，含摘要/引言/材料与方法/结果与讨论/结论/参考文献）。' +
      '仅基于数据库中的真实数据，缺失部分标注【待人工补充】；图表以占位符+数据表输出。' +
      '由用户主动选择生成（可选，不强制）。',
    schema: z.object({ project_id: z.number() })
  }
)
