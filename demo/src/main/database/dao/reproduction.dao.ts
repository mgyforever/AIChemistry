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
  StepConditions
} from '../../ai-server/type'

type InsertMaterial = Partial<Omit<ReproductionMaterial, 'id' | 'project_id'>> & { name: string }
type InsertStep = Partial<Omit<ReproductionStep, 'id' | 'project_id' | 'conditions'>> & {
  step_no: number
  description: string
  conditions?: StepConditions | string
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

  // ---------- 步骤 ----------
  steps(projectId: number): ReproductionStep[] {
    const db = getSQLite()
    const rows = db
      .prepare('SELECT * FROM reproduction_steps WHERE project_id = ? ORDER BY step_no ASC')
      .all(projectId) as Array<Omit<ReproductionStep, 'conditions'> & { conditions: unknown }>
    return rows.map((r) => ({ ...r, conditions: parseConditions(r.conditions) }))
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
    const r = db
      .prepare(
        'INSERT INTO reproduction_steps (project_id, step_no, title, description, conditions, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        projectId,
        s.step_no,
        s.title ?? '',
        s.description,
        stringifyConditions(s.conditions),
        s.duration ?? '',
        s.notes ?? ''
      )
    console.log('[DAO] ReproductionDao.addStep 完成, id:', r.lastInsertRowid)
    return { id: r.lastInsertRowid as number }
  },
  clearSteps(projectId: number): void {
    console.log('[DAO] ReproductionDao.clearSteps, projectId:', projectId)
    const db = getSQLite()
    db.prepare('DELETE FROM reproduction_steps WHERE project_id = ?').run(projectId)
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
