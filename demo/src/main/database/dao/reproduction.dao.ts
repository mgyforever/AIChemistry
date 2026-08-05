import { getSQLite } from '../sqlite'
import type {
  GapCategory,
  ReproductionAssessment,
  ReproductionCharacterization,
  ReproductionConcern,
  ReproductionGap,
  ReproductionInstrument,
  ReproductionMaterial,
  ReproductionReaction,
  ReproductionStep,
  StepConditions,
  StepStatus
} from '../../ai-server/type'

type InsertMaterial = Partial<Omit<ReproductionMaterial, 'id' | 'project_id'>> & { name: string }
type InsertStep = Partial<Omit<ReproductionStep, 'id' | 'project_id' | 'conditions'>> & {
  step_no: number
  description: string
  conditions?: StepConditions | string
  depends_on?: number[] | string
  status?: StepStatus | string
  branch_id?: number | null
}
type InsertInstrument = Partial<Omit<ReproductionInstrument, 'id' | 'project_id'>> & { name: string }
type InsertConcern = Partial<Omit<ReproductionConcern, 'id' | 'project_id'>> & { content: string }
type InsertAssessment = Omit<ReproductionAssessment, 'id' | 'project_id'>
type InsertReaction = Partial<Omit<ReproductionReaction, 'id' | 'project_id'>> & { equation: string }
type InsertCharacterization = Partial<Omit<ReproductionCharacterization, 'id' | 'project_id'>> & { method: string }
type InsertGap = Partial<Omit<ReproductionGap, 'id' | 'project_id' | 'category'>> & {
  content: string
  category?: GapCategory | string
}

/** 将步骤条件的 JSON 字符串解析为结构化对象（兼容旧库中的普通文本） */
function parseConditions(raw: unknown): StepConditions {
  if (!raw) return {}
  const trimmed = String(raw).trim()
  if (!trimmed) return {}
  try {
    const obj = JSON.parse(trimmed) as unknown
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as StepConditions
    }
    return { other: trimmed }
  } catch {
    return { other: trimmed }
  }
}

/** 解析步骤依赖 id 数组（兼容旧库缺省） */
function parseDependsOn(raw: unknown): number[] {
  if (!raw) return []
  const trimmed = String(raw).trim()
  if (!trimmed) return []
  try {
    const arr = JSON.parse(trimmed) as unknown
    if (Array.isArray(arr)) return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n))
  } catch {
    /* 忽略非法 JSON */
  }
  return []
}

/** 写入前将结构化条件序列化为 JSON 字符串（对象/字符串/缺失均兜底） */
function stringifyConditions(conditions: unknown): string {
  if (typeof conditions === 'string') return conditions
  if (conditions && typeof conditions === 'object') return JSON.stringify(conditions)
  return ''
}

