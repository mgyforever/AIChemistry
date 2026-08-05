import { getSQLite } from '../sqlite'
import type { Paper } from '../../ai-server/type'

/** 论文 DAO（能力④） */
export const PaperDao = {
  findByProject(projectId: number): Paper[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM papers WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as Paper[]
  },

  create(projectId: number, title: string, content: string, charts = '[]'): { id: number } {
    console.log('[DAO] PaperDao.create, projectId:', projectId, ', title:', title)
    const db = getSQLite()
    const r = db
      .prepare('INSERT INTO papers (project_id, title, content, charts) VALUES (?, ?, ?, ?)')
      .run(projectId, title, content, charts)
    console.log('[DAO] PaperDao.create 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },

  delete(id: number): void {
    console.log('[DAO] PaperDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM papers WHERE id = ?').run(id)
  }
}
