import { getSQLite } from '../sqlite'

export interface Conversation {
  id: number
  token: string
  title: string
  created_at: string
  updated_at: string
}

export const ConversationDao = {
  /** 查询指定用户的全部会话（按 token 区分用户） */
  findAll(token: string): Conversation[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM conversations WHERE token = ? ORDER BY updated_at DESC')
      .all(token) as Conversation[]
  },

  findById(id: number): Conversation | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
      Conversation | undefined
  },

  create(title: string, token: string): { id: number } {
    const db = getSQLite()
    const stmt = db.prepare('INSERT INTO conversations (token, title) VALUES (?, ?)')
    const result = stmt.run(token, title)
    return { id: result.lastInsertRowid as number }
  },

  update(id: number, title: string): void {
    const db = getSQLite()
    db.prepare(
      "UPDATE conversations SET title = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(title, id)
  },

  delete(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  }
}
