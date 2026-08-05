import { getSQLite } from '../sqlite'
import type { Project, ProjectDocument } from '../../ai-server/type'

/** 实验项目 DAO（能力①） */
export const ProjectDao = {
  findAll(): Project[] {
    const db = getSQLite()
    return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[]
  },

  findById(id: number): Project | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined
  },

  findByName(name: string): Project | undefined {
    console.log('[DAO] ProjectDao.findByName, name:', name)
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM projects WHERE name = ? ORDER BY updated_at DESC LIMIT 1')
      .get(name) as Project | undefined
  },

  create(name: string, description = '', summary = ''): { id: number } {
    console.log('[DAO] ProjectDao.create, name:', name)
    const db = getSQLite()
    const result = db
      .prepare('INSERT INTO projects (name, description, summary) VALUES (?, ?, ?)')
      .run(name, description, summary)
    console.log('[DAO] ProjectDao.create 完成, id:', result.lastInsertRowid)
    return { id: result.lastInsertRowid as number }
  },

  update(
    id: number,
    patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'summary' | 'resume_state'>>
  ): void {
    console.log('[DAO] ProjectDao.update, id:', id, ', patch:', JSON.stringify(patch))
    const db = getSQLite()
    const sets: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      sets.push('name = ?')
      values.push(patch.name)
    }
    if (patch.description !== undefined) {
      sets.push('description = ?')
      values.push(patch.description)
    }
    if (patch.status !== undefined) {
      sets.push('status = ?')
      values.push(patch.status)
    }
    if (patch.summary !== undefined) {
      sets.push('summary = ?')
      values.push(patch.summary)
    }
    if (patch.resume_state !== undefined) {
      sets.push('resume_state = ?')
      values.push(patch.resume_state)
    }
    if (sets.length === 0) return
    sets.push("updated_at = datetime('now', 'localtime')")
    values.push(id)
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    console.log('[DAO] ProjectDao.update 完成, id:', id)
  },

  delete(id: number): void {
    console.log('[DAO] ProjectDao.delete, id:', id)
    const db = getSQLite()
    // 级联删除该项目全部关联数据
    db.transaction(() => {
      // 记录该项目关联的文献（用于清理孤儿文献）
      const linkedDocs = (
        db.prepare('SELECT document_id FROM project_documents WHERE project_id = ?').all(id) as { document_id: number }[]
      ).map((r) => r.document_id)
      // 1. 关联文献
      db.prepare('DELETE FROM project_documents WHERE project_id = ?').run(id)
      // 2. 复现方案
      db.prepare('DELETE FROM reproduction_materials WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM reproduction_steps WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM reproduction_instruments WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM reproduction_concerns WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM reproduction_assessment WHERE project_id = ?').run(id)
      // 3. 实验阶段与记录
      db.prepare('DELETE FROM experiment_phases WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM experiment_records WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM experiment_custom_data WHERE project_id = ?').run(id)
      // 4. 论文 / 预测实验
      db.prepare('DELETE FROM papers WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM prediction_experiments WHERE project_id = ?').run(id)
      // 5. 该项目解析出的图表（关联 project_id）
      db.prepare('DELETE FROM document_figures WHERE project_id = ?').run(id)
      // 6. 项目本身
      db.prepare('DELETE FROM projects WHERE id = ?').run(id)
      // 7. 清理不再被任何项目引用的孤儿文献及其图表
      for (const docId of linkedDocs) {
        const stillUsed = (
          db.prepare('SELECT 1 FROM project_documents WHERE document_id = ? LIMIT 1').all(docId) as unknown[]
        ).length
        if (!stillUsed) {
          db.prepare('DELETE FROM document_figures WHERE document_id = ?').run(docId)
          db.prepare('DELETE FROM documents WHERE id = ?').run(docId)
          console.log('[DAO] ProjectDao.delete 清理孤儿文献 document_id:', docId)
        }
      }
    })()
    console.log('[DAO] ProjectDao.delete 完成, id:', id, ', 已级联清理关联数据')
  }
}

/** 项目-文献关联 DAO */
export const ProjectDocumentDao = {
  findByProject(projectId: number): ProjectDocument[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_documents WHERE project_id = ?')
      .all(projectId) as ProjectDocument[]
  },

  findByDocument(documentId: number): ProjectDocument[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_documents WHERE document_id = ?')
      .all(documentId) as ProjectDocument[]
  },

  create(projectId: number, documentId: number, role = 'source'): { id: number } {
    console.log(
      '[DAO] ProjectDocumentDao.create, projectId:',
      projectId,
      ', documentId:',
      documentId,
      ', role:',
      role
    )
    const db = getSQLite()
    const result = db
      .prepare('INSERT INTO project_documents (project_id, document_id, role) VALUES (?, ?, ?)')
      .run(projectId, documentId, role)
    console.log('[DAO] ProjectDocumentDao.create 完成, id:', result.lastInsertRowid)
    return { id: result.lastInsertRowid as number }
  },

  delete(id: number): void {
    console.log('[DAO] ProjectDocumentDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM project_documents WHERE id = ?').run(id)
  }
}
