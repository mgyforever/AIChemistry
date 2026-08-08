import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // ========== AI Chat ==========
  ai: {
    chat: (messages: { role: string; content: string }[]): Promise<string> =>
      ipcRenderer.invoke('ai:chat', messages),
    chatStream: (messages: { role: string; content: string }[]): Promise<string> =>
      ipcRenderer.invoke('ai:chat-stream', messages),
    experimentChat: (req: {
      projectId?: number
      message: string
      history: { role: string; content: string }[]
    }): Promise<string> => ipcRenderer.invoke('ai:experiment-chat-stream', req),
    /** 上传文献后确定性解析到当前项目（返回文本 + 图表，不依赖 agent 决策） */
    parseProjectDocuments: (
      projectId: number,
      documentIds: number[]
    ): Promise<{ text: string; charts: unknown[] }> =>
      ipcRenderer.invoke('ai:project-parse-documents', projectId, documentIds),
    /** 主界面表单保存实验记录（自动分析符合度） */
    saveRecord: (input: {
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
    }): Promise<{ text: string; charts: unknown[]; compliance: unknown; recordId: number }> =>
      ipcRenderer.invoke('ai:save-record', input),
    /** 确定性生成论文（不依赖 agent 决策），返回展示文本 */
    generatePaper: (projectId: number): Promise<string> =>
      ipcRenderer.invoke('ai:project-generate-paper', projectId)
  },
  db: {
    // ========== Conversation ==========
    conversation: {
      list: (token: string): Promise<unknown[]> =>
        ipcRenderer.invoke('db:conversation-list', token),
      get: (id: number): Promise<unknown> => ipcRenderer.invoke('db:conversation-get', id),
      create: (title: string, token: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:conversation-create', title, token),
      update: (id: number, title: string): Promise<void> =>
        ipcRenderer.invoke('db:conversation-update', id, title),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:conversation-delete', id)
    },
    // ========== Message ==========
    message: {
      list: (conversationId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:message-list', conversationId),
      get: (id: number): Promise<unknown> => ipcRenderer.invoke('db:message-get', id),
      create: (
        conversationId: number,
        role: 'user' | 'assistant' | 'system',
        content: string
      ): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:message-create', conversationId, role, content),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:message-delete', id)
    },
    // ========== Document ==========
    document: {
      list: (): Promise<unknown[]> => ipcRenderer.invoke('db:document-list'),
      get: (id: number): Promise<unknown> => ipcRenderer.invoke('db:document-get', id),
      create: (title: string, content: string, metadata?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:document-create', title, content, metadata),
      update: (id: number, title: string, content: string, metadata?: string): Promise<void> =>
        ipcRenderer.invoke('db:document-update', id, title, content, metadata),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:document-delete', id)
    },
    // ========== LanceDB ==========
    lancedb: {
      createTable: (name: string, data: Record<string, unknown>[]): Promise<void> =>
        ipcRenderer.invoke('db:lancedb-create-table', name, data),
      add: (tableName: string, data: Record<string, unknown>[]): Promise<void> =>
        ipcRenderer.invoke('db:lancedb-add', tableName, data),
      search: (
        tableName: string,
        vector: number[],
        limit?: number
      ): Promise<Record<string, unknown>[]> =>
        ipcRenderer.invoke('db:lancedb-search', tableName, vector, limit),
      tableExists: (name: string): Promise<boolean> =>
        ipcRenderer.invoke('db:lancedb-table-exists', name)
    },

    // ========== 实验复现 Agent（P2 新增） ==========
    project: {
      list: (): Promise<unknown[]> => ipcRenderer.invoke('db:project-list'),
      get: (id: number): Promise<unknown> => ipcRenderer.invoke('db:project-get', id),
      create: (name: string, description?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:project-create', name, description),
      update: (id: number, patch: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:project-update', id, patch),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:project-delete', id),
      addDocument: (projectId: number, documentId: number, role?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:project-document-create', projectId, documentId, role),
      context: (id: number): Promise<unknown> => ipcRenderer.invoke('db:project-context', id),
      /** 项目 AI 陪伴对话（会话分组：新建对话 / 历史对话） */
      chatList: (conversationId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:project-chat-list', conversationId),
      chatAdd: (
        projectId: number,
        role: 'user' | 'assistant',
        content: string,
        chartsJson?: string,
        conversationId?: number
      ): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:project-chat-create', projectId, role, content, chartsJson, conversationId),
      chatClear: (projectId: number): Promise<void> =>
        ipcRenderer.invoke('db:project-chat-clear', projectId),
      chatConversations: (projectId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:project-chat-conv-list', projectId),
      chatConversationCreate: (projectId: number, title?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:project-chat-conv-create', projectId, title),
      chatConversationRename: (id: number, title: string): Promise<void> =>
        ipcRenderer.invoke('db:project-chat-conv-rename', id, title),
      chatConversationDelete: (id: number): Promise<void> =>
        ipcRenderer.invoke('db:project-chat-conv-delete', id)
    },
    reproduction: {
      get: (projectId: number): Promise<unknown> => ipcRenderer.invoke('db:reproduction-get', projectId),
      save: (projectId: number, data: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:reproduction-save', projectId, data)
    },
    experiment: {
      phases: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:experiment-phases', projectId),
      addPhase: (projectId: number, name: string, expected?: string, order?: number): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:experiment-phase-add', projectId, name, expected, order),
      updatePhase: (id: number, patch: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:experiment-phase-update', id, patch),
      deletePhase: (id: number): Promise<void> => ipcRenderer.invoke('db:experiment-phase-delete', id),
      records: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:experiment-records', projectId),
      addRecord: (projectId: number, data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:experiment-record-add', projectId, data),
      deleteRecord: (id: number): Promise<void> => ipcRenderer.invoke('db:experiment-record-delete', id),
      customData: (projectId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:experiment-custom-data', projectId),
      addCustomData: (projectId: number, data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:experiment-custom-add', projectId, data),
      deleteCustomData: (id: number): Promise<void> =>
        ipcRenderer.invoke('db:experiment-custom-delete', id),
      // ---- v0.7：步骤 DAG 与阶段门禁 ----
      updateStepStatus: (id: number, status: string): Promise<void> =>
        ipcRenderer.invoke('db:step-update-status', id, status),
      readySteps: (projectId: number, branchId: number | null): Promise<unknown[]> =>
        ipcRenderer.invoke('db:step-ready-list', projectId, branchId),
      recomputeSteps: (projectId: number, branchId: number | null): Promise<void> =>
        ipcRenderer.invoke('db:step-recompute', projectId, branchId),
      // v3 问题④：步骤增删改
      updateStep: (id: number, patch: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:step-update', id, patch),
      addStep: (projectId: number, data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:step-add', projectId, data),
      deleteStep: (id: number): Promise<void> => ipcRenderer.invoke('db:step-delete', id),
      // v3 问题⑥：步骤级并行实验变体
      stepExperiments: (projectId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:step-experiment-list', projectId),
      createStepExperiment: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:step-experiment-create', data),
      updateStepExperiment: (id: number, patch: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:step-experiment-update', id, patch),
      deleteStepExperiment: (id: number): Promise<void> =>
        ipcRenderer.invoke('db:step-experiment-delete', id),
      writePhaseSummary: (id: number, patch: { summary: string; status: 'pending_review' }): Promise<void> =>
        ipcRenderer.invoke('db:phase-generate-summary', id, patch),
      /** 用户点击"生成小结"→ 主进程 LLM 生成阶段小结并写入（返回小结 Markdown） */
      summaryAi: (projectId: number, phaseId: number): Promise<string> =>
        ipcRenderer.invoke('db:phase-summary-ai', projectId, phaseId),
      confirmGate: (id: number, decision: 'pass' | 'back', gateStatus: string, status?: string): Promise<void> =>
        ipcRenderer.invoke('db:phase-confirm-gate', id, decision, gateStatus, status),
      // ---- v0.8：并行实验分叉 ----
      branches: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:branch-list', projectId),
      createBranch: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:branch-create', data),
      finishBranch: (branchId: number | null, projectId?: number): Promise<void> =>
        ipcRenderer.invoke('db:branch-finish', branchId, projectId),
      branchPhases: (branchId: number): Promise<unknown[]> => ipcRenderer.invoke('db:branch-phases', branchId),
      branchRecords: (branchId: number): Promise<unknown[]> => ipcRenderer.invoke('db:branch-records', branchId),
      // ---- v0.9：阶段实验变量 / 实验事件 ----
      phaseVariables: (phaseId: number, branchId: number | null): Promise<unknown[]> =>
        ipcRenderer.invoke('db:phase-variables', phaseId, branchId),
      upsertPhaseVariable: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:phase-variable-upsert', data),
      deletePhaseVariable: (id: number): Promise<void> => ipcRenderer.invoke('db:phase-variable-delete', id),
      events: (projectId: number, phaseId: number | null, branchId: number | null): Promise<unknown[]> =>
        ipcRenderer.invoke('db:event-list', projectId, phaseId, branchId),
      addEvent: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:event-add', data),
      deleteEvent: (id: number): Promise<void> => ipcRenderer.invoke('db:event-delete', id)
    },
    // ---- v0.9/v0.10：项目间共享 ----
    link: {
      list: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:link-list', projectId),
      add: (projectId: number, refProjectId: number, scope?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:link-add', projectId, refProjectId, scope),
      remove: (id: number): Promise<void> => ipcRenderer.invoke('db:link-remove', id),
      requestList: (projectId: number, asRequester: boolean): Promise<unknown[]> =>
        ipcRenderer.invoke('db:link-request-list', projectId, asRequester),
      requestCreate: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:link-request-create', data),
      requestResolve: (id: number, decision: 'approve' | 'reject'): Promise<void> =>
        ipcRenderer.invoke('db:link-request-resolve', id, decision)
    },
    paper: {
      list: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:paper-list', projectId),
      create: (projectId: number, title: string, content: string, charts?: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:paper-create', projectId, title, content, charts),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:paper-delete', id)
    },
    figure: {
      listByDoc: (documentId: number): Promise<unknown[]> => ipcRenderer.invoke('db:figure-list-by-doc', documentId),
      listByProject: (projectId: number): Promise<unknown[]> =>
        ipcRenderer.invoke('db:figure-list-by-project', projectId),
      create: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:figure-create', data),
      update: (id: number, patch: Record<string, unknown>): Promise<void> =>
        ipcRenderer.invoke('db:figure-update', id, patch),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:figure-delete', id)
    },
    prediction: {
      list: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:prediction-list', projectId),
      create: (data: Record<string, unknown>): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:prediction-create', data),
      delete: (id: number): Promise<void> => ipcRenderer.invoke('db:prediction-delete', id)
    }
  },
  // ========== 文件导入（P3/P4） ==========
  file: {
    open: (): Promise<string[]> => ipcRenderer.invoke('file:open'),
    import: (paths: string[]): Promise<unknown[]> => ipcRenderer.invoke('file:import', paths),
    // v0.9：图片/视频附件
    pickMedia: (): Promise<string[]> => ipcRenderer.invoke('file:pick-media'),
    importMedia: (projectId: number, sourcePaths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('file:import-media', projectId, sourcePaths),
    cleanupMedia: (projectId: number): Promise<void> => ipcRenderer.invoke('file:cleanup-media', projectId),
    /** 用系统默认程序打开本地附件（图片/视频） */
    openMedia: (filePath: string): Promise<string> => ipcRenderer.invoke('file:open-media', filePath),
    /** 读取本地图片转 data URL 供 <img> 预览（视频返回 null） */
    readMedia: (filePath: string): Promise<string | null> => ipcRenderer.invoke('file:read-media', filePath)
  },
  // ========== 步骤详情窗口（v3 问题③：独立 Electron 窗口） ==========
  window: {
    /** 打开（或复用）某项目的步骤详情窗口，并切换到/新增该步骤标签 */
    openStepDetail: (projectId: number, stepId: number): Promise<void> =>
      ipcRenderer.invoke('window:open-step-detail', projectId, stepId),
    /** 步骤详情窗口挂载后领取初始 { projectId, stepId } */
    claimStepDetailInit: (): Promise<{ projectId: number; stepId: number } | null> =>
      ipcRenderer.invoke('window:step-detail-claim'),
    /** 监听步骤详情窗口事件（step-detail:init / step-detail:add-tab），返回注销函数 */
    onStepDetailEvent: (channel: string, callback: (payload: unknown) => void): (() => void) => {
      const listener = (_event: unknown, payload: unknown): void => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  // ========== 主进程事件监听（v0.10，§10.4） ==========
  /** 注册实验状态变更事件监听（返回取消函数） */
  onExperimentEvent: (channel: string, callback: (payload: unknown) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('[Preload] 暴露 API 完成')
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
