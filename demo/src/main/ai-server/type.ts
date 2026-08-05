/**
 * ai-server 类型规范（P1 先行定义）
 *
 * 所有功能（DAO / 工具 / 管线 / IPC / Agent 输出 / 前端 preload）严格引用本文件类型。
 * Agent 输出的 JSON 必须遵循本文件中的 AiChat 等结构规范。
 * 新增类型必须先补充到本文件，再编写引用代码。
 */

// ==================== Agent 回复规范（核心：AI 输出 JSON 必须遵循） ====================

/**
 * Agent 统一回复结构（聊天 Agent 与实验 Agent 共用）
 */
export interface AiChat {
  /** 思考过程（Markdown） */
  think: string
  /** 最终回答（Markdown，可含 LaTeX 公式与化学 Unicode 符号） */
  messages: string
  /** 可选：本次回复附带的可视化图表 */
  charts?: ChartSpec[]
}

/** 图表类型 */
export type ChartType = 'gauge' | 'bar' | 'line' | 'pie' | 'radar' | 'scatter'

/** 单个图表规范（Agent 生成 echartsOption，前端直接渲染） */
export interface ChartSpec {
  /** 图表唯一标识（论文占位符 ![chart:xxx] 引用同一 id） */
  id: string
  /** 图表标题 */
  title: string
  /** 图表类型 */
  type: ChartType
  /** 完整 ECharts option（series/data 等） */
  echartsOption: Record<string, unknown>
}

// ==================== 项目（能力①） ====================

/** 项目状态：ongoing 进行中 / paused 已暂停（中断后可恢复） / completed 已完成 */
export type ProjectStatus = 'ongoing' | 'paused' | 'completed'

/** 实验项目 */
export interface Project {
  /** 项目 ID */
  id: number
  /** 项目名称（用户可自定义） */
  name: string
  /** 项目简介/来源 */
  description: string
  /** 项目状态 */
  status: ProjectStatus
  /** 文献要点压缩摘要（同步存向量库） */
  summary: string
  /** 恢复点 JSON：{ activeTab: 'plan'|'phase'|..., updatedAt }，中断后再进入时恢复到上次位置 */
  resume_state: string
  /** 创建时间 */
  created_at: string
  /** 更新时间 */
  updated_at: string
}

/** 项目中断/恢复点（对应 projects.resume_state 的 JSON 结构） */
export interface ProjectResumeState {
  /** 上次所在的标签页 */
  activeTab?: string
  /** 记录时间 */
  updatedAt?: string
}

/** 项目 AI 陪伴对话消息（持久化，实验中断后重新进入可恢复上下文） */
export interface ProjectChat {
  /** 消息 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 角色：user / assistant */
  role: 'user' | 'assistant'
  /** 消息正文（assistant 为展示文本） */
  content: string
  /** 附带图表（ChartSpec[] JSON 字符串） */
  charts_json: string
  /** 创建时间 */
  created_at: string
}

/** 项目-文献关联 */
export interface ProjectDocument {
  /** 关联 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 关联 documents.id */
  document_id: number
  /** 角色：source 主要来源 / supplement 补充 */
  role: string
  /** 创建时间 */
  created_at: string
}

/** 向量摘要来源 */
export type SummarySource = 'document' | 'step' | 'record' | 'phenomenon'

/** LanceDB project_summaries 条目 */
export interface ProjectSummary {
  /** 所属项目 */
  project_id: number
  /** 分块序号 */
  chunk_index: number
  /** 压缩后的关键内容摘要 */
  text: string
  /** 摘要来源 */
  source: SummarySource
  /** 文本向量 */
  vector: number[]
}

// ==================== 复现方案（能力②） ====================

/** 复现方案：化学材料/试剂 */
export interface ReproductionMaterial {
  /** 材料 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 材料/试剂名称 */
  name: string
  /** 化学式（如 H2SO4） */
  formula: string
  /** CAS 号 */
  cas: string
  /** 用量（如 "5.0 g"、"50 mL"） */
  quantity: string
  /** 纯度 */
  purity: string
  /** 用途 */
  purpose: string
  /** 备注（危险性等） */
  notes: string
}

