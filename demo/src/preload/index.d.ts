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
  chatList(projectId: number): Promise<unknown[]>
  chatAdd(
    projectId: number,
    role: 'user' | 'assistant',
    content: string,
    chartsJson?: string
  ): Promise<{ id: number }>
  chatClear(projectId: number): Promise<void>
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
    name: string
    content: string
    data_json?: Record<string, unknown>
  }): Promise<{ text: string; charts: unknown[]; compliance: unknown; recordId: number }>
}

interface FileAPI {
  open(): Promise<string[]>
  import(paths: string[]): Promise<unknown[]>
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
    paper: PaperAPI
    figure: FigureAPI
    prediction: PredictionAPI
  }
  ai: AIChatAPI
  file: FileAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DatabaseAPI
  }
}
