import { model } from '../model'
import type {
  ComplianceAnalysis,
  DocumentExtraction,
  OptimizationSuggestion,
  ReproductionAssessment,
  StepConditions,
  VariableEffect
} from '../type'

/**
 * 实验 Agent 重型管线（内部调 LLM，输出遵循 type.ts 规范）
 * - 文献抽取 → DocumentExtraction
 * - 符合度分析 → ComplianceAnalysis
 * - 联想优化建议 → OptimizationSuggestion[]
 * - 控制变量影响 → VariableEffect[]
 * - 预测实验 → { predicted_result, property_analysis, theory_basis }
 * - 论文生成 → { title, content }
 */

const JSON_PROMPT = '请只输出一个 JSON 对象，不要输出任何多余文字或 markdown 代码块标记。'

/** 调用文本模型并解析 JSON（失败抛错由调用方兜底） */
export async function callJson<T>(system: string, user: string): Promise<T> {
  const startedAt = Date.now()
  console.log('[Pipeline] callJson 开始:', {
    systemHead: system.slice(0, 60),
    inputLen: user.length
  })
  const res = await model.invoke([
    { role: 'system', content: system + '\n' + JSON_PROMPT },
    { role: 'human', content: user }
  ])
  const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
  try {
    const parsed = parseJsonStrict<T>(raw)
    console.log('[Pipeline] callJson 完成:', {
      rawLen: raw.length,
      parsed: true,
      costMs: Date.now() - startedAt
    })
    return parsed
  } catch (err) {
    console.error('[Pipeline] callJson 解析失败:', {
      rawLen: raw.length,
      costMs: Date.now() - startedAt,
      err
    })
    throw err
  }
}

/**
 * 修复 JSON 中的非法反斜杠转义。
 * 模型常把 \ce{H2O} 直接写进 JSON 字符串（\c 不是合法 JSON 转义），这里统一修复：
 * - 合法转义（\" \\ \/ \b \f \n \r \t \uXXXX）保留
 * - 其余 \x 视为字面量反斜杠，双写为 \\x
 */
function repairJsonBackslashes(raw: string): string {
  let out = ''
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch !== '\\') {
      out += ch
      i++
      continue
    }
    const next = raw[i + 1]
    if (next === undefined) {
      out += '\\\\'
      break
    }
    // \uXXXX
    if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      out += raw.slice(i, i + 6)
      i += 6
      continue
    }
    // 合法单字符转义
    if ('"\\/bfnrt'.includes(next)) {
      out += ch + next
      i += 2
      continue
    }
    // 非法转义：双写反斜杠，字符原样输出
    out += '\\\\' + next
    i += 2
  }
  return out
}

