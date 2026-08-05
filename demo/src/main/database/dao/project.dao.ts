import { getSQLite } from '../sqlite'
import type { Project, ProjectDocument, ProjectLink, ProjectLinkRequest, LinkRequestStatus } from '../../ai-server/type'

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
      // 3b. v0.8/0.9/0.10 新增：分叉/阶段变量/实验事件/共享关系/共享请求
      db.prepare('DELETE FROM project_branches WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM experiment_phase_variables WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM experiment_events WHERE project_id = ?').run(id)
      db.prepare('DELETE FROM project_links WHERE project_id = ? OR ref_project_id = ?').run(id, id)
      db.prepare('DELETE FROM project_link_requests WHERE project_id = ? OR target_project_id = ?').run(id, id)
      // 3c. v3（修改计划⑥）：步骤级并行实验变体
      db.prepare('DELETE FROM step_experiments WHERE project_id = ?').run(id)
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

/** 参考项目关系 DAO（v0.9，见实施计划 §4.5） */
export const ProjectLinkDao = {
  findByProject(projectId: number): ProjectLink[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_links WHERE project_id = ? ORDER BY id ASC')
      .all(projectId) as ProjectLink[]
  },
  /** 被参考关系（查询某项目被哪些项目参考） */
  findByRefProject(refProjectId: number): ProjectLink[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_links WHERE ref_project_id = ? ORDER BY id ASC')
      .all(refProjectId) as ProjectLink[]
  },
  addLink(projectId: number, refProjectId: number, scope = 'documents'): { id: number } {
    console.log('[DAO] ProjectLinkDao.addLink, projectId:', projectId, ', ref:', refProjectId, ', scope:', scope)
    const db = getSQLite()
    const ref = db.prepare('SELECT name FROM projects WHERE id = ?').get(refProjectId) as { name: string } | undefined
    const r = db
      .prepare('INSERT INTO project_links (project_id, ref_project_id, ref_name, scope) VALUES (?, ?, ?, ?)')
      .run(projectId, refProjectId, ref?.name ?? '', scope)
    return { id: r.lastInsertRowid as number }
  },
  updateScope(id: number, scope: string): void {
    const db = getSQLite()
    db.prepare('UPDATE project_links SET scope = ? WHERE id = ?').run(scope, id)
  },
  removeLink(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM project_links WHERE id = ?').run(id)
  }
}

/** 共享请求 DAO（v0.10：请求方 → 项目作者审批） */
export const ProjectLinkRequestDao = {
  /** 我方收到（待审批/已审批） */
  received(targetProjectId: number): ProjectLinkRequest[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_link_requests WHERE target_project_id = ? ORDER BY created_at DESC, id DESC')
      .all(targetProjectId) as ProjectLinkRequest[]
  },
  /** 我方发起 */
  sent(projectId: number): ProjectLinkRequest[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_link_requests WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as ProjectLinkRequest[]
  },
  findById(id: number): ProjectLinkRequest | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM project_link_requests WHERE id = ?').get(id) as
      | ProjectLinkRequest
      | undefined
  },
  create(data: {
    project_id: number
    target_project_id: number
    scope: string
    reason?: string
  }): { id: number } {
    console.log('[DAO] ProjectLinkRequestDao.create, data:', JSON.stringify(data))
    const db = getSQLite()
    const target = db.prepare('SELECT name FROM projects WHERE id = ?').get(data.target_project_id) as
      | { name: string }
      | undefined
    const r = db
      .prepare(
        'INSERT INTO project_link_requests (project_id, target_project_id, target_owner_name, scope, reason) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        data.project_id,
        data.target_project_id,
        target?.name ?? '',
        data.scope,
        data.reason ?? ''
      )
    return { id: r.lastInsertRowid as number }
  },
  /**
   * 审批共享请求：approved → 若请求方已有对该项目的 project_links 则提升 scope，
   * 否则新建一条（scope=documents 直接建立的参考关系默认存在，这里统一 upsert 提升）。
   */
  resolve(id: number, decision: 'approve' | 'reject'): void {
    const db = getSQLite()
    db.transaction(() => {
      const req = this.findById(id)
      if (!req || req.status !== 'pending') return
      const status: LinkRequestStatus = decision === 'approve' ? 'approved' : 'rejected'
      db.prepare(
        "UPDATE project_link_requests SET status = ?, resolved_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(status, id)
      if (decision === 'approve') {
        // 请求方对该目标项目的共享关系提升 scope
        const link = db
          .prepare('SELECT id, scope FROM project_links WHERE project_id = ? AND ref_project_id = ? LIMIT 1')
          .get(req.project_id, req.target_project_id) as { id: number; scope: string } | undefined
        const newScope = req.scope === 'all' ? 'all' : 'summaries'
        if (link) {
          db.prepare('UPDATE project_links SET scope = ? WHERE id = ?').run(newScope, link.id)
        } else {
          db.prepare('INSERT INTO project_links (project_id, ref_project_id, ref_name, scope) VALUES (?, ?, ?, ?)').run(
            req.project_id,
            req.target_project_id,
            req.target_owner_name,
            newScope
          )
        }
      }
    })()
  },
  delete(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM project_link_requests WHERE id = ?').run(id)
  }
}
