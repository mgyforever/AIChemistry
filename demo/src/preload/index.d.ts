import { ElectronAPI } from '@electron-toolkit/preload'

interface ConversationAPI {
  list(): Promise<unknown[]>
  get(id: number): Promise<unknown>
  create(title: string): Promise<{ id: number }>
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

interface DatabaseAPI {
  conversation: ConversationAPI
  message: MessageAPI
  document: DocumentAPI
  lancedb: LanceDBAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DatabaseAPI
  }
}
