import { getSQLite } from '../sqlite'
import type { CustomData, ExperimentPhase, ExperimentRecord } from '../../ai-server/type'

/** 实验阶段与记录 DAO（能力③） */
export const ExperimentDao = {
  // ---------- 阶段 ----------
  phases(projectId: number): ExperimentPhase[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_phases WHERE project_id = ? ORDER BY phase_order ASC')
      .all(projectId) as ExperimentPhase[]
  },
  phaseById(id: number): ExperimentPhase | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM experiment_phases WHERE id = ?').get(id) as ExperimentPhase | undefined
  },
  addPhase(projectId: number, name: string, expected = '', order?: number, metricsJson = '[]'): { id: number } {
    console.log('[DAO] ExperimentDao.addPhase, projectId:', projectId, ', name:', name)
    const db = getSQLite()
    const nextOrder =
      order ??
      ((db
        .prepare('SELECT COALESCE(MAX(phase_order), 0) + 1 AS o FROM experiment_phases WHERE project_id = ?')
        .get(projectId) as { o: number })?.o ?? 1)
    const r = db
      .prepare(
        'INSERT INTO experiment_phases (project_id, name, phase_order, expected, metrics_json) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, name, nextOrder, expected, metricsJson)
    console.log('[DAO] ExperimentDao.addPhase 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  updatePhase(id: number, patch: Partial<Pick<ExperimentPhase, 'name' | 'status' | 'expected' | 'metrics_json'>>): void {
    console.log('[DAO] ExperimentDao.updatePhase, id:', id, ', patch:', JSON.stringify(patch))
    const db = getSQLite()
    const sets: string[] = []
    const values: unknown[] = []
    if (patch.name !== undefined) {
      sets.push('name = ?')
      values.push(patch.name)
    }
    if (patch.status !== undefined) {
      sets.push('status = ?')
      values.push(patch.status)
    }
    if (patch.expected !== undefined) {
      sets.push('expected = ?')
      values.push(patch.expected)
    }
    if (patch.metrics_json !== undefined) {
      sets.push('metrics_json = ?')
      values.push(patch.metrics_json)
    }
    if (sets.length === 0) return
    values.push(id)
    db.prepare(`UPDATE experiment_phases SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    console.log('[DAO] ExperimentDao.updatePhase 完成, id:', id)
  },
  deletePhase(id: number): void {
    console.log('[DAO] ExperimentDao.deletePhase, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_phases WHERE id = ?').run(id)
  },

  // ---------- 记录 ----------
  records(projectId: number): ExperimentRecord[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_records WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as ExperimentRecord[]
  },
  recordById(id: number): ExperimentRecord | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM experiment_records WHERE id = ?').get(id) as ExperimentRecord | undefined
  },
  addRecord(
    projectId: number,
    data: {
      phase_id?: number | null
      record_type?: 'phase' | 'phenomenon'
      name: string
      content: string
      data_json?: string
      expected?: string
      compliance_percent?: number | null
      is_expected?: number | null
      cause_analysis?: string
      detail?: string
    }
  ): { id: number } {
    console.log(
      '[DAO] ExperimentDao.addRecord, projectId:',
      projectId,
      ', name:',
      data.name,
      ', record_type:',
      data.record_type
    )
    const db = getSQLite()
    const r = db
      .prepare(
        `INSERT INTO experiment_records
         (project_id, phase_id, record_type, name, content, data_json, expected, compliance_percent, is_expected, cause_analysis, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        projectId,
        data.phase_id ?? null,
        data.record_type ?? 'phase',
        data.name,
        data.content,
        data.data_json ?? '{}',
        data.expected ?? '',
        data.compliance_percent ?? null,
        data.is_expected ?? null,
        data.cause_analysis ?? '',
        data.detail ?? ''
      )
    console.log('[DAO] ExperimentDao.addRecord 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  deleteRecord(id: number): void {
    console.log('[DAO] ExperimentDao.deleteRecord, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_records WHERE id = ?').run(id)
  },

  // ---------- 自定义数据 ----------
  customData(projectId: number): CustomData[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_custom_data WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as CustomData[]
  },
  addCustomData(
    projectId: number,
    data: {
      record_id?: number | null
      data_name: string
      data_type: string
      data_value: string
      unit?: string
      extra?: string
    }
  ): { id: number } {
    console.log(
      '[DAO] ExperimentDao.addCustomData, projectId:',
      projectId,
      ', data_name:',
      data.data_name,
      ', data_type:',
      data.data_type
    )
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO experiment_custom_data (project_id, record_id, data_name, data_type, data_value, unit, extra) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        projectId,
        data.record_id ?? null,
        data.data_name,
        data.data_type,
        data.data_value,
        data.unit ?? '',
        data.extra ?? '{}'
      )
    console.log('[DAO] ExperimentDao.addCustomData 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  deleteCustomData(id: number): void {
    console.log('[DAO] ExperimentDao.deleteCustomData, id:', id)
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_custom_data WHERE id = ?').run(id)
  }
}
