import { getSQLite } from '../sqlite'
import type { DocumentFigure } from '../../ai-server/type'

/** 文献图表解析结果 DAO（能力①） */
export const FigureDao = {
  findByDocument(documentId: number): DocumentFigure[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM document_figures WHERE document_id = ? ORDER BY page_number ASC, figure_index ASC')
      .all(documentId) as DocumentFigure[]
  },

  findByProject(projectId: number): DocumentFigure[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM document_figures WHERE project_id = ? ORDER BY id ASC')
      .all(projectId) as DocumentFigure[]
  },

  /** v3 问题⑧：按步骤查询归属图表 */
  findByStep(stepId: number): DocumentFigure[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM document_figures WHERE step_id = ? ORDER BY id ASC')
      .all(stepId) as DocumentFigure[]
  },

  /** 将某文献的全部图表归属到项目（文献关联到项目时调用，供图表面板按项目查询） */
  assignToProject(documentId: number, projectId: number): void {
    const db = getSQLite()
    db.prepare('UPDATE document_figures SET project_id = ? WHERE document_id = ?').run(projectId, documentId)
    console.log('[DAO] FigureDao.assignToProject, document_id:', documentId, ', project_id:', projectId)
  },

  create(
    data: {
      document_id: number
      project_id?: number | null
      step_id?: number | null
      figure_index?: number
      page_number?: number
      figure_type?: string
      caption?: string
      structured_data?: string
      ocr_text?: string
      image_path?: string
      status?: string
    }
  ): { id: number } {
    console.log(
      '[DAO] FigureDao.create, document_id:',
      data.document_id,
      ', figure_type:',
      data.figure_type,
      ', caption:',
      data.caption
    )
    const db = getSQLite()
    const r = db
      .prepare(
        `INSERT INTO document_figures
         (document_id, project_id, step_id, figure_index, page_number, figure_type, caption, structured_data, ocr_text, image_path, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.document_id,
        data.project_id ?? null,
        data.step_id ?? null,
        data.figure_index ?? 0,
        data.page_number ?? 0,
        data.figure_type ?? '',
        data.caption ?? '',
        data.structured_data ?? '{}',
        data.ocr_text ?? '',
        data.image_path ?? '',
        data.status ?? 'pending'
      )
    console.log('[DAO] FigureDao.create 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },

  update(id: number, patch: Partial<DocumentFigure>): void {
    console.log('[DAO] FigureDao.update, id:', id, ', patch:', JSON.stringify(patch))
    const db = getSQLite()
    const sets: string[] = []
    const values: unknown[] = []
    const allowed = [
      'project_id',
      'step_id',
      'figure_type',
      'caption',
      'structured_data',
      'ocr_text',
      'image_path',
      'status'
    ] as const
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`)
        values.push(patch[key])
      }
    }
    if (sets.length === 0) return
    values.push(id)
    db.prepare(`UPDATE document_figures SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    console.log('[DAO] FigureDao.update 完成, id:', id)
  },

  delete(id: number): void {
    console.log('[DAO] FigureDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM document_figures WHERE id = ?').run(id)
  }
}