/** 步骤条件（结构化对象，数据库以 JSON 字符串存储） */
export interface StepConditions {
  /** 温度，如 "80°C" */
  temperature?: string
  /** 时间，如 "2h" */
  time?: string
  /** 气氛，如 "N2" */
  atmosphere?: string
  /** 压强，如 "常压" / "0.5 MPa" */
  pressure?: string
  /** 搅拌，如 "300 rpm" */
  stirring?: string
  /** pH */
  ph?: string
  /** 其他条件（文献原文，未结构化的部分） */
  other?: string
}

/** 复现方案：实验步骤 */
export interface ReproductionStep {
  /** 步骤 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 步骤序号 */
  step_no: number
  /** 步骤标题 */
  title: string
  /** 操作描述 */
  description: string
  /** 条件（结构化对象，温度/时间/气氛等；仅含文献给出的字段） */
  conditions: StepConditions
  /** 预计耗时 */
  duration: string
  /** 备注 */
  notes: string
}

/** 复现方案：实验仪器/装置 */
export interface ReproductionInstrument {
  /** 仪器 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 仪器名称 */
  name: string
  /** 规格型号 */
  specification: string
  /** 用途 */
  purpose: string
  /** 备注 */
  notes: string
}

/** 注意事项类别 */
export type ConcernCategory = 'safety' | 'operation' | 'waste' | 'other'

/** 复现方案：注意事项/潜在问题 */
export interface ReproductionConcern {
  /** 注意事项 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 类别：safety 安全 / operation 操作 / waste 废液 / other */
  category: ConcernCategory
  /** 注意事项内容 */
  content: string
  /** 风险等级：高/中/低 */
  risk_level: string
  /** 应对/预防方案 */
  solution: string
}

/** 复现难度与可行性评估 */
export interface ReproductionAssessment {
  /** 评估 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 复现难度 0~100 */
  difficulty_score: number
  /** 可行性结论：可行/较难/不可行 */
  feasibility: string
  /** 难度与可行性分析 */
  analysis: string
  /** 主要风险点（JSON 数组字符串） */
  risk_points: string
}

/** 复现方案：反应方程式 */
export interface ReproductionReaction {
  /** 反应 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 反应方程式（含化学式，如 A + B → C） */
  equation: string
  /** 反应类型：主反应 / 副反应 / 后处理等 */
  type: string
  /** 用途/说明 */
  purpose: string
  /** 备注 */
  notes: string
}

/** 复现方案：表征/分析方法 */
export interface ReproductionCharacterization {
  /** 表征 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 检测对象：产物 / 中间体 / 原料 */
  target: string
  /** 检测手段：NMR / IR / MS / 熔点 / HPLC / XRD 等 */
  method: string
  /** 仪器条件与制样方法 */
  conditions: string
  /** 预期值（化学位移/峰位/熔点范围/纯度等，仅来自文献） */
  expected: string
  /** 备注 */
  notes: string
}

/** 信息缺口类别 */
export type GapCategory = 'condition' | 'procedure' | 'material' | 'instrument' | 'characterization' | 'other'

/** 复现方案：信息缺口（文献未说明、复现时需假设或人工确认的信息） */
export interface ReproductionGap {
  /** 缺口 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 缺口类别 */
  category: GapCategory
  /** 缺口内容 */
  content: string
  /** 对结果的影响评估 */
  impact: string
  /** 建议兜底假设（必须标注为假设） */
  assumption: string
}

/** 阶段量化指标（来自文献的预期指标，如产率/纯度/熔点范围） */
export interface PhaseMetric {
  /** 指标名称：产率/纯度/选择性/熔点等 */
  name: string
  /** 目标值，如 "85%" */
  target: string
  /** 允许范围，如 "80-90%" */
  range: string
  /** 单位，如 "%" */
  unit: string
  /** 测定方法，如 "HPLC 归一化" */
  method: string
}

