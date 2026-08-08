import { getSQLite } from '../sqlite'
import type { ProjectChatConversation } from '../../ai-server/type'

/** 项目 AI 陪伴对话-会话分组 DAO（新建对话 / 历史对话） */
export const ProjectChatConversationDao = {
  /** 某项目的会话列表（含消息数与最近预览，按最近活跃倒序） */
  listByProject(projectId: number): ProjectChatConversation[] {
    const db = getSQLite()
    return db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM project_chats m WHERE m.conversation_id = c.id) AS message_count,
          (SELECT m.content FROM project_chats m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
         FROM project_chat_conversations c
         WHERE c.project_id = ?
         ORDER BY c.updated_at DESC, c.id DESC`
      )
      .all(projectId) as ProjectChatConversation[]
  },

  create(projectId: number, title = '新对话'): { id: number } {
    console.log('[DAO] ProjectChatConversationDao.create, projectId:', projectId, ', title:', title.slice(0, 30))
    const db = getSQLite()
    const r = db
      .prepare('INSERT INTO project_chat_conversations (project_id, title) VALUES (?, ?)')
      .run(projectId, title)
    return { id: r.lastInsertRowid as number }
  },

  rename(id: number, title: string): void {
    console.log('[DAO] ProjectChatConversationDao.rename, id:', id, ', title:', title.slice(0, 30))
    const db = getSQLite()
    db.prepare(
      "UPDATE project_chat_conversations SET title = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(title, id)
  },

  delete(id: number): void {
    console.log('[DAO] ProjectChatConversationDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM project_chat_conversations WHERE id = ?').run(id)
  },

  deleteByProject(projectId: number): void {
    console.log('[DAO] ProjectChatConversationDao.deleteByProject, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM project_chat_conversations WHERE project_id = ?').run(projectId)
  }
}
