import { getSQLite } from '../sqlite'
import type { PredictionExperiment } from '../../ai-server/type'

/** AI 预测实验记录 DAO（能力⑤） */
export const PredictionDao = {
  findByProject(projectId: number): PredictionExperiment[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM prediction_experiments WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as PredictionExperiment[]
  },

  create(
    data: {
      project_id: number
      branch_id?: number | null
      step_id?: number | null
      step_experiment_id?: number | null
      name: string
      base_flow: string
      variables: string
      predicted_result: string
      property_analysis: string
      theory_basis: string
    }
  ): { id: number } {
    console.log('[DAO] PredictionDao.create, project_id:', data.project_id, ', name:', data.name)
    const db = getSQLite()
    const r = db
      .prepare(
        `INSERT INTO prediction_experiments
         (project_id, branch_id, step_id, step_experiment_id, name, base_flow, variables, predicted_result, property_analysis, theory_basis)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.project_id,
        data.branch_id ?? null,
        data.step_id ?? null,
        data.step_experiment_id ?? null,
        data.name,
        data.base_flow,
        data.variables,
        data.predicted_result,
        data.property_analysis,
        data.theory_basis
      )
    console.log('[DAO] PredictionDao.create 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },

  delete(id: number): void {
    console.log('[DAO] PredictionDao.delete, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM prediction_experiments WHERE id = ?').run(id)
  }
}