/** 文献抽取管线输出（create_project_from_documents 内部 LLM 抽取结果） */
export interface DocumentExtraction {
  /** 实验原理 */
  principle: string
  /** 材料清单 */
  materials: ReproductionMaterial[]
  /** 实验步骤 */
  steps: ReproductionStep[]
  /** 仪器清单 */
  instruments: ReproductionInstrument[]
  /** 注意事项/潜在问题 */
  concerns: ReproductionConcern[]
  /** 反应方程式 */
  reactions: ReproductionReaction[]
  /** 表征/分析方法 */
  characterizations: ReproductionCharacterization[]
  /** 信息缺口（文献未说明的部分） */
  gaps: ReproductionGap[]
  /** 难度与可行性评估 */
  assessment: ReproductionAssessment
  /** 建议的实验阶段（含量化指标） */
  phases: Array<{ name: string; expected: string; metrics: PhaseMetric[] }>
  /** 压缩摘要（写入 projects.summary） */
  summary: string
}

// ==================== 实验阶段与记录（能力③） ====================

/** 阶段状态 */
export type PhaseStatus = 'pending' | 'in_progress' | 'completed'

/** 实验阶段 */
export interface ExperimentPhase {
  /** 阶段 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 阶段名称（默认 "阶段1/2/3…"，可改） */
  name: string
  /** 阶段顺序 */
  phase_order: number
  /** 阶段状态 */
  status: PhaseStatus
  /** 该阶段预期结果（来自文献） */
  expected: string
  /** 该阶段量化指标（PhaseMetric[] JSON 字符串，来自文献） */
  metrics_json: string
  /** 创建时间 */
  created_at: string
}

/** 记录类型：phase 阶段结果 / phenomenon 实验现象 */
export type RecordType = 'phase' | 'phenomenon'

/** 阶段实验记录（一次上传=一条记录） */
export interface ExperimentRecord {
  /** 记录 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 关联阶段（可空） */
  phase_id: number | null
  /** 记录类型 */
  record_type: RecordType
  /** 记录名称（现象可自定义，如"实验现象1-黄色沉淀"） */
  name: string
  /** 用户上传的数据原文（Markdown） */
  content: string
  /** 结构化数据 JSON 字符串 */
  data_json: string
  /** 预期结果参考（Agent 生成） */
  expected: string
  /** 符合预期百分比 0~100 */
  compliance_percent: number | null
  /** 是否符合预期：1 符合 / 0 不符合 */
  is_expected: number | null
  /** 原因分析（具体到化学式/反应式） */
  cause_analysis: string
  /** 实验细节（条件/用量/现象，具体到化学式） */
  detail: string
  /** 创建时间 */
  created_at: string
}

/** 化学数据类型（自定义数据枚举） */
export type ChemDataType =
  | 'mass'        // 质量
  | 'volume'      // 体积
  | 'concentration' // 浓度
  | 'yield'       // 产率
  | 'temperature' // 温度
  | 'time'        // 时间
  | 'ph'          // pH
  | 'color'       // 颜色
  | 'spectrum'    // 光谱
  | 'melting_point' // 熔点
  | 'boiling_point' // 沸点
  | 'density'     // 密度
  | 'viscosity'   // 黏度
  | 'pressure'    // 压力
  | 'purity'      // 纯度
  | 'observation' // 观察结果
  | 'other'       // 其他

/** 用户自定义数据（EAV 风格，任何实验通用） */
export interface CustomData {
  /** 数据 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 关联记录（可空 = 项目级数据） */
  record_id: number | null
  /** 数据名称（用户自定义） */
  data_name: string
  /** 化学数据类型 */
  data_type: ChemDataType
  /** 数据内容（文本/数值，含化学 Unicode 符号） */
  data_value: string
  /** 单位 */
  unit: string
  /** 扩展 JSON 字符串 */
  extra: string
  /** 创建时间 */
  created_at: string
}

