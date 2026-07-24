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
    const db = getSQLite()
    const stmt = db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    )
    const result = stmt.run(conversationId, role, content)
    return { id: result.lastInsertRowid as number }
  },

  delete(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM messages WHERE id = ?').run(id)
  },

  deleteByConversationId(conversationId: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
  }
}
