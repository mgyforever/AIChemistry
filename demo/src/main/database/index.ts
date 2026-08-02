import { ipcMain } from 'electron'
import { initSQLite, closeSQLite } from './sqlite'
import { initLanceDB, createTable, addData, searchVectors, tableExists } from './lancedb'
import { ConversationDao, MessageDao, DocumentDao } from './dao'

export async function initDatabases(): Promise<void> {
  initSQLite()
  await initLanceDB()
  registerIpcHandlers()
}

function registerIpcHandlers(): void {
  // ========== Conversation DAO handlers ==========

  ipcMain.handle('db:conversation-list', (_event, token: string) => {
    return ConversationDao.findAll(token)
  })

  ipcMain.handle('db:conversation-get', (_event, id: number) => {
    return ConversationDao.findById(id)
  })

  ipcMain.handle('db:conversation-create', (_event, title: string, token: string) => {
    return ConversationDao.create(title, token)
  })

  ipcMain.handle('db:conversation-update', (_event, id: number, title: string) => {
    ConversationDao.update(id, title)
  })

  ipcMain.handle('db:conversation-delete', (_event, id: number) => {
    ConversationDao.delete(id)
  })

  // ========== Message DAO handlers ==========

  ipcMain.handle('db:message-list', (_event, conversationId: number) => {
    return MessageDao.findByConversationId(conversationId)
  })

  ipcMain.handle('db:message-get', (_event, id: number) => {
    return MessageDao.findById(id)
  })

  ipcMain.handle(
    'db:message-create',
    (_event, conversationId: number, role: 'user' | 'assistant' | 'system', content: string) => {
      return MessageDao.create(conversationId, role, content)
    }
  )

  ipcMain.handle('db:message-delete', (_event, id: number) => {
    MessageDao.delete(id)
  })

  // ========== Document DAO handlers ==========

  ipcMain.handle('db:document-list', () => {
    return DocumentDao.findAll()
  })

  ipcMain.handle('db:document-get', (_event, id: number) => {
    return DocumentDao.findById(id)
  })

  ipcMain.handle(
    'db:document-create',
    (_event, title: string, content: string, metadata?: string) => {
      return DocumentDao.create(title, content, metadata)
    }
  )

  ipcMain.handle(
    'db:document-update',
    (_event, id: number, title: string, content: string, metadata?: string) => {
      DocumentDao.update(id, title, content, metadata)
    }
  )

  ipcMain.handle('db:document-delete', (_event, id: number) => {
    DocumentDao.delete(id)
  })

  // ========== LanceDB handlers ==========

  ipcMain.handle(
    'db:lancedb-create-table',
    async (_event, name: string, data: Record<string, unknown>[]) => {
      await createTable(name, data)
    }
  )

  ipcMain.handle(
    'db:lancedb-add',
    async (_event, tableName: string, data: Record<string, unknown>[]) => {
      await addData(tableName, data)
    }
  )

  ipcMain.handle(
    'db:lancedb-search',
    async (_event, tableName: string, vector: number[], limit?: number) => {
      return await searchVectors(tableName, vector, limit)
    }
  )

  ipcMain.handle('db:lancedb-table-exists', async (_event, name: string) => {
    return await tableExists(name)
  })
}

export function closeDatabases(): void {
  closeSQLite()
}