/** 提取最外层平衡的 {} 或 [] 块（用于模型输出夹带文字/围栏时兜底） */
function extractOutermostBlock(raw: string): string | null {
  const start = raw.search(/[{\[]/)
  if (start === -1) return null
  const open = raw[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function parseJsonStrict<T>(raw: string): T {
  const candidates: string[] = [raw]
  // 去除 markdown 围栏（```json ... ```）
  const fenceStripped = raw.replace(/```(?:json)?/gi, '').trim()
  if (fenceStripped !== raw) candidates.push(fenceStripped)
  // 提取最外层 JSON 块
  const block = extractOutermostBlock(raw)
  if (block && block !== raw && block !== fenceStripped) candidates.push(block)
  // 每个候选尝试：原样 / 反斜杠修复后
  for (const candidate of candidates) {
    const variants = [candidate, repairJsonBackslashes(candidate)]
    for (const variant of variants) {
      try {
        return JSON.parse(variant) as T
      } catch {
        /* 继续尝试下一个 */
      }
    }
  }
  throw new Error('模型输出无法解析为 JSON')
}

// ==================== 文献抽取（能力①②） ====================

const EXTRACT_SYSTEM =
  '你是化学实验复现专家。根据给定的文献内容，抽取可复现该化学实验的完整结构化方案。\n' +
  '【铁律】所有信息必须直接来源于文献内容，禁止编造、推断或外推任何数值；' +
  '文献未给出的信息（如搅拌速度、具体温度控制方式、仪器品牌等）不得虚构，一律填入 gaps 字段。\n' +
  '【公式规范】化学式与反应方程式使用 KaTeX + mhchem 格式：\n' +
  '  - 化学式用 $\\ce{}$ 包裹（如 $\\ce{H2SO4}$、$\\ce{FeCl3.6H2O}$）；\n' +
  '  - 反应方程式用 $\\ce{}$ 且箭头写为 ->（如 $\\ce{2H2 + O2 -> 2H2O}$），反应物与生成物只写化学式，禁止中文汉字；\n' +
  '  - 单位/次数/化学位移等数学量用 LaTeX（如 $cm^{-1}$、$\\delta$ 7.26），禁止 cm^-1、δ-这种不规范写法；\n' +
  '  - JSON 字符串中的反斜杠必须写成双反斜杠（如 \\\\ce{H2O}），否则 JSON 解析会失败。\n' +
  '输出 JSON 必须符合以下结构：\n' +
  `{
    "principle": "实验原理（含 $\\ce{}$ 格式化学式）",
    "materials": [{ "name": "材料名", "formula": "化学式（$\\ce{}$ 包裹，如 $\\ce{H2SO4}$）", "cas": "CAS号", "quantity": "用量", "purity": "纯度", "purpose": "用途", "notes": "备注" }],
    "reactions": [{ "equation": "反应方程式（$\\ce{}$ 格式，如 $\\ce{C6H5CH3 + HNO3 -> C6H5CH2NO3 + H2O}$；反应物与生成物禁止中文汉字）", "type": "主反应|副反应|后处理", "purpose": "用途", "notes": "" }],
    "steps": [{ "step_no": 1, "title": "步骤标题", "description": "操作描述（含 $\\ce{}$ 格式化学式与条件）", "conditions": {"temperature":"80°C","time":"2h","atmosphere":"N2","pressure":"常压","stirring":"300rpm","ph":"","other":""}, 文献未给出的字段省略，只填文献中出现过的条件; "duration": "耗时", "notes": "" }],
    "instruments": [{ "name": "仪器名", "specification": "规格", "purpose": "用途", "notes": "" }],
    "characterizations": [{ "target": "产物|中间体|原料", "method": "NMR|IR|MS|熔点|HPLC|XRD等", "conditions": "仪器条件（数学量用 LaTeX，如 $cm^{-1}$）", "expected": "预期值（化学式/化学位移用 $\\ce{}$ 或 LaTeX，如 $\\delta$ 7.26）", "notes": "" }],
    "concerns": [{ "category": "safety|operation|waste|other", "content": "注意事项", "risk_level": "高|中|低", "solution": "应对方案" }],
    "gaps": [{ "category": "condition|procedure|material|instrument|characterization|other", "content": "文献未说明的具体信息", "impact": "对结果的影响评估", "assumption": "建议默认值（必须标注为假设）" }],
    "assessment": { "difficulty_score": 0到100的数字, "feasibility": "可行|较难|不可行", "analysis": "难度可行性分析", "risk_points": "[\"风险1\",\"风险2\"]" },
    "phases": [{ "name": "阶段1", "expected": "该阶段预期结果（含 $\\ce{}$ 格式化学式）", "metrics": [{ "name": "产率", "target": "85%", "range": "80-90%", "unit": "%", "method": "HPLC归一化" }] }],
    "summary": "压缩的关键内容摘要（200字内，突出材料、关键步骤、条件与结果）"
  }`

/** 规范化 LLM 输出的评估对象：risk_points 兼容数组/字符串/缺失（返回不含 id/project_id 的写入结构） */
function normalizeAssessment(a: unknown): DocumentExtraction['assessment'] {
  const fallback = { difficulty_score: 50, feasibility: '', analysis: '', risk_points: '[]' } as ReproductionAssessment
  if (!a || typeof a !== 'object') return fallback
  const o = a as Record<string, unknown>
  const risk = o.risk_points
  // 数组 → JSON 字符串（数据库列是 TEXT）；缺失/非 JSON → 空数组
  const riskPoints =
    typeof risk === 'string'
      ? risk
      : Array.isArray(risk)
        ? JSON.stringify(risk)
        : '[]'
  return {
    difficulty_score: typeof o.difficulty_score === 'number' ? o.difficulty_score : 50,
    feasibility: typeof o.feasibility === 'string' ? o.feasibility : '',
    analysis: typeof o.analysis === 'string' ? o.analysis : '',
    risk_points: riskPoints
  } as ReproductionAssessment
}

/** 规范化 LLM 输出的步骤条件：兼容对象/JSON 字符串/缺失 */
function normalizeStepConditions(raw: unknown): StepConditions {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as StepConditions
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    try {
      const obj = JSON.parse(trimmed) as unknown
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as StepConditions
      return { other: trimmed }
    } catch {
      return { other: trimmed }
    }
  }
  return {}
}

export async function extractDocument(docText: string): Promise<DocumentExtraction> {
  console.log('[Pipeline] extractDocument 开始:', { docLen: docText.length })
  try {
    const user = `文献内容如下（可能较长，已按块拼接）：\n\n${docText.slice(0, 24000)}`
    const result = await callJson<DocumentExtraction>(EXTRACT_SYSTEM, user)
    console.log('[Pipeline] extractDocument 完成:', {
      materials: Array.isArray(result.materials) ? result.materials.length : 0,
      reactions: Array.isArray(result.reactions) ? result.reactions.length : 0,
      steps: Array.isArray(result.steps) ? result.steps.length : 0,
      instruments: Array.isArray(result.instruments) ? result.instruments.length : 0,
      characterizations: Array.isArray(result.characterizations) ? result.characterizations.length : 0,
      concerns: Array.isArray(result.concerns) ? result.concerns.length : 0,
      gaps: Array.isArray(result.gaps) ? result.gaps.length : 0,
      phases: Array.isArray(result.phases) ? result.phases.length : 0,
      summaryLen: (result.summary ?? '').length
    })
    return {
      principle: result.principle ?? '',
      materials: Array.isArray(result.materials) ? result.materials : [],
      steps: Array.isArray(result.steps)
        ? result.steps.map((s) => ({ ...s, conditions: normalizeStepConditions(s.conditions) }))
        : [],
      instruments: Array.isArray(result.instruments) ? result.instruments : [],
      characterizations: Array.isArray(result.characterizations) ? result.characterizations : [],
      concerns: Array.isArray(result.concerns) ? result.concerns : [],
      reactions: Array.isArray(result.reactions) ? result.reactions : [],
      gaps: Array.isArray(result.gaps) ? result.gaps : [],
      assessment: normalizeAssessment(result.assessment),
      phases: Array.isArray(result.phases)
        ? result.phases.map((p) => ({
            name: p?.name ?? '',
            expected: p?.expected ?? '',
            metrics: Array.isArray(p?.metrics) ? p.metrics : []
          }))
        : [],
      summary: result.summary ?? ''
    }
  } catch (err) {
    console.error('[Pipeline] extractDocument 失败:', err)
    throw err
  }
}

// ==================== 符合度分析（能力③） ====================

const COMPLIANCE_SYSTEM =
  '你是化学实验数据分析专家。根据"预期结果"与"用户实际数据"，评估本阶段实验结果是否符合预期，并输出严格 JSON。' +
  '【公式规范】化学式用 $\\ce{}$ 包裹（如 $\\ce{H2O}$），单位/次数等数学量用 LaTeX（如 $cm^{-1}$、$\\delta$），禁止 cm^-1 这类不规范写法：\n' +
  `{
    "compliance_percent": 0到100的数字,
    "is_expected": true或false,
    "expected": "标准结果参考（基于文献与化学原理给出，含 $\\ce{}$ 格式化学式）",
    "cause_analysis": "结果与预期差异的原因分析（若符合则分析为何成功；若不符合则具体到化学式/反应方程式/可能副反应）",
    "detail": "本次实验细节（条件、用量、现象，具体到化学式）"
  }`

export async function analyzeCompliance(expected: string, userContent: string): Promise<ComplianceAnalysis> {
  console.log('[Pipeline] analyzeCompliance 开始:', {
    expectedLen: expected.length,
    userLen: userContent.length
  })
  try {
    const user =
      `【预期结果】\n${expected || '（阶段未明确预期，请结合化学原理给出合理标准）'}\n\n` +
      `【用户实际数据】\n${userContent.slice(0, 8000)}`
    const result = await callJson<ComplianceAnalysis>(COMPLIANCE_SYSTEM, user)
    console.log('[Pipeline] analyzeCompliance 完成:', {
      compliancePercent: clamp(result.compliance_percent ?? 0),
      isExpected: Boolean(result.is_expected),
      expectedLen: (result.expected ?? '').length,
      causeLen: (result.cause_analysis ?? '').length,
      detailLen: (result.detail ?? '').length
    })
    return {
      compliance_percent: clamp(result.compliance_percent ?? 0),
      is_expected: Boolean(result.is_expected),
      expected: result.expected ?? '',
      cause_analysis: result.cause_analysis ?? '',
      detail: result.detail ?? ''
    }
  } catch (err) {
    console.error('[Pipeline] analyzeCompliance 失败:', err)
    throw err
  }
}

// ==================== AI 联想（能力⑤） ====================

const OPTIMIZE_SYSTEM =
  '你是化学实验优化专家。基于实验流程与搜索结果，判断是否存在更合理或效果更好的方案，输出严格 JSON 数组：\n' +
  `[{
    "title": "建议标题",
    "description": "建议内容",
    "reason": "依据（文献结论/化学原理/已知数据）",
    "confidence": 0到100,
    "changedVariables": ["变量key"]
  }]`

export async function suggestOptimizations(context: string): Promise<OptimizationSuggestion[]> {
  console.log('[Pipeline] suggestOptimizations 开始:', { contextLen: context.length })
  try {
    const user = `实验流程与结果：\n\n${context.slice(0, 12000)}`
    const result = await callJson<OptimizationSuggestion[]>(OPTIMIZE_SYSTEM, user)
    const list = Array.isArray(result) ? result : []
    // 规范化：补齐缺失字段，避免工具层读取崩溃
    const normalized = list.map((s) => ({
      title: typeof s?.title === 'string' ? s.title : '未命名建议',
      description: typeof s?.description === 'string' ? s.description : '',
      reason: typeof s?.reason === 'string' ? s.reason : '',
      confidence: typeof s?.confidence === 'number' ? Math.max(0, Math.min(100, s.confidence)) : 0,
      changedVariables: Array.isArray(s?.changedVariables) ? s.changedVariables : undefined
    }))
    console.log('[Pipeline] suggestOptimizations 完成:', { count: normalized.length })
    return normalized
  } catch (err) {
    console.error('[Pipeline] suggestOptimizations 失败:', err)
    throw err
  }
}

const VARIABLE_SYSTEM =
  '你是化学实验控制变量法分析专家。对给定实验流程，列出尽可能多的可调变量，并逐一分析"改变取值对结果性质的影响"，输出严格 JSON 数组：\n' +
  `[{
    "key": "变量标识",
    "name": "变量名称",
    "direction": "increase|decrease|switch",
    "affectedProperties": [{ "property": "产率|纯度|选择性|速率|现象|副产物", "change": "上升|下降|增强|减弱等" }],
    "analysis": "机理解释（含理论依据，如勒夏特列原理、阿伦尼乌斯方程、动力学方程）"
  }]`

export async function analyzeVariableEffects(context: string): Promise<VariableEffect[]> {
  console.log('[Pipeline] analyzeVariableEffects 开始:', { contextLen: context.length })
  try {
    const user = `实验流程：\n\n${context.slice(0, 12000)}`
    const result = await callJson<VariableEffect[]>(VARIABLE_SYSTEM, user)
    const list = Array.isArray(result) ? result : []
    // 规范化：保证 affectedProperties 至少是数组，避免工具层读取 .length 崩溃
    const normalized = list.map((e) => ({
      key: typeof e?.key === 'string' ? e.key : `var-${Math.random().toString(36).slice(2, 7)}`,
      name: typeof e?.name === 'string' ? e.name : '未知变量',
      direction: (['increase', 'decrease', 'switch'] as const).includes(e?.direction as VariableEffect['direction'])
        ? (e.direction as VariableEffect['direction'])
        : 'increase',
      affectedProperties: Array.isArray(e?.affectedProperties) ? e.affectedProperties : [],
      analysis: typeof e?.analysis === 'string' ? e.analysis : ''
    }))
    console.log('[Pipeline] analyzeVariableEffects 完成:', { count: normalized.length })
    return normalized
  } catch (err) {
    console.error('[Pipeline] analyzeVariableEffects 失败:', err)
    throw err
  }
}

// ==================== 预测实验（能力⑤） ====================

export interface PredictionOutput {
  predicted_result: string
  property_analysis: string
  theory_basis: string
}

const PREDICT_SYSTEM =
  '你是化学理论预测专家。根据实验流程与用户设定的变量值，预测实验结果。' +
  '必须保证理论有依据（反应方程式、勒夏特列原理、阿伦尼乌斯方程、热力学 ΔG=ΔH−TΔS、动力学速率方程、已知数据外推等），无依据不得编造结论。' +
  '输出严格 JSON：\n' +
  `{
    "predicted_result": "预测的实验结果（Markdown，含预期数值范围与现象，标注为预测/未验证）",
    "property_analysis": "结果各性质（产率/纯度/选择性/速率/现象等）如何变化",
    "theory_basis": "理论依据（列出引用的反应式/定律/公式并解释）"
  }`

export async function predictExperiment(
  flow: string,
  variablesDesc: string
): Promise<PredictionOutput> {
  console.log('[Pipeline] predictExperiment 开始:', {
    flowLen: flow.length,
    variablesDescLen: variablesDesc.length
  })
  try {
    const user = `实验流程：\n${flow.slice(0, 6000)}\n\n用户设定的变量值：\n${variablesDesc}`
    const result = await callJson<PredictionOutput>(PREDICT_SYSTEM, user)
    console.log('[Pipeline] predictExperiment 完成:', {
      predictedLen: (result.predicted_result ?? '').length,
      propertyLen: (result.property_analysis ?? '').length,
      theoryLen: (result.theory_basis ?? '').length
    })
    return {
      predicted_result: result.predicted_result ?? '',
      property_analysis: result.property_analysis ?? '',
      theory_basis: result.theory_basis ?? ''
    }
  } catch (err) {
    console.error('[Pipeline] predictExperiment 失败:', err)
    throw err
  }
}

// ==================== 论文生成（能力④） ====================

const PAPER_SYSTEM =
  '你是科学论文撰写专家。基于提供的真实实验数据撰写标准论文（Markdown 格式），内容必须属实。\n' +
  '论文结构：标题 / 摘要 / 关键词 / 1 引言 / 2 材料与方法 / 3 结果与讨论 / 4 结论 / 参考文献（占位）。\n' +
  '要求：\n' +
  '1. 所有数据仅来自提供的材料，不得虚构。\n' +
  '2. 图表以占位符嵌入：每处插入对应 Markdown 数据表，并在其后加 "![chart:chart-<n>](图表标题)"（n 从 1 递增）。\n' +
  '3. 凡是需要真实数据但材料中缺失或仅为 AI 推断的部分，必须插入标注：\n' +
  '   > ⚠️ **【待人工补充】**：此处需填入实际 ____ 数据（如实际产率、实测熔点、谱图峰表、实验照片等）\n' +
  '4. 数学公式使用 LaTeX：行内 $...$，块级 $$...$$。\n' +
  '输出严格 JSON：{"title": "论文标题", "content": "论文全文 Markdown"}'

export async function generatePaper(context: string): Promise<{ title: string; content: string }> {
  console.log('[Pipeline] generatePaper 开始:', { contextLen: context.length })
  try {
    const user = `以下是该实验项目的全部真实数据：\n\n${context.slice(0, 30000)}`
    const result = await callJson<{ title: string; content: string }>(PAPER_SYSTEM, user)
    console.log('[Pipeline] generatePaper 完成:', {
      titleLen: (result.title ?? '').length,
      contentLen: (result.content ?? '').length
    })
    return {
      title: result.title ?? '实验论文',
      content: result.content ?? ''
    }
  } catch (err) {
    console.error('[Pipeline] generatePaper 失败:', err)
    throw err
  }
}

// ==================== 工具函数 ====================

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}