/** 符合度分析输出（能力③，Agent/管线生成） */
export interface ComplianceAnalysis {
  /** 符合预期百分比 0~100 */
  compliance_percent: number
  /** 是否符合预期 */
  is_expected: boolean
  /** 标准结果参考 */
  expected: string
  /** 原因分析（具体到化学式/反应式） */
  cause_analysis: string
  /** 实验细节（条件/用量/现象） */
  detail: string
}

// ==================== 文献图表（能力①，v0.2） ====================

/** 图表类型：table 表格 / chemical_structure 结构式 / spectrum 谱图 / chart 数据图 / photograph 照片 */
export type FigureType =
  | 'table'
  | 'chemical_structure'
  | 'spectrum'
  | 'chart'
  | 'photograph'

/** 图表识别状态：pending 未处理 / parsed 已识别 / manual 待人工确认 */
export type FigureStatus = 'pending' | 'parsed' | 'manual'

/** 文献图表解析结果 */
export interface DocumentFigure {
  /** 图表 ID */
  id: number
  /** 所属文档 */
  document_id: number
  /** 关联项目（可选） */
  project_id: number | null
  /** 图序号 */
  figure_index: number
  /** 所在页码 */
  page_number: number
  /** 图表类型 */
  figure_type: FigureType
  /** 图题 */
  caption: string
  /** 结构化识别结果 JSON 字符串 */
  structured_data: string
  /** OCR 文本（兜底） */
  ocr_text: string
  /** 原图本地缓存路径 */
  image_path: string
  /** 识别状态 */
  status: FigureStatus
  /** 创建时间 */
  created_at: string
}

/** 结构化识别结果（对应 document_figures.structured_data 的 JSON 结构） */
export interface StructuredFigureData {
  /** 表格数据（二维数组，首行为表头） */
  table?: unknown[][]
  /** 化学结构式（SMILES） */
  smiles?: string
  /** 谱图数据（x/y 数据点 + 峰表） */
  spectrum?: {
    x: number[]
    y: number[]
    peaks?: Array<{ ppm: number; multiplicity?: string; intensity?: number }>
  }
  /** 数据图序列 */
  chart?: { series: Array<{ name: string; data: Array<number | [number, number]> }> }
  /** 其他类型描述 */
  description?: string
}

// ==================== 论文（能力④，可选生成） ====================

/** 论文 */
export interface Paper {
  /** 论文 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 论文标题 */
  title: string
  /** 论文全文（Markdown，含图表占位符与【待人工补充】标注） */
  content: string
  /** 论文引用图表数据（ChartSpec[] JSON 字符串，供导出/重新渲染） */
  charts: string
  /** 生成时间 */
  created_at: string
}

// ==================== AI 联想与预测实验（能力⑤） ====================

/** 变量类型 */
export type VariableType =
  | 'temperature' // 温度
  | 'time'        // 时间
  | 'concentration' // 浓度
  | 'ratio'       // 配比
  | 'catalyst'    // 催化剂
  | 'atmosphere'  // 气氛
  | 'stirring'    // 搅拌
  | 'pressure'    // 压强
  | 'ph'          // pH
  | 'amount'      // 用量
  | 'other'       // 其他

/** 实验变量（可调参数，供前端变量面板控制） */
export interface ExperimentVariable {
  /** 变量标识（对应步骤/条件） */
  key: string
  /** 变量名称（如"反应温度"） */
  name: string
  /** 变量类型 */
  type: VariableType
  /** 当前取值 */
  value: number | string
  /** 单位（如 °C、min、mol/L） */
  unit: string
  /** 建议最小值（用于前端滑块） */
  min?: number
  /** 建议最大值 */
  max?: number
  /** 调节步长 */
  step?: number
  /** 可选值（枚举型变量，如催化剂种类/气氛） */
  options?: string[]
  /** 变量作用说明（改变它会影响什么） */
  description: string
}