/** 复现方案 DAO（能力②） */
export const ReproductionDao = {
  // ---------- 材料 ----------
  materials(projectId: number): ReproductionMaterial[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_materials WHERE project_id = ?')
      .all(projectId) as ReproductionMaterial[]
  },
  addMaterial(projectId: number, m: InsertMaterial): { id: number } {
    console.log('[DAO] ReproductionDao.addMaterial, projectId:', projectId, ', name:', m.name)
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO reproduction_materials (project_id, name, formula, cas, quantity, purity, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(projectId, m.name, m.formula ?? '', m.cas ?? '', m.quantity ?? '', m.purity ?? '', m.purpose ?? '', m.notes ?? '')
    console.log('[DAO] ReproductionDao.addMaterial 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  clearMaterials(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearMaterials, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_materials WHERE project_id = ?').run(projectId)
  },

  // ---------- 步骤（v0.7：DAG 依赖 + 状态机） ----------
  steps(projectId: number, branchId: number | null = null): ReproductionStep[] {
    const db = getSQLite()
    const rows =
      branchId === null
        ? db
            .prepare('SELECT * FROM reproduction_steps WHERE project_id = ? ORDER BY step_no ASC')
            .all(projectId)
        : db
            .prepare(
              'SELECT * FROM reproduction_steps WHERE project_id = ? AND branch_id IS ? ORDER BY step_no ASC'
            )
            .all(projectId, branchId)
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as ReproductionStep),
      conditions: parseConditions(r.conditions),
      depends_on: parseDependsOn(r.depends_on)
    })) as ReproductionStep[]
  },
  /** 获取指定 id 的步骤 */
  stepById(id: number): ReproductionStep | undefined {
    const db = getSQLite()
    const r = db.prepare('SELECT * FROM reproduction_steps WHERE id = ?').get(id) as
      | (Record<string, unknown> & ReproductionStep)
      | undefined
    if (!r) return undefined
    return { ...r, conditions: parseConditions(r.conditions), depends_on: parseDependsOn(r.depends_on) }
  },
  addStep(projectId: number, s: InsertStep): { id: number } {
    console.log(
      '[DAO] ReproductionDao.addStep, projectId:',
      projectId,
      ', step_no:',
      s.step_no,
      ', title:',
      s.title
    )
    const db = getSQLite()
    const dependsOn = typeof s.depends_on === 'string' ? s.depends_on : JSON.stringify(s.depends_on ?? [])
    const r = db
      .prepare(
        'INSERT INTO reproduction_steps (project_id, step_no, title, description, conditions, duration, notes, depends_on, status, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        projectId,
        s.step_no,
        s.title ?? '',
        s.description,
        stringifyConditions(s.conditions),
        s.duration ?? '',
        s.notes ?? '',
        dependsOn,
        s.status ?? 'pending',
        s.branch_id ?? null
      )
    console.log('[DAO] ReproductionDao.addStep 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  clearSteps(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearSteps, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_steps WHERE project_id = ?').run(projectId)
  },

  // ---------- 步骤 CRUD（v3 修改计划问题④：新增/删除/修改） ----------

  /** 修改步骤信息（标题/描述/条件/时长/备注/依赖/序号） */
  updateStep(
    id: number,
    patch: Partial<Pick<ReproductionStep, 'step_no' | 'title' | 'description' | 'duration' | 'notes' | 'depends_on'>> & {
      conditions?: StepConditions | string
    }
  ): void {
    console.log('[DAO] ReproductionDao.updateStep, id:', id, ', patch:', JSON.stringify(patch))
    const db = getSQLite()
    const sets: string[] = []
    const values: unknown[] = []
    if (patch.step_no !== undefined) {
      sets.push('step_no = ?')
      values.push(patch.step_no)
    }
    if (patch.title !== undefined) {
      sets.push('title = ?')
      values.push(patch.title)
    }
    if (patch.description !== undefined) {
      sets.push('description = ?')
      values.push(patch.description)
    }
    if (patch.conditions !== undefined) {
      sets.push('conditions = ?')
      values.push(stringifyConditions(patch.conditions))
    }
    if (patch.duration !== undefined) {
      sets.push('duration = ?')
      values.push(patch.duration)
    }
    if (patch.notes !== undefined) {
      sets.push('notes = ?')
      values.push(patch.notes)
    }
    if (patch.depends_on !== undefined) {
      sets.push('depends_on = ?')
      values.push(JSON.stringify(patch.depends_on))
    }
    if (sets.length === 0) return
    values.push(id)
    db.prepare(`UPDATE reproduction_steps SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  },

  /** 在指定位置新增步骤：插入后重排 step_no（同分支内 1..N 连续），默认 pending */
  insertStep(
    projectId: number,
    data: {
      step_no: number
      title?: string
      description: string
      conditions?: StepConditions | string
      duration?: string
      notes?: string
      depends_on?: number[]
      branch_id?: number | null
    }
  ): { id: number } {
    console.log('[DAO] ReproductionDao.insertStep, projectId:', projectId, ', step_no:', data.step_no)
    const db = getSQLite()
    const branchId = data.branch_id ?? null
    // 插入位置之后的步骤后移一位
    db.prepare(
      'UPDATE reproduction_steps SET step_no = step_no + 1 WHERE project_id = ? AND branch_id IS ? AND step_no >= ?'
    ).run(projectId, branchId, data.step_no)
    const r = db
      .prepare(
        'INSERT INTO reproduction_steps (project_id, step_no, title, description, conditions, duration, notes, depends_on, status, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        projectId,
        data.step_no,
        data.title ?? '',
        data.description,
        stringifyConditions(data.conditions),
        data.duration ?? '',
        data.notes ?? '',
        JSON.stringify(data.depends_on ?? []),
        'pending',
        branchId
      )
    this.recomputeReady(projectId, branchId)
    return { id: r.lastInsertRowid as number }
  },

  /** 删除步骤：级联清理该步骤数据（记录/事件/变量/自定义数据/预测/变体），剔除依赖引用，重排序号 */
  deleteStep(id: number): void {
    console.log('[DAO] ReproductionDao.deleteStep, id:', id)
    const db = getSQLite()
    const step = this.stepById(id)
    if (!step) return
    const { project_id: projectId, branch_id: branchId } = step
    db.transaction(() => {
      // 1. 级联清理该步骤归属数据（v3 问题③⑥：步骤数据/变体独立空间）
      db.prepare('DELETE FROM experiment_records WHERE step_id = ?').run(id)
      db.prepare('DELETE FROM experiment_events WHERE step_id = ?').run(id)
      db.prepare('DELETE FROM experiment_phase_variables WHERE step_id = ?').run(id)
      db.prepare('DELETE FROM experiment_custom_data WHERE step_id = ?').run(id)
      db.prepare('DELETE FROM prediction_experiments WHERE step_id = ?').run(id)
      db.prepare('DELETE FROM step_experiments WHERE step_id = ?').run(id)
      // 2. 剔除其他步骤依赖中对本步骤的引用
      const rows = db
        .prepare('SELECT id, depends_on FROM reproduction_steps WHERE project_id = ? AND branch_id IS ?')
        .all(projectId, branchId) as Array<{ id: number; depends_on: string }>
      for (const r of rows) {
        if (r.id === id) continue
        const deps = parseDependsOn(r.depends_on).filter((d) => d !== id)
        db.prepare('UPDATE reproduction_steps SET depends_on = ? WHERE id = ?').run(JSON.stringify(deps), r.id)
      }
      // 3. 删除本步骤
      db.prepare('DELETE FROM reproduction_steps WHERE id = ?').run(id)
      // 4. 重排 step_no（1..N 连续）
      const remain = db
        .prepare('SELECT id FROM reproduction_steps WHERE project_id = ? AND branch_id IS ? ORDER BY step_no ASC')
        .all(projectId, branchId) as Array<{ id: number }>
      remain.forEach((s, idx) => {
        db.prepare('UPDATE reproduction_steps SET step_no = ? WHERE id = ?').run(idx + 1, s.id)
      })
      // 5. 重算 ready 状态
      this.recomputeReady(projectId, branchId)
    })()
  },

  // ---------- 步骤状态机（v0.7，见实施计划 §7.6） ----------
  /**
   * 更新步骤状态并传播依赖解锁：
   * 步骤 completed/skipped 时，检查所有依赖它的后继步骤，若其全部前置均完成则置为 ready。
   */
  updateStepStatus(id: number, status: StepStatus): void {
    const db = getSQLite()
    db.transaction(() => {
      db.prepare('UPDATE reproduction_steps SET status = ? WHERE id = ?').run(status, id)
      if (status === 'completed' || status === 'skipped') {
        // 找出所有依赖该步骤的后继步骤
        const step = this.stepById(id)
        if (!step) return
        const successors = db
          .prepare(
            `SELECT id, depends_on, status FROM reproduction_steps
             WHERE project_id = ? AND branch_id IS ?`
          )
          .all(step.project_id, step.branch_id) as Array<{ id: number; depends_on: string; status: string }>
        for (const succ of successors) {
          if (succ.status !== 'pending' && succ.status !== 'ready') continue
          const deps = parseDependsOn(succ.depends_on)
          if (deps.length === 0) continue
          const allDone = deps.every((depId) => {
            const d = this.stepById(depId)
            return !!d && (d.status === 'completed' || d.status === 'skipped')
          })
          if (allDone) {
            db.prepare('UPDATE reproduction_steps SET status = ? WHERE id = ?').run('ready', succ.id)
          }
        }
      }
    })()
  },
  /** 当前（分支内）所有可开始步骤：status=ready，或无依赖且未开始 */
  readySteps(projectId: number, branchId: number | null = null): ReproductionStep[] {
    return this.steps(projectId, branchId).filter((s) => s.status === 'ready')
  },
  /** 设置步骤依赖（前端泳道图手工调整后保存） */
  setStepDependencies(id: number, dependsOn: number[]): void {
    const db = getSQLite()
    db.prepare('UPDATE reproduction_steps SET depends_on = ? WHERE id = ?').run(
      JSON.stringify(dependsOn),
      id
    )
  },
  /** 步骤完成后自动解锁（供前端在依赖编辑后重算 ready 状态） */
  recomputeReady(projectId: number, branchId: number | null = null): void {
    const db = getSQLite()
    const steps = this.steps(projectId, branchId)
    db.transaction(() => {
      for (const s of steps) {
        if (s.status !== 'pending') continue
        if (s.depends_on.length === 0) {
          db.prepare('UPDATE reproduction_steps SET status = ? WHERE id = ?').run('ready', s.id)
          continue
        }
        const allDone = s.depends_on.every((depId) => {
          const d = steps.find((x) => x.id === depId)
          return !!d && (d.status === 'completed' || d.status === 'skipped')
        })
        if (allDone) {
          db.prepare('UPDATE reproduction_steps SET status = ? WHERE id = ?').run('ready', s.id)
        }
      }
    })()
  },

  // ---------- 仪器 ----------
  instruments(projectId: number): ReproductionInstrument[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_instruments WHERE project_id = ?')
      .all(projectId) as ReproductionInstrument[]
  },
  addInstrument(projectId: number, i: InsertInstrument): { id: number } {
    console.log('[DAO] ReproductionDao.addInstrument, projectId:', projectId, ', name:', i.name)
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO reproduction_instruments (project_id, name, specification, purpose, notes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, i.name, i.specification ?? '', i.purpose ?? '', i.notes ?? '')
    console.log('[DAO] ReproductionDao.addInstrument 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  clearInstruments(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearInstruments, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_instruments WHERE project_id = ?').run(projectId)
  },

  // ---------- 注意事项 ----------
  concerns(projectId: number): ReproductionConcern[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_concerns WHERE project_id = ?')
      .all(projectId) as ReproductionConcern[]
  },
  addConcern(projectId: number, c: InsertConcern): { id: number } {
    console.log(
      '[DAO] ReproductionDao.addConcern, projectId:',
      projectId,
      ', content:',
      c.content.length > 100 ? c.content.slice(0, 100) + '...' : c.content
    )
    const db = getSQLite()
    const r = db
      .prepare(
        'INSERT INTO reproduction_concerns (project_id, category, content, risk_level, solution) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, c.category ?? 'operation', c.content, c.risk_level ?? '', c.solution ?? '')
    console.log('[DAO] ReproductionDao.addConcern 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  clearConcerns(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearConcerns, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_concerns WHERE project_id = ?').run(projectId)
  },

  // ---------- 难度评估 ----------
  assessment(projectId: number): ReproductionAssessment | undefined {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_assessment WHERE project_id = ? ORDER BY id DESC LIMIT 1')
      .get(projectId) as ReproductionAssessment | undefined
  },
  upsertAssessment(projectId: number, a: InsertAssessment): void {
    console.log(
      '[DAO] ReproductionDao.upsertAssessment, projectId:',
      projectId,
      ', difficulty_score:',
      a.difficulty_score,
      ', feasibility:',
      a.feasibility
    )
    const db = getSQLite()
    // 防御：risk_points 若为数组则转为 JSON 字符串（数据库列是 TEXT，且 better-sqlite3 不接受数组参数）
    const riskPoints =
      typeof a.risk_points === 'string'
        ? a.risk_points
        : Array.isArray(a.risk_points)
          ? JSON.stringify(a.risk_points)
          : '[]'
    const exists = db
      .prepare('SELECT id FROM reproduction_assessment WHERE project_id = ?')
      .get(projectId)
    if (exists) {
      db.prepare(
        'UPDATE reproduction_assessment SET difficulty_score = ?, feasibility = ?, analysis = ?, risk_points = ? WHERE project_id = ?'
      ).run(a.difficulty_score, a.feasibility, a.analysis, riskPoints, projectId)
    } else {
      db.prepare(
        'INSERT INTO reproduction_assessment (project_id, difficulty_score, feasibility, analysis, risk_points) VALUES (?, ?, ?, ?, ?)'
      ).run(projectId, a.difficulty_score, a.feasibility, a.analysis, riskPoints)
    }
  },

  // ---------- 反应方程式 ----------
  reactions(projectId: number): ReproductionReaction[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_reactions WHERE project_id = ?')
      .all(projectId) as ReproductionReaction[]
  },
  addReaction(projectId: number, r: InsertReaction): { id: number } {
    console.log('[DAO] ReproductionDao.addReaction, projectId:', projectId, ', equation:', r.equation.slice(0, 80))
    const db = getSQLite()
    const res = db
      .prepare(
        'INSERT INTO reproduction_reactions (project_id, equation, type, purpose, notes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, r.equation, r.type ?? '', r.purpose ?? '', r.notes ?? '')
    console.log('[DAO] ReproductionDao.addReaction 完成, id:', res.lastInsertRowid)
    return { id: res.lastInsertRowid as number }
  },
  clearReactions(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearReactions, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_reactions WHERE project_id = ?').run(projectId)
  },

  // ---------- 表征/分析方法 ----------
  characterizations(projectId: number): ReproductionCharacterization[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_characterizations WHERE project_id = ?')
      .all(projectId) as ReproductionCharacterization[]
  },
  addCharacterization(projectId: number, c: InsertCharacterization): { id: number } {
    console.log('[DAO] ReproductionDao.addCharacterization, projectId:', projectId, ', method:', c.method)
    const db = getSQLite()
    const res = db
      .prepare(
        'INSERT INTO reproduction_characterizations (project_id, target, method, conditions, expected, notes) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(projectId, c.target ?? '', c.method, c.conditions ?? '', c.expected ?? '', c.notes ?? '')
    console.log('[DAO] ReproductionDao.addCharacterization 完成, id:', res.lastInsertRowid)
    return { id: res.lastInsertRowid as number }
  },
  clearCharacterizations(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearCharacterizations, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_characterizations WHERE project_id = ?').run(projectId)
  },

  // ---------- 信息缺口 ----------
  gaps(projectId: number): ReproductionGap[] {
    const db = getSQLite()
    return db
      .prepare('SELECT * FROM reproduction_gaps WHERE project_id = ?')
      .all(projectId) as ReproductionGap[]
  },
  addGap(projectId: number, g: InsertGap): { id: number } {
    console.log(
      '[DAO] ReproductionDao.addGap, projectId:',
      projectId,
      ', content:',
      g.content.length > 80 ? g.content.slice(0, 80) + '...' : g.content
    )
    const db = getSQLite()
    const res = db
      .prepare(
        'INSERT INTO reproduction_gaps (project_id, category, content, impact, assumption) VALUES (?, ?, ?, ?, ?)'
      )
      .run(projectId, g.category ?? 'condition', g.content, g.impact ?? '', g.assumption ?? '')
    console.log('[DAO] ReproductionDao.addGap 完成, id:', res.lastInsertRowid)
    return { id: res.lastInsertRowid as number }
  },
  clearGaps(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearGaps, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_gaps WHERE project_id = ?').run(projectId)
  }
}
