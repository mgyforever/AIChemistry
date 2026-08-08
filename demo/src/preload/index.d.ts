import { ElectronAPI } from '@electron-toolkit/preload'

interface ConversationAPI {
  list(token: string): Promise<unknown[]>
  get(id: number): Promise<unknown>
  create(title: string, token: string): Promise<{ id: number }>
  update(id: number, title: string): Promise<void>
  delete(id: number): Promise<void>
}

interface MessageAPI {
  list(conversationId: number): Promise<unknown[]>
  get(id: number): Promise<unknown>
  create(
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<{ id: number }>
  delete(id: number): Promise<void>
}

interface DocumentAPI {
  list(): Promise<unknown[]>
  get(id: number): Promise<unknown>
  create(title: string, content: string, metadata?: string): Promise<{ id: number }>
  update(id: number, title: string, content: string, metadata?: string): Promise<void>
  delete(id: number): Promise<void>
}

interface LanceDBAPI {
  createTable(name: string, data: Record<string, unknown>[]): Promise<void>
  add(tableName: string, data: Record<string, unknown>[]): Promise<void>
  search(tableName: string, vector: number[], limit?: number): Promise<Record<string, unknown>[]>
  tableExists(name: string): Promise<boolean>
}

// ========== 实验复现 Agent（P2 新增） ==========

interface ProjectAPI {
  list(): Promise<unknown[]>
  get(id: number): Promise<unknown>
  create(name: string, description?: string): Promise<{ id: number }>
  update(id: number, patch: Record<string, unknown>): Promise<void>
  delete(id: number): Promise<void>
  addDocument(projectId: number, documentId: number, role?: string): Promise<{ id: number }>
  context(id: number): Promise<unknown>
  /** 项目 AI 陪伴对话（持久化，中断后可恢复） */
  chatList(conversationId: number): Promise<unknown[]>
  chatAdd(
    projectId: number,
    role: 'user' | 'assistant',
    content: string,
    chartsJson?: string,
    conversationId?: number
  ): Promise<{ id: number }>
  chatClear(projectId: number): Promise<void>
  /** 会话分组（新建对话 / 历史对话） */
  chatConversations(projectId: number): Promise<unknown[]>
  chatConversationCreate(projectId: number, title?: string): Promise<{ id: number }>
  chatConversationRename(id: number, title: string): Promise<void>
  chatConversationDelete(id: number): Promise<void>
}

interface ReproductionAPI {
  get(projectId: number): Promise<unknown>
  save(projectId: number, data: Record<string, unknown>): Promise<void>
}

interface ExperimentAPI {
  phases(projectId: number): Promise<unknown[]>
  addPhase(projectId: number, name: string, expected?: string, order?: number): Promise<{ id: number }>
  updatePhase(id: number, patch: Record<string, unknown>): Promise<void>
  deletePhase(id: number): Promise<void>
  records(projectId: number): Promise<unknown[]>
  addRecord(projectId: number, data: Record<string, unknown>): Promise<{ id: number }>
  deleteRecord(id: number): Promise<void>
  customData(projectId: number): Promise<unknown[]>
  addCustomData(projectId: number, data: Record<string, unknown>): Promise<{ id: number }>
  deleteCustomData(id: number): Promise<void>
  // ---- v0.7：步骤 DAG 与阶段门禁 ----
  updateStepStatus(id: number, status: string): Promise<void>
  readySteps(projectId: number, branchId: number | null): Promise<unknown[]>
  recomputeSteps(projectId: number, branchId: number | null): Promise<void>
  // v3 问题④：步骤增删改
  updateStep(id: number, patch: Record<string, unknown>): Promise<void>
  addStep(projectId: number, data: Record<string, unknown>): Promise<{ id: number }>
  deleteStep(id: number): Promise<void>
  // v3 问题⑥：步骤级并行实验变体
  stepExperiments(projectId: number): Promise<unknown[]>
  createStepExperiment(data: Record<string, unknown>): Promise<{ id: number }>
  updateStepExperiment(id: number, patch: Record<string, unknown>): Promise<void>
  deleteStepExperiment(id: number): Promise<void>
  writePhaseSummary(id: number, patch: { summary: string; status: 'pending_review' }): Promise<void>
  summaryAi(projectId: number, phaseId: number): Promise<string>
  confirmGate(id: number, decision: 'pass' | 'back', gateStatus: string, status?: string): Promise<void>
  // ---- v0.8：并行实验分叉 ----
  branches(projectId: number): Promise<unknown[]>
  createBranch(data: Record<string, unknown>): Promise<{ id: number }>
  finishBranch(branchId: number | null, projectId?: number): Promise<void>
  branchPhases(branchId: number): Promise<unknown[]>
  branchRecords(branchId: number): Promise<unknown[]>
  // ---- v0.9：阶段实验变量 / 实验事件 ----
  phaseVariables(phaseId: number, branchId: number | null): Promise<unknown[]>
  upsertPhaseVariable(data: Record<string, unknown>): Promise<{ id: number }>
  deletePhaseVariable(id: number): Promise<void>
  events(projectId: number, phaseId: number | null, branchId: number | null): Promise<unknown[]>
  addEvent(data: Record<string, unknown>): Promise<{ id: number }>
  deleteEvent(id: number): Promise<void>
}

// ---- v0.9/v0.10：项目间共享 ----
interface LinkAPI {
  list(projectId: number): Promise<unknown[]>
  add(projectId: number, refProjectId: number, scope?: string): Promise<{ id: number }>
  remove(id: number): Promise<void>
  requestList(projectId: number, asRequester: boolean): Promise<unknown[]>
  requestCreate(data: Record<string, unknown>): Promise<{ id: number }>
  requestResolve(id: number, decision: 'approve' | 'reject'): Promise<void>
}

interface PaperAPI {
  list(projectId: number): Promise<unknown[]>
  create(projectId: number, title: string, content: string, charts?: string): Promise<{ id: number }>
  delete(id: number): Promise<void>
}

interface FigureAPI {
  listByDoc(documentId: number): Promise<unknown[]>
  listByProject(projectId: number): Promise<unknown[]>
  create(data: Record<string, unknown>): Promise<{ id: number }>
  update(id: number, patch: Record<string, unknown>): Promise<void>
  delete(id: number): Promise<void>
}

interface PredictionAPI {
  list(projectId: number): Promise<unknown[]>
  create(data: Record<string, unknown>): Promise<{ id: number }>
  delete(id: number): Promise<void>
}

interface AIChatAPI {
  chat(messages: { role: string; content: string }[]): Promise<string>
  chatStream(messages: { role: string; content: string }[]): Promise<string>
  /** 实验复现 Agent（与聊天完全独立） */
  experimentChat(req: {
    projectId?: number
    message: string
    history: { role: string; content: string }[]
  }): Promise<string>
  /** 上传文献后确定性解析到当前项目（返回文本 + 图表） */
  parseProjectDocuments(
    projectId: number,
    documentIds: number[]
  ): Promise<{ text: string; charts: unknown[] }>
  /** 主界面表单保存实验记录（自动分析符合度） */
  saveRecord(input: {
    project_id: number
    phase_id?: number
    step_id?: number
    branch_id?: number | null
    step_experiment_id?: number | null
    name: string
    content: string
    data_json?: Record<string, unknown>
    attachments?: string[]
    chart_data?: Record<string, unknown>
  }): Promise<{ text: string; charts: unknown[]; compliance: unknown; recordId: number }>
  /** 确定性生成论文（不依赖 agent 决策），返回展示文本 */
  generatePaper(projectId: number): Promise<string>
}

interface FileAPI {
  open(): Promise<string[]>
  import(paths: string[]): Promise<unknown[]>
  // v0.9：图片/视频附件
  pickMedia(): Promise<string[]>
  importMedia(projectId: number, sourcePaths: string[]): Promise<string[]>
  cleanupMedia(projectId: number): Promise<void>
  openMedia(filePath: string): Promise<string>
  readMedia(filePath: string): Promise<string | null>
}

/** v3：步骤详情窗口 API（独立 Electron 窗口） */
interface StepDetailWindowAPI {
  openStepDetail(projectId: number, stepId: number): Promise<void>
  claimStepDetailInit(): Promise<{ projectId: number; stepId: number } | null>
  onStepDetailEvent(channel: string, callback: (payload: unknown) => void): () => void
}

interface DatabaseAPI {
  db: {
    conversation: ConversationAPI
    message: MessageAPI
    document: DocumentAPI
    lancedb: LanceDBAPI
    project: ProjectAPI
    reproduction: ReproductionAPI
    experiment: ExperimentAPI
    link: LinkAPI
    paper: PaperAPI
    figure: FigureAPI
    prediction: PredictionAPI
  }
  ai: AIChatAPI
  file: FileAPI
  window: StepDetailWindowAPI
  /** 主进程事件监听（v0.10 §10.4），返回注销函数 */
  onExperimentEvent(channel: string, callback: (payload: unknown) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DatabaseAPI
  }
}