/** AI 预测实验记录 */
export interface PredictionExperiment {
  /** 预测实验 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 预测实验名称 */
  name: string
  /** 基于的实验流程描述 */
  base_flow: string
  /** 全部变量及取值（ExperimentVariable[] JSON 字符串） */
  variables: string
  /** AI 预测的实验结果（Markdown，含公式） */
  predicted_result: string
  /** 结果性质分析（各性质如何变化） */
  property_analysis: string
  /** 理论依据（反应式/定律/公式，必须非空） */
  theory_basis: string
  /** 创建时间 */
  created_at: string
}

/** AI 联想：优化建议（能力⑤） */
export interface OptimizationSuggestion {
  /** 建议标题（如"换用 Pd/C 催化剂"） */
  title: string
  /** 建议内容 */
  description: string
  /** 依据（文献/理论/数据） */
  reason: string
  /** 置信度 0~100 */
  confidence: number
  /** 涉及改变的变量 key */
  changedVariables?: string[]
}

/** AI 联想：控制变量影响分析（能力⑤） */
export interface VariableEffect {
  /** 变量标识 */
  key: string
  /** 变量名称 */
  name: string
  /** 改变方向：increase 增大 / decrease 减小 / switch 切换 */
  direction: 'increase' | 'decrease' | 'switch'
  /** 结果性质变化列表（如 产率↑、纯度↓、速率↑） */
  affectedProperties: Array<{ property: string; change: string }>
  /** 机理解释（含理论依据） */
  analysis: string
}

// ==================== 工具输入/输出类型（与工具一一对应） ====================

/** 文件导入结果（能力①） */
export interface DocumentImportResult {
  /** documents.id */
  documentId: number
  /** 文档标题 */
  title: string
  /** 正文长度（字符数） */
  contentLength: number
  /** 解析出的图表数 */
  figureCount: number
}

/** 保存实验记录工具入参（能力③） */
export interface SaveRecordInput {
  /** 所属项目 */
  project_id: number
  /** 关联阶段（可空） */
  phase_id?: number
  /** 记录/现象名称（用户可自定义） */
  name: string
  /** 用户上传的数据原文（Markdown） */
  content: string
  /** 结构化数据 */
  data_json?: Record<string, unknown>
  /** 符合度分析结果（缺省时工具内部通过 LLM 管线自动计算） */
  compliance?: ComplianceAnalysis
}

/** 运行预测实验工具入参（能力⑤） */
export interface RunPredictionInput {
  /** 所属项目 */
  project_id: number
  /** 基于的实验流程描述 */
  flow: string
  /** 预测实验名称（缺省自动生成） */
  name?: string
  /** 本次全部变量取值 */
  variables: ExperimentVariable[]
}

/** 项目全量上下文（get_project 工具返回） */
export interface ProjectContext {
  /** 项目基本信息 */
  project: Project
  /** 关联文献 */
  documents: ProjectDocument[]
  /** 材料清单 */
  materials: ReproductionMaterial[]
  /** 步骤 */
  steps: ReproductionStep[]
  /** 仪器 */
  instruments: ReproductionInstrument[]
  /** 注意事项 */
  concerns: ReproductionConcern[]
  /** 反应方程式 */
  reactions: ReproductionReaction[]
  /** 表征/分析方法 */
  characterizations: ReproductionCharacterization[]
  /** 信息缺口 */
  gaps: ReproductionGap[]
  /** 难度评估（可能为空） */
  assessment: ReproductionAssessment | null
  /** 实验阶段 */
  phases: ExperimentPhase[]
  /** 阶段记录/现象（含最新数据） */
  records: ExperimentRecord[]
  /** 自定义数据 */
  customData: CustomData[]
  /** 历史预测实验 */
  predictions: PredictionExperiment[]
  /** 已生成论文 */
  papers: Paper[]
  /** 向量召回的摘要文本 */
  summaries: string[]
}

// ==================== IPC 交互（与工作台页面对接） ====================

/** 实验 Agent 请求（AI 陪伴/工作流） */
export interface ExperimentAgentRequest {
  /** 当前项目（可为空） */
  projectId?: number
  /** 用户输入（含 Markdown/公式/化学符号） */
  message: string
  /** 陪伴对话历史 */
  history: { role: string; content: string }[]
}
