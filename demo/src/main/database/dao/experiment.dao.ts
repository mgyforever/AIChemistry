import { getSQLite } from '../sqlite'
import type {
  CustomData,
  ExperimentBranch,
  ExperimentEvent,
  ExperimentPhase,
  ExperimentPhaseVariable,
  ExperimentRecord,
  PhaseGateStatus,
  StepExperiment
} from '../../ai-server/type'

/** 实验阶段与记录 DAO（能力③，含 v0.8 分叉 / v0.9 变量与事件） */
export const ExperimentDao = {
  // ---------- 阶段 ----------
  phases(projectId: number, branchId: number | null = null): ExperimentPhase[] {
    const db = getSQLite()
    const rows =
      branchId === null
        ? db
            .prepare('SELECT * FROM experiment_phases WHERE project_id = ? ORDER BY phase_order ASC')
            .all(projectId)
        : db
            .prepare(
              'SELECT * FROM experiment_phases WHERE project_id = ? AND branch_id IS ? ORDER BY phase_order ASC'
            )
            .all(projectId, branchId)
    return rows as ExperimentPhase[]
  },
  phaseById(id: number): ExperimentPhase | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM experiment_phases WHERE id = ?').get(id) as ExperimentPhase | undefined
  },
  addPhase(
    projectId: number,
    name: string,
    expected = '',
    order?: number,
    metricsJson = '[]',
    branchId: number | null = null,
    gateStatus: PhaseGateStatus | null = null
  ): { id: number } {
    console.log('[DAO] ExperimentDao.addPhase, projectId:', projectId, ', name:', name, ', branchId:', branchId)
    const db = getSQLite()
    const nextOrder =
      order ??
      ((db
        .prepare('SELECT COALESCE(MAX(phase_order), 0) + 1 AS o FROM experiment_phases WHERE project_id = ? AND branch_id IS ?')
        .get(projectId, branchId) as { o: number })?.o ?? 1)
    // 门禁：主线首个阶段 open，其余 locked；分叉首个阶段 open
    const gate = gateStatus ?? (nextOrder === 1 ? 'open' : 'locked')
    const r = db
      .prepare(
        'INSERT INTO experiment_phases (project_id, branch_id, name, phase_order, expected, metrics_json, gate_status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(projectId, branchId, name, nextOrder, expected, metricsJson, gate)
    console.log('[DAO] ExperimentDao.addPhase 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  updatePhase(
    id: number,
    patch: Partial<Pick<ExperimentPhase, 'name' | 'status' | 'expected' | 'metrics_json' | 'gate_status' | 'summary' | 'summary_created_at' | 'can_parallel' | 'branch_id'>>
  ): void {
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
    if (patch.gate_status !== undefined) {
      sets.push('gate_status = ?')
      values.push(patch.gate_status)
    }
    if (patch.summary !== undefined) {
      sets.push('summary = ?')
      values.push(patch.summary)
    }
    if (patch.summary_created_at !== undefined) {
      sets.push('summary_created_at = ?')
      values.push(patch.summary_created_at)
    }
    if (patch.can_parallel !== undefined) {
      sets.push('can_parallel = ?')
      values.push(patch.can_parallel)
    }
    if (patch.branch_id !== undefined) {
      sets.push('branch_id = ?')
      values.push(patch.branch_id)
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
  records(projectId: number, branchId: number | null = null): ExperimentRecord[] {
    const db = getSQLite()
    const rows =
      branchId === null
        ? db
            .prepare('SELECT * FROM experiment_records WHERE project_id = ? ORDER BY created_at DESC, id DESC')
            .all(projectId)
        : db
            .prepare(
              'SELECT * FROM experiment_records WHERE project_id = ? AND branch_id IS ? ORDER BY created_at DESC, id DESC'
            )
            .all(projectId, branchId)
    return rows as ExperimentRecord[]
  },
  recordById(id: number): ExperimentRecord | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM experiment_records WHERE id = ?').get(id) as ExperimentRecord | undefined
  },
  addRecord(
    projectId: number,
    data: {
      phase_id?: number | null
      step_id?: number | null
      branch_id?: number | null
      step_experiment_id?: number | null
      record_type?: 'phase' | 'phenomenon'
      name: string
      content: string
      data_json?: string
      attachments?: string
      chart_data?: string
      vector_status?: string
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
         (project_id, phase_id, step_id, branch_id, step_experiment_id, record_type, name, content, data_json, attachments, chart_data, vector_status, expected, compliance_percent, is_expected, cause_analysis, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        projectId,
        data.phase_id ?? null,
        data.step_id ?? null,
        data.branch_id ?? null,
        data.step_experiment_id ?? null,
        data.record_type ?? 'phase',
        data.name,
        data.content,
        data.data_json ?? '{}',
        data.attachments ?? '[]',
        data.chart_data ?? '{}',
        data.vector_status ?? 'pending',
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
  /** 待入库记录（v0.9 延迟压缩，§7.11） */
  pendingRecords(projectId: number, branchId: number | null = null): ExperimentRecord[] {
    const db = getSQLite()
    const rows =
      branchId === null
        ? db
            .prepare(
              "SELECT * FROM experiment_records WHERE project_id = ? AND vector_status = 'pending' ORDER BY created_at ASC"
            )
            .all(projectId)
        : db
            .prepare(
              "SELECT * FROM experiment_records WHERE project_id = ? AND branch_id IS ? AND vector_status = 'pending' ORDER BY created_at ASC"
            )
            .all(projectId, branchId)
    return rows as ExperimentRecord[]
  },
  /** 标记记录已入库 */
  markRecordIndexed(id: number): void {
    const db = getSQLite()
    db.prepare("UPDATE experiment_records SET vector_status = 'indexed' WHERE id = ?").run(id)
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
      step_id?: number | null
      step_experiment_id?: number | null
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
        'INSERT INTO experiment_custom_data (project_id, record_id, step_id, step_experiment_id, data_name, data_type, data_value, unit, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        projectId,
        data.record_id ?? null,
        data.step_id ?? null,
        data.step_experiment_id ?? null,
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
  },

  // ==================== 并行实验分叉（v0.8 树分叉模型） ====================
  branches(projectId: number): ExperimentBranch[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM project_branches WHERE project_id = ? ORDER BY id ASC')
      .all(projectId) as ExperimentBranch[]
  },
  branchById(id: number): ExperimentBranch | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM project_branches WHERE id = ?').get(id) as ExperimentBranch | undefined
  },
  /**
   * 创建并行实验分叉：事务内复制分叉点及其后的阶段/步骤为独立分支。
   * fork_phase_id 之前的数据归属父分支共享；分叉点之后复制为新分支独立序列。
   */
  createBranch(data: {
    project_id: number
    parent_branch_id?: number | null
    fork_phase_id: number
    name: string
    description?: string
    variable_overrides?: Record<string, unknown>
  }): { id: number } {
    console.log('[DAO] ExperimentDao.createBranch, data:', JSON.stringify(data))
    const db = getSQLite()
    const branchId = db.transaction(() => {
      const r = db
        .prepare(
          'INSERT INTO project_branches (project_id, parent_branch_id, name, description, variable_overrides, fork_phase_id) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          data.project_id,
          data.parent_branch_id ?? null,
          data.name,
          data.description ?? '',
          JSON.stringify(data.variable_overrides ?? {}),
          data.fork_phase_id
        )
      const newBranchId = r.lastInsertRowid as number

      // 父分支 = parent_branch_id ?? 主线(null)
      const parentBranch = data.parent_branch_id ?? null
      // 复制分叉点及其后的阶段
      const forkPhases = (
        parentBranch === null
          ? db
              .prepare(
                'SELECT * FROM experiment_phases WHERE project_id = ? AND branch_id IS NULL AND id >= ? ORDER BY phase_order ASC'
              )
              .all(data.project_id, data.fork_phase_id)
          : db
              .prepare(
                'SELECT * FROM experiment_phases WHERE project_id = ? AND branch_id = ? AND id >= ? ORDER BY phase_order ASC'
              )
              .all(data.project_id, parentBranch, data.fork_phase_id)
      ) as Array<{ id: number; name: string; phase_order: number; expected: string; metrics_json: string; can_parallel: number }>

      for (const ph of forkPhases) {
        const newPhase = db
          .prepare(
            'INSERT INTO experiment_phases (project_id, branch_id, name, phase_order, expected, metrics_json, gate_status, can_parallel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            data.project_id,
            newBranchId,
            ph.name,
            ph.phase_order,
            ph.expected,
            ph.metrics_json,
            ph.phase_order === 1 ? 'open' : 'locked',
            ph.can_parallel
          )
        const newPhaseId = newPhase.lastInsertRowid as number

        // 注意：步骤与阶段通过 step_no 松散关联，直接复制该分支内所有步骤（按阶段数均分）
        const allBranchSteps = db
          .prepare(
            'SELECT * FROM reproduction_steps WHERE project_id = ? AND branch_id IS ? ORDER BY step_no ASC'
          )
          .all(data.project_id, parentBranch) as Array<{
          id: number
          step_no: number
          title: string
          description: string
          conditions: string
          duration: string
          notes: string
          depends_on: string
        }>
        // 该阶段对应的步骤：与阶段顺序一致的整段步骤（阶段边界按文献抽取的阶段数均分）
        const phaseCount = forkPhases.length
        const perPhase = Math.max(1, Math.ceil(allBranchSteps.length / phaseCount))
        const startIdx = (ph.phase_order - 1) * perPhase
        const phaseSteps = allBranchSteps.slice(startIdx, startIdx + perPhase)
        const idMap = new Map<number, number>()
        for (const st of phaseSteps) {
          const ins = db
            .prepare(
              'INSERT INTO reproduction_steps (project_id, step_no, title, description, conditions, duration, notes, depends_on, status, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .run(
              data.project_id,
              st.step_no,
              st.title,
              st.description,
              st.conditions,
              st.duration,
              st.notes,
              JSON.stringify([]), // 依赖在新分支重建（旧 id 失效，暂置空，随后按需重算）
              'pending',
              newBranchId
            )
          idMap.set(st.id, ins.lastInsertRowid as number)
        }
        void newPhaseId
      }
      return newBranchId
    })()
    // 分支内步骤依赖重建：按 step_no 顺序建立相邻依赖（简化：依赖复制后需手动调整）
    // 完成后重算 ready 状态
    this.recomputeBranchSteps(data.project_id, branchId)
    console.log('[DAO] ExperimentDao.createBranch 完成, branchId:', branchId)
    return { id: branchId }
  },
  /** 重算某分支步骤的 ready 状态（分叉后无依赖步骤立即可用） */
  recomputeBranchSteps(projectId: number, branchId: number): void {
    const db = getSQLite()
    db.transaction(() => {
      const rows = db
        .prepare('SELECT id, depends_on, status FROM reproduction_steps WHERE project_id = ? AND branch_id = ?')
        .all(projectId, branchId) as Array<{ id: number; depends_on: string; status: string }>
      for (const r of rows) {
        if (r.status !== 'pending') continue
        let deps: number[] = []
        try {
          deps = JSON.parse(r.depends_on || '[]') as number[]
        } catch {
          deps = []
        }
        if (deps.length === 0) {
          db.prepare("UPDATE reproduction_steps SET status = 'ready' WHERE id = ?").run(r.id)
        }
      }
    })()
  },
  /** 完成分叉（点击"完成本次并行实验"），置 index_status=pending 待后台索引 */
  finishBranch(branchId: number): void {
    const db = getSQLite()
    db.prepare("UPDATE project_branches SET index_status = 'pending' WHERE id = ?").run(branchId)
  },
  /** 标记分叉已入库 */
  markBranchIndexed(branchId: number): void {
    const db = getSQLite()
    db.prepare("UPDATE project_branches SET index_status = 'indexed' WHERE id = ?").run(branchId)
  },
  /** 分支阶段（含自身分支的独立阶段） */
  branchPhases(branchId: number): ExperimentPhase[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_phases WHERE branch_id = ? ORDER BY phase_order ASC')
      .all(branchId) as ExperimentPhase[]
  },
  /** 分支记录 */
  branchRecords(branchId: number): ExperimentRecord[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_records WHERE branch_id = ? ORDER BY created_at DESC, id DESC')
      .all(branchId) as ExperimentRecord[]
  },
  /** 递归构建分支树（parent → children） */
  branchTree(projectId: number): ExperimentBranch[] {
    return this.branches(projectId)
  },

  // ==================== 阶段实验变量（v0.9） ====================
  phaseVariables(phaseId: number, branchId: number | null = null): ExperimentPhaseVariable[] {
    const db = getSQLite()
    const rows =
      branchId === null
        ? db
            .prepare('SELECT * FROM experiment_phase_variables WHERE phase_id = ? ORDER BY sort_order ASC, id ASC')
            .all(phaseId)
        : db
            .prepare(
              'SELECT * FROM experiment_phase_variables WHERE phase_id = ? AND branch_id IS ? ORDER BY sort_order ASC, id ASC'
            )
            .all(phaseId, branchId)
    return rows as ExperimentPhaseVariable[]
  },
  /** 整项目变量（前端一次性拉取） */
  allPhaseVariables(projectId: number): ExperimentPhaseVariable[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM experiment_phase_variables WHERE project_id = ? ORDER BY phase_id ASC, sort_order ASC')
      .all(projectId) as ExperimentPhaseVariable[]
  },
  upsertPhaseVariable(
    data: Partial<ExperimentPhaseVariable> & {
      project_id: number
      phase_id: number
      key: string
      name: string
    }
  ): { id: number } {
    const db = getSQLite()
    if (data.id) {
      const sets: string[] = []
      const values: unknown[] = []
      const fields: Array<keyof ExperimentPhaseVariable> = [
        'branch_id',
        'step_id',
        'step_experiment_id',
        'key',
        'name',
        'type',
        'unit',
        'default_value',
        'current_value',
        'options',
        'is_agent_generated',
        'description',
        'sort_order'
      ]
      for (const f of fields) {
        if (data[f] !== undefined) {
          sets.push(`${f} = ?`)
          values.push(typeof data[f] === 'object' ? JSON.stringify(data[f]) : data[f])
        }
      }
      if (sets.length) {
        values.push(data.id)
        db.prepare(`UPDATE experiment_phase_variables SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      }
      return { id: data.id }
    }
    const r = db
      .prepare(
        'INSERT INTO experiment_phase_variables (project_id, phase_id, step_id, branch_id, step_experiment_id, key, name, type, unit, default_value, current_value, options, is_agent_generated, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        data.project_id,
        data.phase_id,
        data.step_id ?? null,
        data.branch_id ?? null,
        data.step_experiment_id ?? null,
        data.key,
        data.name,
        data.type ?? 'other',
        data.unit ?? '',
        data.default_value ?? '',
        data.current_value ?? '',
        data.options ?? '[]',
        data.is_agent_generated ?? 1,
        data.description ?? '',
        data.sort_order ?? 0
      )
    return { id: r.lastInsertRowid as number }
  },
  deletePhaseVariable(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_phase_variables WHERE id = ?').run(id)
  },
  /** 删除阶段下全部变量（重写时先清空） */
  clearPhaseVariables(phaseId: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_phase_variables WHERE phase_id = ?').run(phaseId)
  },

  // ==================== 实验事件（v0.9） ====================
  events(projectId: number, phaseId?: number | null, branchId?: number | null): ExperimentEvent[] {
    const db = getSQLite()
    if (phaseId !== undefined && phaseId !== null) {
      return db
        .prepare('SELECT * FROM experiment_events WHERE project_id = ? AND phase_id = ? ORDER BY created_at DESC, id DESC')
        .all(projectId, phaseId) as ExperimentEvent[]
    }
    if (branchId !== undefined && branchId !== null) {
      return db
        .prepare('SELECT * FROM experiment_events WHERE project_id = ? AND branch_id = ? ORDER BY created_at DESC, id DESC')
        .all(projectId, branchId) as ExperimentEvent[]
    }
    return db
      .prepare('SELECT * FROM experiment_events WHERE project_id = ? ORDER BY created_at DESC, id DESC')
      .all(projectId) as ExperimentEvent[]
  },
  addEvent(data: {
    project_id: number
    branch_id?: number | null
    phase_id?: number | null
    step_id?: number | null
    step_experiment_id?: number | null
    name: string
    content?: string
    media_paths?: string[]
  }): { id: number } {
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO experiment_events (project_id, branch_id, phase_id, step_id, step_experiment_id, name, content, media_paths) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        data.project_id,
        data.branch_id ?? null,
        data.phase_id ?? null,
        data.step_id ?? null,
        data.step_experiment_id ?? null,
        data.name,
        data.content ?? '',
        JSON.stringify(data.media_paths ?? [])
      )
    return { id: r.lastInsertRowid as number }
  },
  deleteEvent(id: number): void {
    const db = getSQLite()
    db.prepare('DELETE FROM experiment_events WHERE id = ?').run(id)
  },

  // ==================== 步骤级并行实验变体（v3 问题⑥） ====================
  stepExperiments(projectId: number): StepExperiment[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM step_experiments WHERE project_id = ? ORDER BY id ASC')
      .all(projectId) as StepExperiment[]
  },
  stepExperimentsByStep(stepId: number): StepExperiment[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM step_experiments WHERE step_id = ? ORDER BY id ASC')
      .all(stepId) as StepExperiment[]
  },
  stepExperimentById(id: number): StepExperiment | undefined {
    const db = getSQLite()
    return db.prepare('SELECT * FROM step_experiments WHERE id = ?').get(id) as StepExperiment | undefined
  },
  createStepExperiment(data: {
    project_id: number
    step_id: number
    branch_id?: number | null
    parent_experiment_id?: number | null
    name: string
    description?: string
    variable_overrides?: Record<string, unknown>
  }): { id: number } {
    console.log('[DAO] ExperimentDao.createStepExperiment:', JSON.stringify(data))
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO step_experiments (project_id, step_id, branch_id, parent_experiment_id, name, description, variable_overrides) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        data.project_id,
        data.step_id,
        data.branch_id ?? null,
        data.parent_experiment_id ?? null,
        data.name,
        data.description ?? '',
        JSON.stringify(data.variable_overrides ?? {})
      )
    return { id: r.lastInsertRowid as number }
  },
  updateStepExperiment(
    id: number,
    patch: Partial<Pick<StepExperiment, 'name' | 'description' | 'status'>> & {
      variable_overrides?: string | Record<string, unknown>
    }
  ): void {
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
    if (patch.variable_overrides !== undefined) {
      sets.push('variable_overrides = ?')
      values.push(typeof patch.variable_overrides === 'string' ? patch.variable_overrides : JSON.stringify(patch.variable_overrides))
    }
    if (patch.status !== undefined) {
      sets.push('status = ?')
      values.push(patch.status)
    }
    if (sets.length === 0) return
    values.push(id)
    db.prepare(`UPDATE step_experiments SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  },
  deleteStepExperiment(id: number): void {
    const db = getSQLite()
    db.transaction(() => {
      // 级联清理该变体下的记录/事件/变量/自定义数据/预测
      db.prepare('DELETE FROM experiment_records WHERE step_experiment_id = ?').run(id)
      db.prepare('DELETE FROM experiment_events WHERE step_experiment_id = ?').run(id)
      db.prepare('DELETE FROM experiment_phase_variables WHERE step_experiment_id = ?').run(id)
      db.prepare('DELETE FROM experiment_custom_data WHERE step_experiment_id = ?').run(id)
      db.prepare('DELETE FROM prediction_experiments WHERE step_experiment_id = ?').run(id)
      db.prepare('DELETE FROM step_experiments WHERE id = ?').run(id)
    })()
  }
}
