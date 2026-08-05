import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let db: Database | null = null

function getDbPath(): string {
  if (is.dev) {
    return join(process.cwd(), 'src/main/database/data/app-data.db')
  }
  return join(app.getPath('userData'), 'app-data.db')
}

export function initSQLite(): void {
  const dbPath = getDbPath()
  console.log('[SQLite] 初始化数据库, db 路径:', dbPath)
  // 确保目录存在
  const dir = join(dbPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables()
  console.log('[SQLite] 数据库初始化完成, 建表完成')
}

function createTables(): void {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // 旧表迁移：为已存在的 conversations 表补充 token 列
  migrateConversationsToken()

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  // ==================== 实验复现 Agent 数据表（P2 新增） ====================

  db.exec(`
    -- 1. 实验项目
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'ongoing',
      summary TEXT DEFAULT '',
      resume_state TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    -- 1.1 项目 AI 陪伴对话（持久化，中断后可恢复上下文）
    CREATE TABLE IF NOT EXISTS project_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      charts_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 2. 项目-文献关联
    CREATE TABLE IF NOT EXISTS project_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      role TEXT DEFAULT 'source',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 3. 文献图表解析结果
    CREATE TABLE IF NOT EXISTS document_figures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      project_id INTEGER,
      figure_index INTEGER,
      page_number INTEGER,
      figure_type TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      structured_data TEXT DEFAULT '{}',
      ocr_text TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    -- 4. 复现方案：化学材料/试剂
    CREATE TABLE IF NOT EXISTS reproduction_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      formula TEXT DEFAULT '',
      cas TEXT DEFAULT '',
      quantity TEXT DEFAULT '',
      purity TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 5. 复现方案：实验步骤
    CREATE TABLE IF NOT EXISTS reproduction_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step_no INTEGER NOT NULL,
      title TEXT DEFAULT '',
      description TEXT NOT NULL,
      conditions TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 6. 复现方案：实验仪器/装置
    CREATE TABLE IF NOT EXISTS reproduction_instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      specification TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 7. 复现方案：注意事项/潜在问题
    CREATE TABLE IF NOT EXISTS reproduction_concerns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT DEFAULT 'operation',
      content TEXT NOT NULL,
      risk_level TEXT DEFAULT '',
      solution TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 8. 复现难度与可行性评估
    CREATE TABLE IF NOT EXISTS reproduction_assessment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      difficulty_score REAL DEFAULT 0,
      feasibility TEXT DEFAULT '',
      analysis TEXT DEFAULT '',
      risk_points TEXT DEFAULT '[]',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 9. 实验阶段
    CREATE TABLE IF NOT EXISTS experiment_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phase_order INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      expected TEXT DEFAULT '',
      metrics_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 10. 阶段实验记录（通用）
    CREATE TABLE IF NOT EXISTS experiment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      phase_id INTEGER,
      record_type TEXT DEFAULT 'phase',
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      data_json TEXT DEFAULT '{}',
      expected TEXT DEFAULT '',
      compliance_percent REAL,
      is_expected INTEGER,
      cause_analysis TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES experiment_phases(id) ON DELETE SET NULL
    );

    -- 11. 用户自定义数据（通用 EAV）
    CREATE TABLE IF NOT EXISTS experiment_custom_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      record_id INTEGER,
      data_name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_value TEXT NOT NULL,
      unit TEXT DEFAULT '',
      extra TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 12. 论文（可选生成，含图表数据）
    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT DEFAULT '',
      content TEXT NOT NULL,
      charts TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 13. AI 预测实验记录
    CREATE TABLE IF NOT EXISTS prediction_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      base_flow TEXT DEFAULT '',
      variables TEXT NOT NULL DEFAULT '[]',
      predicted_result TEXT DEFAULT '',
      property_analysis TEXT DEFAULT '',
      theory_basis TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 14. 复现方案：反应方程式
    CREATE TABLE IF NOT EXISTS reproduction_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      equation TEXT NOT NULL,
      type TEXT DEFAULT '',
      purpose TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 15. 复现方案：表征/分析方法
    CREATE TABLE IF NOT EXISTS reproduction_characterizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      target TEXT DEFAULT '',
      method TEXT NOT NULL,
      conditions TEXT DEFAULT '',
      expected TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 16. 复现方案：信息缺口（文献未说明，复现时需假设/确认）
    CREATE TABLE IF NOT EXISTS reproduction_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      category TEXT DEFAULT 'condition',
      content TEXT NOT NULL,
      impact TEXT DEFAULT '',
      assumption TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  // 旧库迁移：为已存在的 experiment_phases 表补充 metrics_json 列
  migrateExperimentPhasesMetrics()
  // 旧库迁移：为已存在的 projects 表补充 resume_state 列
  migrateProjectsResumeState()
}

/**
 * 旧版数据库迁移：conversations 表若缺少 token 列则补充
 */
function migrateConversationsToken(): void {
  if (!db) return

  const columns = db.pragma('table_info(conversations)') as unknown as { name: string }[]
  const hasToken = columns.some((col) => col.name === 'token')
  if (!hasToken) {
    console.log('[SQLite] 迁移 conversations 表：添加 token 列')
    db.exec("ALTER TABLE conversations ADD COLUMN token TEXT NOT NULL DEFAULT ''")
  }
}

/**
 * 旧版数据库迁移：experiment_phases 表若缺少 metrics_json 列则补充
 */
function migrateExperimentPhasesMetrics(): void {
  if (!db) return

  const columns = db.pragma('table_info(experiment_phases)') as unknown as { name: string }[]
  const hasMetrics = columns.some((col) => col.name === 'metrics_json')
  if (!hasMetrics) {
    console.log('[SQLite] 迁移 experiment_phases 表：添加 metrics_json 列')
    db.exec("ALTER TABLE experiment_phases ADD COLUMN metrics_json TEXT DEFAULT '[]'")
  }
}

/**
 * 旧版数据库迁移：projects 表若缺少 resume_state 列则补充（实验中断恢复点）
 */
function migrateProjectsResumeState(): void {
  if (!db) return

  const columns = db.pragma('table_info(projects)') as unknown as { name: string }[]
  const hasResume = columns.some((col) => col.name === 'resume_state')
  if (!hasResume) {
    console.log('[SQLite] 迁移 projects 表：添加 resume_state 列')
    db.exec("ALTER TABLE projects ADD COLUMN resume_state TEXT DEFAULT '{}'")
  }
}

export function getSQLite(): Database {
  if (!db) throw new Error('SQLite not initialized')
  return db
}

export function closeSQLite(): void {
  if (db) {
    console.log('[SQLite] 关闭数据库连接')
    db.close()
    db = null
  }
}
