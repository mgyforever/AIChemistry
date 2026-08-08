import { reactive } from 'vue'

/**
 * 文献复现工作台 store（独立于聊天）
 * 管理：项目列表 / 当前项目上下文 / AI 陪伴对话
 */

export interface ChartSpecUI {
  id: string
  title: string
  type: string
  echartsOption: Record<string, unknown>
}

export interface AgentMsgUI {
  role: 'user' | 'assistant'
  content: string
  /** assistant 消息附带的图表 */
  charts?: ChartSpecUI[]
}

/** 项目 AI 陪伴对话-会话（新建对话 / 历史对话，与主进程 type.ts 对应） */
export interface ChatConversationUI {
  id: number
  project_id: number
  title: string
  created_at: string
  updated_at: string
  message_count?: number
  preview?: string
}

export interface ProjectUI {
  id: number
  name: string
  description: string
  status: string
  summary: string
  /** 中断恢复点 JSON 字符串（{ activeTab }） */
  resume_state: string
  created_at: string
  updated_at: string
}

/** 复现方案（与主进程 type.ts 对应） */
export interface MaterialUI {
  id: number
  project_id: number
  name: string
  formula: string
  cas: string
  quantity: string
  purity: string
  purpose: string
  notes: string
}
export interface StepUI {
  id: number
  project_id: number
  step_no: number
  title: string
  description: string
  /** 结构化条件对象（旧库数据可能是 JSON 字符串，需兼容解析） */
  conditions: string | Record<string, string>
  duration: string
  notes: string
  /** v0.7：依赖步骤 id（DAG） */
  depends_on: number[]
  /** v0.7：步骤状态机 pending/ready/in_progress/completed/skipped */
  status: string
  /** v0.8：所属分叉，空 = 主线 */
  branch_id: number | null
}
export interface ReactionUI {
  id: number
  project_id: number
  equation: string
  type: string
  purpose: string
  notes: string
}
export interface CharacterizationUI {
  id: number
  project_id: number
  target: string
  method: string
  conditions: string
  expected: string
  notes: string
}
export interface GapUI {
  id: number
  project_id: number
  category: string
  content: string
  impact: string
  assumption: string
}
export interface InstrumentUI {
  id: number
  project_id: number
  name: string
  specification: string
  purpose: string
  notes: string
}
export interface ConcernUI {
  id: number
  project_id: number
  category: string
  content: string
  risk_level: string
  solution: string
}
export interface AssessmentUI {
  id: number
  project_id: number
  difficulty_score: number
  feasibility: string
  analysis: string
  risk_points: string
}
export interface PhaseUI {
  id: number
  project_id: number
  name: string
  phase_order: number
  status: string
  expected: string
  metrics_json: string
  created_at: string
  /** v0.8：所属分叉，空 = 主线 */
  branch_id: number | null
  /** v0.7：门禁状态 locked/open/passed */
  gate_status: string
  /** v0.7：阶段小结（PhaseSummary JSON / Markdown） */
  summary: string | null
  summary_created_at: string | null
  /** v0.7：是否允许与后续阶段并行 */
  can_parallel: number
}
export interface RecordUI {
  id: number
  project_id: number
  phase_id: number | null
  /** v3：所属步骤 */
  step_id: number | null
  record_type: string
  name: string
  content: string
  data_json: string
  expected: string
  compliance_percent: number | null
  is_expected: number | null
  cause_analysis: string
  detail: string
  created_at: string
  /** v0.8：所属分叉，空 = 主线 */
  branch_id: number | null
  /** v3：所属步骤级并行实验变体 */
  step_experiment_id: number | null
  /** v0.9：附件（图片/视频本地路径，JSON） */
  attachments: string
  /** v0.9：ECharts 统计图录数 JSON */
  chart_data: string
  /** v0.9：向量化状态 pending/indexed */
  vector_status: string
}
export interface CustomDataUI {
  id: number
  project_id: number
  record_id: number | null
  /** v3：所属步骤 */
  step_id: number | null
  /** v3：所属步骤级并行实验变体 */
  step_experiment_id: number | null
  data_name: string
  data_type: string
  data_value: string
  unit: string
  extra: string
  created_at: string
}
export interface PredictionUI {
  id: number
  project_id: number
  name: string
  base_flow: string
  variables: string
  predicted_result: string
  property_analysis: string
  theory_basis: string
  created_at: string
  /** v0.8：关联分叉，空 = 主线 */
  branch_id: number | null
  /** v3：关联步骤 */
  step_id: number | null
  /** v3：关联步骤级并行实验变体 */
  step_experiment_id: number | null
}
export interface PaperUI {
  id: number
  project_id: number
  title: string
  content: string
  charts: string
  created_at: string
}
export interface FigureUI {
  id: number
  document_id: number
  project_id: number | null
  figure_index: number
  page_number: number
  figure_type: string
  caption: string
  structured_data: string
  ocr_text: string
  image_path: string
  status: string
  created_at: string
}

