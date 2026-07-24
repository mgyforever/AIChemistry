import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  db: {
    // ========== Conversation ==========
    conversation: {
      list: (): Promise<unknown[]> => ipcRenderer.invoke('db:conversation-list'),
      get: (id: number): Promise<unknown> => ipcRenderer.invoke('db:conversation-get', id),
      create: (title: string): Promise<{ id: number }> =>
        ipcRenderer.invoke('db:conversation-create', title),
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
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
