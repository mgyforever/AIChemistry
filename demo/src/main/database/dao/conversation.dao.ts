import { getSQLite } from '../sqlite'

export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

export const ConversationDao = {
  findAll(): Conversation[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
      .all() as Conversation[]
  },

  findById(id: number): Conversation | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
      Conversation | undefined
  },

  create(title: string): { id: number } {
    const db = getSQLite()
    const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?)')
    const result = stmt.run(title)
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
