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
// v0.7：gantt（步骤依赖/阶段泳道）| timeline（阶段门禁时间线）；v0.8：tree（分叉实验树）
export type ChartTypeV2 = ChartType | 'gantt' | 'timeline' | 'tree'

/** 单个图表规范（Agent 生成 echartsOption，前端直接渲染） */
export interface ChartSpec {
  /** 图表唯一标识（论文占位符 ![chart:xxx] 引用同一 id） */
  id: string
  /** 图表标题 */
  title: string
  /** 图表类型（含基础类型 + gantt/timeline/tree） */
  type: ChartTypeV2
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
  /** 所属会话（project_chat_conversations.id，可空 = 旧数据未分组） */
  conversation_id?: number | null
  /** 角色：user / assistant */
  role: 'user' | 'assistant'
  /** 消息正文（assistant 为展示文本） */
  content: string
  /** 附带图表（ChartSpec[] JSON 字符串） */
  charts_json: string
  /** 创建时间 */
  created_at: string
}

/** 项目 AI 陪伴对话-会话分组（新建对话 / 历史对话） */
export interface ProjectChatConversation {
  /** 会话 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 会话标题（缺省"新对话"） */
  title: string
  /** 创建时间 */
  created_at: string
  /** 最近活跃时间 */
  updated_at: string
  /** 消息数（列表联查） */
  message_count?: number
  /** 最近一条消息预览（列表联查） */
  preview?: string
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

// ==================== 项目间共享（v0.9/v0.10） ====================

/** 参考项目关系（默认 scope=documents 仅文献；实验具体内容须经共享请求审批后提升 scope） */
export interface ProjectLink {
  /** 关联 ID */
  id: number
  /** 当前项目 */
  project_id: number
  /** 被参考项目（共享来源） */
  ref_project_id: number
  /** 被参考项目名称（快照，便于展示） */
  ref_name: string
  /** 共享范围：documents(仅文献，默认) / summaries(文献+实验摘要) / all */
  scope: string
  /** 创建时间 */
  created_at: string
}

/** 共享请求状态 */
export type LinkRequestStatus = 'pending' | 'approved' | 'rejected'

/** 共享请求（请求方 → 项目作者审批，审批通过后提升对应 project_links.scope） */
export interface ProjectLinkRequest {
  /** 请求 ID */
  id: number
  /** 请求方项目（想参考别人） */
  project_id: number
  /** 被请求项目（作者审批） */
  target_project_id: number
  /** 被请求项目作者/项目名（快照） */
  target_owner_name: string
  /** 请求的共享范围：summaries / all */
  scope: string
  /** 请求说明（申请理由） */
  reason: string
  /** pending 待审批 / approved 已通过 / rejected 已拒绝 */
  status: LinkRequestStatus
  /** 发起时间 */
  created_at: string
  /** 审批时间 */
  resolved_at: string | null
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

/** 步骤状态（v0.7 并行执行核心） */
export type StepStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'skipped'

/** 复现方案：实验步骤（v0.7：升级为依赖图 DAG，支持并行执行） */
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
  /** 前置步骤 id 列表（空 = 无依赖，可立即执行）；DAG 保证无环 */
  depends_on: number[]
  /** 步骤执行状态（见 §7.6 状态机） */
  status: StepStatus
  /** 所属并行实验分叉（树分叉），空 = 主线流程 */
  branch_id: number | null
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

/** 阶段状态（v0.7：pending_review=步骤全完成、待小结与用户确认放行） */
export type PhaseStatus = 'pending' | 'in_progress' | 'pending_review' | 'completed'

/** 阶段门禁状态（v0.7 阶段边界） */
export type PhaseGateStatus = 'locked' | 'open' | 'passed'

/** 实验阶段 */
export interface ExperimentPhase {
  /** 阶段 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 所属并行实验分叉（树分叉），空 = 主线流程 */
  branch_id: number | null
  /** 阶段名称（默认 "阶段1/2/3…"，可改） */
  name: string
  /** 阶段顺序 */
  phase_order: number
  /** 阶段状态 */
  status: PhaseStatus
  /** 门禁状态（见 §7.7） */
  gate_status: PhaseGateStatus
  /** 阶段小结（AI 生成，Markdown，见 §7.7） */
  summary: string
  /** 小结生成时间 */
  summary_created_at: string | null
  /** 是否可与后续阶段并行执行（分叉场景） */
  can_parallel: number
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
  /** 关联步骤（可空 = 阶段级，v3） */
  step_id?: number | null
  /** 所属并行实验分叉（树分叉），空 = 主线流程 */
  branch_id: number | null
  /** 所属步骤级并行实验变体（可空 = 步骤默认执行，v3） */
  step_experiment_id?: number | null
  /** 记录类型 */
  record_type: RecordType
  /** 记录名称（现象可自定义，如"实验现象1-黄色沉淀"） */
  name: string
  /** 用户上传的数据原文（Markdown） */
  content: string
  /** 结构化数据 JSON 字符串 */
  data_json: string
  /** 附件 JSON（图片/视频本地路径数组） */
  attachments: string
  /** ECharts 统计图录数 JSON（ChartRecordData） */
  chart_data: string
  /** pending 待入库 / indexed 已入库（延迟压缩，§7.11） */
  vector_status: string
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

/** 阶段实验变量（v0.9：Agent 依据文献生成，用户可增删改） */
export interface ExperimentPhaseVariable {
  /** 变量 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 所属阶段 */
  phase_id: number
  /** 所属步骤（可空 = 阶段级，v3） */
  step_id?: number | null
  /** 分叉归属（可空） */
  branch_id: number | null
  /** 所属步骤级并行实验变体（可空 = 步骤默认执行，v3） */
  step_experiment_id?: number | null
  /** 变量标识（如 reaction_temp） */
  key: string
  /** 变量名称（如"反应温度"） */
  name: string
  /** 变量类型 */
  type: VariableType
  /** 单位（°C / min / mol/L…） */
  unit: string
  /** 文献默认取值 */
  default_value: string
  /** 本次实验实际取值（用户填写） */
  current_value: string
  /** 枚举可选值 */
  options: string
  /** 是否 Agent 生成（false = 用户自定义新增） */
  is_agent_generated: number
  /** 变量作用说明 */
  description: string
  /** 显示顺序 */
  sort_order: number
  /** 创建时间 */
  created_at: string
}

/** 实验事件（v0.9：记录会影响后续实验的事件，可附图片/视频） */
export interface ExperimentEvent {
  /** 事件 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 分叉归属 */
  branch_id: number | null
  /** 所属阶段（可空=项目级） */
  phase_id: number | null
  /** 所属步骤（可空 = 阶段/项目级，v3） */
  step_id?: number | null
  /** 所属步骤级并行实验变体（可空 = 步骤默认执行，v3） */
  step_experiment_id?: number | null
  /** 事件名称 */
  name: string
  /** 事件描述（Markdown） */
  content: string
  /** 附件（图片/视频本地路径） */
  media_paths: string
  /** 创建时间 */
  created_at: string
}

/** ECharts 空白统计图录数（v0.9，JSON 存 SQLite，入库前 LLM 转文本摘要进向量库） */
export interface ChartRecordData {
  /** 图表类型：line/bar/scatter（录入模板） */
  type: string
  /** 图表标题 */
  title: string
  /** X 轴名称 */
  x_label: string
  /** Y 轴名称 */
  y_label: string
  /** 数值单位 */
  unit: string
  /** 用户录入的数据序列 */
  series: Array<{ name: string; data: Array<[number | string, number]> }>
  /** 入库前由 LLM 生成的文本摘要（如"温度60→100°C，产率72%→85%，90°C达峰"） */
  summary_text?: string
}

/** 并行实验分叉（v0.8 树分叉模型） */
export interface ExperimentBranch {
  /** 分叉 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 父分叉 id（null = 从主线分出；形成树） */
  parent_branch_id: number | null
  /** 分支名（如"实验组A-分批加铜粉"） */
  name: string
  /** 分支说明（变量设定、目的） */
  description: string
  /** 相对父分支的变量差异 JSON */
  variable_overrides: string
  /** 分叉点：从哪个阶段之后开始独立 */
  fork_phase_id: number | null
  /** pending 未入库 / indexed 已入库（完成并行实验后异步压缩，§7.11） */
  index_status: string
  /** 创建时间 */
  created_at: string
}

/** 阶段小结内容（v0.7：写入 ExperimentPhase.summary 的 Markdown 结构约定） */
export interface PhaseSummary {
  /** 本阶段结果汇总（数据/现象） */
  results: string
  /** 符合预期情况（百分比/是否预期） */
  compliance: string
  /** 异常与偏差 */
  anomalies: string
  /** 经验教训 */
  lessons: string
  /** 下一步建议（是否需调整方案/直接放行） */
  next_advice: string
}

/** 步骤级并行实验（v3：在具体步骤中修改实验变量生成的变体，见修改计划问题⑥） */
export interface StepExperiment {
  /** 变体 ID */
  id: number
  /** 所属项目 */
  project_id: number
  /** 所属步骤 */
  step_id: number
  /** 所属分叉（空 = 主线），与步骤 branch_id 一致 */
  branch_id: number | null
  /** 从某变体再派生（可空，形成变体树） */
  parent_experiment_id: number | null
  /** 变体名（如"变体A-温度80°C"） */
  name: string
  /** 变体说明 */
  description: string
  /** 相对步骤默认变量的覆盖 JSON（{key: value}） */
  variable_overrides: string
  /** pending 待入库 / indexed 已入库 */
  status: string
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
  /** 所属步骤（可空 = 阶段/项目级，v3） */
  step_id?: number | null
  /** 所属步骤级并行实验变体（可空 = 步骤默认执行，v3） */
  step_experiment_id?: number | null
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
  /** 所属步骤（可空 = 未归属/阶段级，v3 问题⑧） */
  step_id?: number | null
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

/** 待识别图片及其论文上下文（P4：VLM 上下文注入） */
export interface FigureSource {
  /** 图片 dataURL */
  dataUrl: string
  /** 所在页码（1-based，可空） */
  pageNumber?: number
  /** 图题（论文正文中的 "Figure N. ..."，可空） */
  caption?: string
  /** 所在页及邻近页正文片段（截断后，可空） */
  pageText?: string
}

/** 结构化识别结果（对应 document_figures.structured_data 的 JSON 结构） */
export interface StructuredFigureData {
  /** 表格数据（二维数组，首行为表头） */
  table?: unknown[][]
  /** 化学结构式（SMILES） */
  smiles?: string
  /** 谱图数据（x/y 数据点 + 峰表） */
  spectrum?: {
    /** 谱图子类型：nmr_1h / nmr_13c / ir / ms / uv_vis / xrd / tga_dsc / raman / fluorescence / epr / hplc / gc / cv 等 */
    spectrum_type?: string
    x: number[]
    y: number[]
    /** X 轴名称，如 '2θ (°)'、'波长 (nm)'、'm/z' */
    x_label?: string
    /** Y 轴名称，如 '强度 (a.u.)'、'透过率 (%)' */
    y_label?: string
    /** 单位 */
    unit?: string
    peaks?: Array<{ ppm: number; multiplicity?: string; intensity?: number }>
  }
  /** 数据图序列 */
  chart?: {
    /** X 轴名称 */
    x_label?: string
    /** Y 轴名称 */
    y_label?: string
    /** 单位 */
    unit?: string
    series: Array<{ name: string; data: Array<number | [number, number]> }>
  }
  /** 图类细分（如 scheme / sem / nmr_1h / line_chart 等，与 type 配合） */
  subtype?: string
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
  /** 关联的分叉（空 = 主线），用于按分叉对比 */
  branch_id: number | null
  /** 关联步骤（可空 = 分支/主线级，v3 问题⑤） */
  step_id?: number | null
  /** 关联步骤级并行实验变体（可空，v3） */
  step_experiment_id?: number | null
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
  /** 解析来源：mineru / local */
  parser: string
  /** v3：MinerU 解析后的 markdown 落盘路径（问题⑨，local 解析为空） */
  mdPath?: string
  /** v3：MinerU 解析出的图表结构化数据（图片块/表格块，问题⑦） */
  figures?: unknown[]
}

/** 保存实验记录工具入参（能力③） */
export interface SaveRecordInput {
  /** 所属项目 */
  project_id: number
  /** 关联阶段（可空） */
  phase_id?: number
  /** 关联步骤（可空 = 阶段级，v3） */
  step_id?: number
  /** 所属分叉（可空 = 主线） */
  branch_id?: number
  /** 所属步骤级并行实验变体（可空 = 步骤默认执行，v3） */
  step_experiment_id?: number
  /** 记录/现象名称（用户可自定义） */
  name: string
  /** 用户上传的数据原文（Markdown） */
  content: string
  /** 结构化数据 */
  data_json?: Record<string, unknown>
  /** 附件本地路径（图片/视频） */
  attachments?: string[]
  /** ECharts 统计图录数 JSON */
  chart_data?: ChartRecordData
  /** 符合度分析结果（缺省时工具内部通过 LLM 管线自动计算） */
  compliance?: ComplianceAnalysis
}

/** 运行预测实验工具入参（能力⑤） */
export interface RunPredictionInput {
  /** 所属项目 */
  project_id: number
  /** 关联分叉（用于平行实验，可空） */
  branch_id?: number
  /** 关联步骤（可空，v3 问题⑤） */
  step_id?: number
  /** 关联步骤级并行实验变体（可空，v3） */
  step_experiment_id?: number
  /** 基于的实验流程描述 */
  flow: string
  /** 预测实验名称（缺省自动生成） */
  name?: string
  /** 本次全部变量取值 */
  variables: ExperimentVariable[]
}

/** 创建并行实验分叉入参（v0.8） */
export interface CreateBranchInput {
  /** 所属项目 */
  project_id: number
  /** 父分叉（空 = 从主线分出） */
  parent_branch_id?: number
  /** 分叉点阶段（复制该阶段及其后的阶段） */
  fork_phase_id: number
  /** 分支名 */
  name: string
  /** 变量设定/目的说明 */
  description: string
  /** 相对父分支的变量差异 */
  variable_overrides?: Record<string, unknown>
}

/** 综合对比分析（v0.8 能力④：综合所有分叉的真实数据 + AI 预测结果 + 文献内容） */
export interface ComprehensiveAnalysis {
  /** 综合分析结论（Markdown） */
  summary: string
  /** 各分支/预测结果对比 */
  branch_compare: Array<{
    /** 分支 id（null=主线） */
    branch_id: number | null
    /** 分支/实验名 */
    name: string
    /** 关键结果 */
    key_results: string
    /** 符合预期情况 */
    compliance: string
    /** 优缺点 */
    pros_cons: string
  }>
  /** 文献支撑（引用文献原文/图数据） */
  literature_support: string
  /** 最终结论与建议 */
  conclusion: string
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
  /** 阶段记录/现象（含附件/图表/向量状态） */
  records: ExperimentRecord[]
  /** 自定义数据 */
  customData: CustomData[]
  /** 阶段实验变量（Agent 生成 + 用户自定义） */
  phaseVariables: ExperimentPhaseVariable[]
  /** 实验事件（含图片/视频附件） */
  events: ExperimentEvent[]
  /** 并行实验分叉（树结构，含父分叉引用与入库状态） */
  branches: ExperimentBranch[]
  /** 步骤级并行实验变体（v3 问题⑥） */
  stepExperiments: StepExperiment[]
  /** 参考项目（跨项目共享关系） */
  links: ProjectLink[]
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

// ==================== 主进程 → 渲染进程事件通知（v0.10，见 §10.4） ====================

/** 事件名称（webContents.send 广播通道） */
export type ExperimentEventName =
  /** 结构化状态变更（门禁/步骤/分支/项目状态） */
  | 'experiment:state-changed'
  /** 后台延迟入库完成（§7.11） */
  | 'experiment:index-done'
  /** 收到共享请求（§7.10） */
  | 'experiment:share-request-received'
  /** 共享请求审批结果 */
  | 'experiment:share-resolved'
  /** 文献导入/图表解析进度（用于前端等待动画阶段同步） */
  | 'document-import:progress'

/** 状态变更类型 */
export type ExperimentStateKind =
  /** 阶段门禁（放行/返回修改/解锁） */
  | 'phase-gate'
  /** 步骤状态变更 */
  | 'step-status'
  /** 分叉状态变更（含索引完成） */
  | 'branch-status'
  /** 项目状态变更 */
  | 'project-status'
  /** 记录/事件/变量新增（数据面板刷新） */
  | 'record-added'

/** 事件负载（渲染进程监听后按 projectId 命中刷新视图） */
export interface ExperimentEventPayload {
  /** 所属项目（避免跨项目串扰） */
  projectId: number
  /** 变更类型 */
  kind: ExperimentStateKind
  /** 变更实体 id（阶段/步骤/分支等） */
  entityId?: number
  /** 扩展字段（如 scope 变更值） */
  [key: string]: unknown
}

/** 文献导入/图表解析进度阶段（document-import:progress，前端等待动画按此切换） */
export type DocumentImportStage =
  /** 文本/图片/表格提取（MinerU 或本地 pdfjs） */
  | 'parsing'
  /** 入库 + markdown 落盘 */
  | 'saving'
  /** 论文摘要生成 */
  | 'summarizing'
  /** VLM 图片识别（含逐张完成进度） */
  | 'recognizing'
  /** OCR 文字识别兜底（仅 VLM 失败/未配置时） */
  | 'ocr'
  /** 复现方案生成（渲染进程本地阶段，用于等待动画） */
  | 'planning'
  /** 完成 */
  | 'done'

/** 文献导入进度负载 */
export interface DocumentImportProgress {
  /** 当前阶段 */
  stage: DocumentImportStage
  /** 当前文件序号（1-based，多文件导入） */
  fileIndex?: number
  /** 文件总数 */
  fileTotal?: number
  /** 文件名 */
  fileName?: string
  /** 解析器：mineru / local */
  parser?: string
  /** 图片识别进度：当前完成序号（0-based，VLM 逐张回调） */
  imageIndex?: number
  /** 图片总数 */
  imageTotal?: number
  /** 阶段说明文案 */
  detail?: string
}
