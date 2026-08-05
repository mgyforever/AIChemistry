import { getSQLite } from '../sqlite'

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export const MessageDao = {
  findByConversationId(conversationId: number): Message[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as Message[]
  },

  findById(id: number): Message | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined
  },

  create(
    conversationId: number,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): { id: number } {
    console.log(
      '[DAO] MessageDao.create, conversationId:',
      conversationId,
      ', role:',
      role,
      ', content:',
      content.length > 100 ? content.slice(0, 100) + '...' : content
    )
    const db = getSQLite()
    const stmt = db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    )
    const result = stmt.run(conversationId, role, content)
    console.log('[DAO] MessageDao.create 完成, id:', result.lastInsertRowid)
    return { id: result.lastInsertRowid as number }
  },

  delete(id: number): void {
    console.log('[DAO] MessageDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM messages WHERE id = ?').run(id)
  },

  deleteByConversationId(conversationId: number): void {
    console.log('[DAO] MessageDao.deleteByConversationId, conversationId:', conversationId)
    const db = getSQLite()
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
  }
}
