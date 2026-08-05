import { getSQLite } from '../sqlite'
import type { ProjectChat } from '../../ai-server/type'

/** 项目 AI 陪伴对话 DAO（持久化聊天，实验中断后可恢复上下文） */
export const ProjectChatDao = {
  findByProject(projectId: number): ProjectChat[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_chats WHERE project_id = ? ORDER BY created_at ASC, id ASC')
      .all(projectId) as ProjectChat[]
  },

  create(projectId: number, role: 'user' | 'assistant', content: string, chartsJson = '[]'): { id: number } {
    console.log('[DAO] ProjectChatDao.create, projectId:', projectId, ', role:', role, ', len:', content.length)
    const db = getSQLite()
    const result = db
      .prepare('INSERT INTO project_chats (project_id, role, content, charts_json) VALUES (?, ?, ?, ?)')
      .run(projectId, role, content, chartsJson)
    return { id: result.lastInsertRowid as number }
  },

  deleteByProject(projectId: number): void {
    console.log('[DAO] ProjectChatDao.deleteByProject, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM project_chats WHERE project_id = ?').run(projectId)
  }
}
