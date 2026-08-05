import { getSQLite } from '../sqlite'

export interface Document {
  id: number
  title: string
  content: string
  metadata: string
  created_at: string
  updated_at: string
}

export const DocumentDao = {
  findAll(): Document[] {
    const db = getSQLite()
    return db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all() as Document[]
  },

  findById(id: number): Document | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Document | undefined
  },

  create(title: string, content: string, metadata: string = '{}'): { id: number } {
    console.log(
      '[DAO] DocumentDao.create, title:',
      title,
      ', content:',
      content.length > 100 ? content.slice(0, 100) + '...' : content
    )
    const db = getSQLite()
    const stmt = db.prepare('INSERT INTO documents (title, content, metadata) VALUES (?, ?, ?)')
    const result = stmt.run(title, content, metadata)
    console.log('[DAO] DocumentDao.create 完成, id:', result.lastInsertRowid)
    return { id: result.lastInsertRowid as number }
  },

  update(id: number, title: string, content: string, metadata: string = '{}'): void {
    console.log(
      '[DAO] DocumentDao.update, id:',
      id,
      ', title:',
      title,
      ', content:',
      content.length > 100 ? content.slice(0, 100) + '...' : content
    )
    const db = getSQLite()
    db.prepare(
      "UPDATE documents SET title = ?, content = ?, metadata = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(title, content, metadata, id)
    console.log('[DAO] DocumentDao.update 完成, id:', id)
  },

  delete(id: number): void {
    console.log('[DAO] DocumentDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  }
}