// ---- v0.9/v0.10：阶段变量 / 实验事件 / 分叉 / 项目共享（与主进程 type.ts 对应） ----
export interface PhaseVariableUI {
  id: number
  project_id: number
  phase_id: number
  /** v3：所属步骤 */
  step_id: number | null
  branch_id: number | null
  /** v3：所属步骤级并行实验变体 */
  step_experiment_id: number | null
  key: string
  name: string
  type: string
  unit: string
  default_value: string
  current_value: string
  options: string
  is_agent_generated: number
  description: string
  sort_order: number
  created_at: string
}
export interface ExperimentEventUI {
  id: number
  project_id: number
  branch_id: number | null
  phase_id: number | null
  /** v3：所属步骤 */
  step_id: number | null
  /** v3：所属步骤级并行实验变体 */
  step_experiment_id: number | null
  name: string
  content: string
  media_paths: string
  created_at: string
}
export interface BranchUI {
  id: number
  project_id: number
  parent_branch_id: number | null
  name: string
  description: string
  variable_overrides: string
  fork_phase_id: number | null
  index_status: string
  created_at: string
}
export interface ProjectLinkUI {
  id: number
  project_id: number
  ref_project_id: number
  ref_name: string
  scope: string
  created_at: string
}
/** v3：步骤级并行实验变体（问题⑥，与主进程 StepExperiment 对应） */
export interface StepExperimentUI {
  id: number
  project_id: number
  step_id: number
  branch_id: number | null
  parent_experiment_id: number | null
  name: string
  description: string
  variable_overrides: string
  status: string
  created_at: string
}

/** 项目全量上下文（与主进程 db:project-context 对应） */
export interface ProjectContextUI {
  project: ProjectUI
  documents: Array<Record<string, unknown>>
  materials: MaterialUI[]
  steps: StepUI[]
  instruments: InstrumentUI[]
  concerns: ConcernUI[]
  reactions: ReactionUI[]
  characterizations: CharacterizationUI[]
  gaps: GapUI[]
  assessment: AssessmentUI | null
  phases: PhaseUI[]
  records: RecordUI[]
  customData: CustomDataUI[]
  phaseVariables: PhaseVariableUI[]
  events: ExperimentEventUI[]
  branches: BranchUI[]
  stepExperiments: StepExperimentUI[]
  links: ProjectLinkUI[]
  predictions: PredictionUI[]
  papers: PaperUI[]
  summaries: string[]
}

const api = window.api

/** 复现方案确认状态的 localStorage key */
const PLAN_CONFIRM_KEY = 'aichemistry-repro-plan-confirm-v1'

/** 上次打开项目的 localStorage key（下次进入时恢复到上次实验进度） */
const LAST_PROJECT_KEY = 'aichemistry-repro-last-project-v1'

/** 读取上次打开的项目 ID */
export function loadLastProjectId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_PROJECT_KEY)
    if (!raw) return null
    const id = Number(raw)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

/** 记录当前打开的项目 ID */
function saveLastProjectId(id: number): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, String(id))
  } catch {
    /* 忽略写入失败 */
  }
}

/** 读取已确认项目 ID 集合 */
function loadPlanConfirmedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(PLAN_CONFIRM_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'number') : [])
  } catch {
    console.warn('[Store] repro 确认状态解析失败，重置为空')
    return new Set()
  }
}

/** 持久化已确认项目 ID 集合 */
function savePlanConfirmedIds(ids: Set<number>): void {
  try {
    localStorage.setItem(PLAN_CONFIRM_KEY, JSON.stringify([...ids]))
  } catch (err) {
    console.error('[Store] repro 保存确认状态失败:', err)
  }
}

