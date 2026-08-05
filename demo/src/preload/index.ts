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
      name: string
      content: string
      data_json?: Record<string, unknown>
    }): Promise<{ text: string; charts: unknown[]; compliance: unknown; recordId: number }> =>
      ipcRenderer.invoke('ai:save-record', input)
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
      /** 项目 AI 陪伴对话（持久化，中断后可恢复） */
      chatList: (projectId: number): Promise<unknown[]> => ipcRenderer.invoke('db:project-chat-list', projectId),
      chatAdd: (
        projectId: number,
        role: 'user' | 'assistant',
        content: string,
        chartsJson?: string
      ): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:project-chat-create', projectId, role, content, chartsJson),
      chatClear: (projectId: number): Promise<void> =>
        ipcRenderer.invoke('db:project-chat-clear', projectId)
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
        ipcRenderer.invoke('db:experiment-custom-delete', id)
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
    import: (paths: string[]): Promise<unknown[]> => ipcRenderer.invoke('file:import', paths)
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
