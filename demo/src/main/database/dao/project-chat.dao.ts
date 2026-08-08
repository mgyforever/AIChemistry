import { getSQLite } from '../sqlite'
import type { ProjectChat } from '../../ai-server/type'

/** 项目 AI 陪伴对话消息 DAO（按会话分组，持久化聊天） */
export const ProjectChatDao = {
  /** 某会话的全部消息（时间正序） */
  findByConversation(conversationId: number): ProjectChat[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_chats WHERE conversation_id = ? ORDER BY created_at ASC, id ASC')
      .all(conversationId) as ProjectChat[]
  },

  /**
   * 新增一条消息。
   * 传入 conversationId 时同步刷新会话的 updated_at（会话列表按活跃时间排序）。
   */
  create(
    projectId: number,
    role: 'user' | 'assistant',
    content: string,
    chartsJson = '[]',
    conversationId?: number | null
  ): { id: number } {
    console.log(
      '[DAO] ProjectChatDao.create, projectId:',
      projectId,
      ', conversationId:',
      conversationId ?? '-',
      ', role:',
      role,
      ', len:',
      content.length
    )
    const db = getSQLite()
    const result = db
      .prepare(
        'INSERT INTO project_chats (project_id, conversation_id, role, content, charts_json) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, conversationId ?? null, role, content, chartsJson)
    if (conversationId) {
      db.prepare(
        "UPDATE project_chat_conversations SET updated_at = datetime('now','localtime') WHERE id = ?"
      ).run(conversationId)
    }
    return { id: result.lastInsertRowid as number }
  },

  deleteByProject(projectId: number): void {
    console.log('[DAO] ProjectChatDao.deleteByProject, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM project_chats WHERE project_id = ?').run(projectId)
  }
}