/** 解析 AI 回复 JSON（{think, messages, charts}） */
function parseAiReply(reply: string): { think: string; messages: string; charts: ChartSpecUI[] } {
  try {
    const data = JSON.parse(reply)
    return {
      think: typeof data.think === 'string' ? data.think : '',
      messages: typeof data.messages === 'string' ? data.messages : reply,
      charts: Array.isArray(data.charts) ? data.charts : []
    }
  } catch {
    console.warn('[Store] repro AI 回复非 JSON 格式，整体作为纯文本处理')
    return { think: '', messages: reply, charts: [] }
  }
}

/** 归一化图表 echartsOption：兼容 Agent 偶发把 option 输出为 JSON 字符串的情况（非法项丢弃） */
function normalizeCharts(charts: ChartSpecUI[]): ChartSpecUI[] {
  return charts
    .map((c) => {
      if (!c || typeof c !== 'object') return null
      let opt = c.echartsOption as unknown
      if (typeof opt === 'string') {
        try {
          opt = JSON.parse(opt)
        } catch {
          opt = null
        }
      }
      if (!opt || typeof opt !== 'object' || Array.isArray(opt)) return null
      return { ...c, echartsOption: opt as Record<string, unknown> }
    })
    .filter((c): c is ChartSpecUI => Boolean(c))
}

/** 解析持久化图表的 charts_json 字符串 */
function parseChartsJson(s: string): ChartSpecUI[] {
  try {
    const arr = JSON.parse(s || '[]') as unknown
    return Array.isArray(arr) ? normalizeCharts(arr as ChartSpecUI[]) : []
  } catch {
    return []
  }
}

export const reproStore = reactive({
  projects: [] as ProjectUI[],
  currentProjectId: null as number | null,
  context: null as ProjectContextUI | null,
  /** 当前项目是否处于"预测实验"模式的变量集 */
  messages: [] as AgentMsgUI[],
  /** 当前项目的 AI 陪伴对话会话列表（新建对话 / 历史对话） */
  conversations: [] as ChatConversationUI[],
  /** 当前会话 ID（null = 尚未有会话） */
  currentConversationId: null as number | null,
  isLoading: false,
  /** 已确认复现方案的项目 ID 集合（确认后允许进入阶段与记录） */
  planConfirmedIds: loadPlanConfirmedIds(),

  /* ---------- 项目 ---------- */
  async loadProjects(): Promise<void> {
    console.log('[Store] repro loadProjects 开始')
    const list = (await api.db.project.list()) as ProjectUI[]
    this.projects = list
    console.log('[Store] repro loadProjects 完成, 项目数:', this.projects.length)
  },

  async selectProject(id: number): Promise<void> {
    console.log('[Store] repro selectProject 开始, 项目ID:', id)
    this.currentProjectId = id
    saveLastProjectId(id)
    this.messages = []
    await this.refreshContext()
    // 恢复该项目持久化的 AI 陪伴对话（按会话分组：默认选中最近活跃的会话）
    await this.loadConversations(id)
    console.log(
      '[Store] repro selectProject 完成, 项目ID:',
      id,
      ', 会话数:',
      this.conversations.length,
      ', 恢复对话数:',
      this.messages.length
    )
  },

  /** 加载某项目的会话列表，默认选中最近活跃的会话并加载其消息 */
  async loadConversations(projectId: number): Promise<void> {
    try {
      const list = (await api.db.project.chatConversations(projectId)) as ChatConversationUI[]
      this.conversations = list
      if (list.length) {
        this.currentConversationId = list[0].id
        this.messages = await this.loadChatMessages(list[0].id)
      } else {
        this.currentConversationId = null
        this.messages = []
      }
    } catch (err) {
      console.error('[Store] repro 加载项目会话失败:', err)
      this.conversations = []
      this.currentConversationId = null
      this.messages = []
    }
  },

  /** 刷新会话列表（保持当前会话不变），发送消息后用于更新排序/预览 */
  async refreshConversations(): Promise<void> {
    if (!this.currentProjectId) return
    try {
      this.conversations = (await api.db.project.chatConversations(this.currentProjectId)) as ChatConversationUI[]
    } catch (err) {
      console.error('[Store] repro 刷新会话列表失败:', err)
    }
  },

  /** 加载某会话的持久化消息 */
  async loadChatMessages(conversationId: number): Promise<AgentMsgUI[]> {
    try {
      const rows = (await api.db.project.chatList(conversationId)) as Array<{
        role: 'user' | 'assistant'
        content: string
        charts_json: string
      }>
      return rows.map((r) => ({
        role: r.role,
        content: r.content,
        charts: parseChartsJson(r.charts_json)
      }))
    } catch (err) {
      console.error('[Store] repro 加载项目对话失败:', err)
      return []
    }
  },

  /** 切换会话（历史对话） */
  async selectConversation(id: number): Promise<void> {
    if (id === this.currentConversationId) return
    console.log('[Store] repro selectConversation, 会话ID:', id)
    this.currentConversationId = id
    this.messages = await this.loadChatMessages(id)
  },

  /** 新建对话（立即创建并切换为空会话） */
  async createConversation(title = '新对话'): Promise<ChatConversationUI> {
    if (!this.currentProjectId) throw new Error('未选中项目')
    console.log('[Store] repro createConversation, 项目ID:', this.currentProjectId)
    const { id } = await api.db.project.chatConversationCreate(this.currentProjectId, title)
    const conv: ChatConversationUI = {
      id,
      project_id: this.currentProjectId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
      preview: ''
    }
    this.conversations.unshift(conv)
    this.currentConversationId = id
    this.messages = []
    return conv
  },

  /** 删除会话（该会话下消息级联删除） */
  async deleteConversation(id: number): Promise<void> {
    console.log('[Store] repro deleteConversation, 会话ID:', id)
    await api.db.project.chatConversationDelete(id)
    this.conversations = this.conversations.filter((c) => c.id !== id)
    if (this.currentConversationId === id) {
      if (this.conversations.length) {
        await this.selectConversation(this.conversations[0].id)
      } else {
        this.currentConversationId = null
        this.messages = []
      }
    }
  },

  async refreshContext(): Promise<void> {
    if (!this.currentProjectId) return
    console.log('[Store] repro refreshContext 开始, 项目ID:', this.currentProjectId)
    this.context = (await api.db.project.context(this.currentProjectId)) as ProjectContextUI
    console.log(
      '[Store] repro refreshContext 完成:',
      `材料${this.context.materials.length} 步骤${this.context.steps.length} 阶段${this.context.phases.length} 记录${this.context.records.length} 预测${this.context.predictions.length} 论文${this.context.papers.length}`
    )
  },

  /** 主进程事件监听（v0.10 §10.4）：步骤/门禁/分叉/入库/共享等状态变更后自动刷新（不依赖 AI 对话流） */
  initEventListeners(): () => void {
    const channels = [
      'experiment:state-changed',
      'experiment:index-done',
      'experiment:share-request-received',
      'experiment:share-resolved'
    ]
    const unsubscribes = channels.map((channel) =>
      api.onExperimentEvent(channel, (payload) => {
        const p = (payload ?? {}) as { projectId?: number; kind?: string }
        if (p.projectId !== undefined && p.projectId === this.currentProjectId) {
          console.log('[Store] repro 收到主进程事件:', channel, p.kind ?? '', '项目ID:', p.projectId)
          void this.refreshContext()
        }
      })
    )
    return () => unsubscribes.forEach((unsub) => unsub())
  },

  async createProject(name: string, description = ''): Promise<number> {
    console.log('[Store] repro createProject 开始, 名称:', name.slice(0, 50))
    const { id } = await api.db.project.create(name, description)
    await this.loadProjects()
    console.log('[Store] repro createProject 完成, 项目ID:', id)
    return id
  },

  async deleteProject(id: number): Promise<void> {
    console.log('[Store] repro deleteProject 开始, 项目ID:', id)
    await api.db.project.delete(id)
    this.planConfirmedIds.delete(id)
    savePlanConfirmedIds(this.planConfirmedIds)
    if (this.currentProjectId === id) {
      this.currentProjectId = null
      this.context = null
      this.messages = []
      this.conversations = []
      this.currentConversationId = null
    }
    await this.loadProjects()
    console.log('[Store] repro deleteProject 完成, 项目ID:', id)
  },

  /** 更新项目状态（ongoing 进行中 / paused 已暂停 / completed 已完成） */
  async updateStatus(status: 'ongoing' | 'paused' | 'completed'): Promise<void> {
    if (!this.currentProjectId) return
    console.log('[Store] repro updateStatus 开始, 项目ID:', this.currentProjectId, '状态:', status)
    await api.db.project.update(this.currentProjectId, { status })
    await this.loadProjects()
    await this.refreshContext()
    console.log('[Store] repro updateStatus 完成, 状态:', status)
  },

  /* ---------- 复现方案确认 ---------- */
  isPlanConfirmed(id: number): boolean {
    return this.planConfirmedIds.has(id)
  },

  confirmPlan(id: number): void {
    console.log('[Store] repro confirmPlan, 项目ID:', id)
    this.planConfirmedIds.add(id)
    savePlanConfirmedIds(this.planConfirmedIds)
  },

  /* ---------- 文献导入 ---------- */
  async importDocuments(): Promise<unknown[]> {
    console.log('[Store] repro importDocuments 开始')
    const paths = await api.file.open()
    if (!paths.length) {
      console.log('[Store] repro importDocuments 取消（未选择文件）')
      return []
    }
    const results = await api.file.import(paths)
    console.log('[Store] repro importDocuments 完成, 导入结果数:', results.length)
    return results
  },

  /** 上传文献后确定性解析到当前项目（不依赖 agent 决策），返回解析结果文本 */
  async parseDocumentsToProject(documentIds: number[]): Promise<{ text: string; charts: ChartSpecUI[] }> {
    if (!this.currentProjectId) throw new Error('未选中项目，无法解析文献')
    console.log('[Store] repro parseDocumentsToProject 开始, 项目ID:', this.currentProjectId, ', 文档数:', documentIds.length)
    const result = await api.ai.parseProjectDocuments(this.currentProjectId, documentIds)
    const charts = Array.isArray(result.charts) ? (result.charts as ChartSpecUI[]) : []
    await this.refreshContext()
    console.log('[Store] repro parseDocumentsToProject 完成:', {
      textLen: result.text.length,
      chartCount: charts.length
    })
    return { text: result.text, charts }
  },

  /** 确定性生成论文（直接走 ai:project-generate-paper，不依赖 agent 决策），返回展示文本 */
  async generatePaper(): Promise<string> {
    if (!this.currentProjectId) throw new Error('未选中项目，无法生成论文')
    console.log('[Store] repro generatePaper 开始, 项目ID:', this.currentProjectId)
    const text = await api.ai.generatePaper(this.currentProjectId)
    await this.refreshContext()
    console.log('[Store] repro generatePaper 完成')
    return text
  },

  /* ---------- AI 陪伴对话 ---------- */
  async sendMessage(message: string): Promise<void> {
    if (!message.trim() || this.isLoading) return
    if (!this.currentProjectId) return
    console.log('[Store] repro sendMessage 开始:', message.slice(0, 50))
    // 确保有当前会话：无会话时自动新建（以问题为标题）；"新对话"首次提问时以问题为标题
    if (!this.currentConversationId) {
      await this.createConversation(message.slice(0, 24))
    } else {
      const conv = this.conversations.find((c) => c.id === this.currentConversationId)
      if (conv && conv.title === '新对话') {
        api.db.project.chatConversationRename(conv.id, message.slice(0, 24)).catch(() => {})
        conv.title = message.slice(0, 24)
      }
    }
    const conversationId = this.currentConversationId as number
    this.messages.push({ role: 'user', content: message })
    // 用户消息先持久化：即使本次 AI 回复中断（如关闭应用），下次进入也能看到已发送内容
    api.db.project
      .chatAdd(this.currentProjectId, 'user', message, '[]', conversationId)
      .catch((err) => console.error('[Store] repro 持久化用户消息失败:', err))
    this.isLoading = true
    try {
      const history = this.messages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.role === 'assistant' ? JSON.stringify({ messages: m.content, charts: m.charts ?? [] }) : m.content
      }))
      const reply = await api.ai.experimentChat({
        projectId: this.currentProjectId,
        message,
        history
      })
      const { messages: text, charts } = parseAiReply(reply)
      const normalized = normalizeCharts(charts)
      this.messages.push({ role: 'assistant', content: text, charts: normalized })
      api.db.project
        .chatAdd(this.currentProjectId, 'assistant', text, JSON.stringify(normalized), conversationId)
        .catch((err) => console.error('[Store] repro 持久化助手消息失败:', err))
      // 刷新会话列表（排序/预览随新消息更新）
      await this.refreshConversations()
      await this.refreshContext()
      console.log('[Store] repro sendMessage 完成, 当前消息数:', this.messages.length)
    } catch (err) {
      console.error('[Store] repro sendMessage 异常:', err)
      throw err
    } finally {
      this.isLoading = false
    }
  }
})
