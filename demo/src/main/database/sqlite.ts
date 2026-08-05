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
  backfillFigureProject()
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
      step_id INTEGER,
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

    -- 5. 复现方案：实验步骤（v0.7：依赖图 DAG）
    CREATE TABLE IF NOT EXISTS reproduction_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step_no INTEGER NOT NULL,
      title TEXT DEFAULT '',
      description TEXT NOT NULL,
      conditions TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      depends_on TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      branch_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE
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

    -- 9. 实验阶段（v0.7：门禁 + 小结；v0.8：分支归属）
    CREATE TABLE IF NOT EXISTS experiment_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      branch_id INTEGER,
      name TEXT NOT NULL,
      phase_order INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      gate_status TEXT DEFAULT 'locked',
      summary TEXT DEFAULT '',
      summary_created_at DATETIME,
      can_parallel INTEGER DEFAULT 0,
      expected TEXT DEFAULT '',
      metrics_json TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE
    );

    -- 9b. 并行实验分叉（v0.8 树分叉模型）
    CREATE TABLE IF NOT EXISTS project_branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      parent_branch_id INTEGER,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      variable_overrides TEXT DEFAULT '{}',
      fork_phase_id INTEGER,
      index_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_branch_id) REFERENCES project_branches(id) ON DELETE CASCADE,
      FOREIGN KEY (fork_phase_id) REFERENCES experiment_phases(id) ON DELETE SET NULL
    );

    -- 9c. 阶段实验变量（v0.9；v3：步骤归属 + 步骤变体归属）
    CREATE TABLE IF NOT EXISTS experiment_phase_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      phase_id INTEGER NOT NULL,
      step_id INTEGER,
      branch_id INTEGER,
      step_experiment_id INTEGER,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'other',
      unit TEXT DEFAULT '',
      default_value TEXT DEFAULT '',
      current_value TEXT DEFAULT '',
      options TEXT DEFAULT '[]',
      is_agent_generated INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES experiment_phases(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE
    );

    -- 9d. 实验事件（v0.9，可附图片/视频；v3：步骤归属 + 步骤变体归属）
    CREATE TABLE IF NOT EXISTS experiment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      branch_id INTEGER,
      phase_id INTEGER,
      step_id INTEGER,
      step_experiment_id INTEGER,
      name TEXT NOT NULL,
      content TEXT DEFAULT '',
      media_paths TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES experiment_phases(id) ON DELETE SET NULL
    );

    -- 10. 阶段实验记录（通用；v0.9：附件/统计图/向量状态；v3：步骤归属 + 步骤变体归属）
    CREATE TABLE IF NOT EXISTS experiment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      phase_id INTEGER,
      step_id INTEGER,
      branch_id INTEGER,
      step_experiment_id INTEGER,
      record_type TEXT DEFAULT 'phase',
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      data_json TEXT DEFAULT '{}',
      attachments TEXT DEFAULT '[]',
      chart_data TEXT DEFAULT '{}',
      vector_status TEXT DEFAULT 'pending',
      expected TEXT DEFAULT '',
      compliance_percent REAL,
      is_expected INTEGER,
      cause_analysis TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES experiment_phases(id) ON DELETE SET NULL,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE
    );

    -- 10e. 步骤级并行实验变体（v3 问题⑥：步骤内修改实验变量生成的并行实验）
    CREATE TABLE IF NOT EXISTS step_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      step_id INTEGER NOT NULL,
      branch_id INTEGER,
      parent_experiment_id INTEGER,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      variable_overrides TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES reproduction_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_experiment_id) REFERENCES step_experiments(id) ON DELETE CASCADE
    );

    -- 10b. 项目间共享关系（v0.9）
    CREATE TABLE IF NOT EXISTS project_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      ref_project_id INTEGER NOT NULL,
      ref_name TEXT DEFAULT '',
      scope TEXT DEFAULT 'documents',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (ref_project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 10c. 共享请求（v0.10，审批通过后提升 project_links.scope）
    CREATE TABLE IF NOT EXISTS project_link_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      target_project_id INTEGER NOT NULL,
      target_owner_name TEXT DEFAULT '',
      scope TEXT NOT NULL DEFAULT 'summaries',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      resolved_at DATETIME,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (target_project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 11. 用户自定义数据（通用 EAV；v3：步骤归属 + 步骤变体归属）
    CREATE TABLE IF NOT EXISTS experiment_custom_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      record_id INTEGER,
      step_id INTEGER,
      step_experiment_id INTEGER,
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

    -- 13. AI 预测实验记录（v0.8：可关联分叉；v3：可关联步骤/变体）
    CREATE TABLE IF NOT EXISTS prediction_experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      branch_id INTEGER,
      step_id INTEGER,
      step_experiment_id INTEGER,
      name TEXT NOT NULL,
      base_flow TEXT DEFAULT '',
      variables TEXT NOT NULL DEFAULT '[]',
      predicted_result TEXT DEFAULT '',
      property_analysis TEXT DEFAULT '',
      theory_basis TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (branch_id) REFERENCES project_branches(id) ON DELETE CASCADE
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
  // 旧库迁移：v0.7/0.8/0.9 新增列（步骤依赖/门禁/分支/附件/统计图/向量状态）
  migrateReproColumns()
}

/**
 * 迁移：回填 document_figures.project_id。
 * 历史数据入库时未归属项目，此处按 project_documents 关联补齐，
 * 使图表面板（按 project_id 查询）能取到既有图表。
 */
function backfillFigureProject(): void {
  if (!db) return
  try {
    const r = db
      .prepare(
        `UPDATE document_figures
         SET project_id = (
           SELECT MIN(pd.project_id) FROM project_documents pd
           WHERE pd.document_id = document_figures.document_id
         )
         WHERE project_id IS NULL
           AND EXISTS (SELECT 1 FROM project_documents pd2 WHERE pd2.document_id = document_figures.document_id)`
      )
      .run()
    if (r.changes > 0) console.log('[SQLite] 回填图表项目归属:', r.changes, '条')
  } catch (err) {
    console.error('[SQLite] 图表项目归属回填失败:', err)
  }
}

/**
 * 通用迁移：若指定表缺少某列则 ALTER TABLE 补充
 */
function ensureColumn(table: string, column: string, ddl: string): void {
  if (!db) return
  const columns = db.pragma(`table_info(${table})`) as unknown as { name: string }[]
  if (columns.some((col) => col.name === column)) return
  console.log(`[SQLite] 迁移 ${table} 表：添加 ${column} 列`)
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
}

/**
 * v0.7/0.8/0.9/1.0 新增列迁移：
 * - reproduction_steps: depends_on / status / branch_id
 * - experiment_phases:   branch_id / gate_status / summary / summary_created_at / can_parallel
 * - experiment_records:  branch_id / attachments / chart_data / vector_status
 * - prediction_experiments: branch_id
 * - v3（修改计划③⑥⑧）：各表 step_id / step_experiment_id；document_figures.step_id
 */
function migrateReproColumns(): void {
  if (!db) return
  ensureColumn('reproduction_steps', 'depends_on', "TEXT DEFAULT '[]'")
  ensureColumn('reproduction_steps', 'status', "TEXT DEFAULT 'pending'")
  ensureColumn('reproduction_steps', 'branch_id', 'INTEGER')
  ensureColumn('experiment_phases', 'branch_id', 'INTEGER')
  ensureColumn('experiment_phases', 'gate_status', "TEXT DEFAULT 'locked'")
  ensureColumn('experiment_phases', 'summary', "TEXT DEFAULT ''")
  ensureColumn('experiment_phases', 'summary_created_at', 'DATETIME')
  ensureColumn('experiment_phases', 'can_parallel', 'INTEGER DEFAULT 0')
  ensureColumn('experiment_records', 'branch_id', 'INTEGER')
  ensureColumn('experiment_records', 'attachments', "TEXT DEFAULT '[]'")
  ensureColumn('experiment_records', 'chart_data', "TEXT DEFAULT '{}'")
  ensureColumn('experiment_records', 'vector_status', "TEXT DEFAULT 'pending'")
  ensureColumn('prediction_experiments', 'branch_id', 'INTEGER')
  // v3：步骤归属 + 步骤变体归属 + 图表归属
  ensureColumn('experiment_records', 'step_id', 'INTEGER')
  ensureColumn('experiment_records', 'step_experiment_id', 'INTEGER')
  ensureColumn('experiment_events', 'step_id', 'INTEGER')
  ensureColumn('experiment_events', 'step_experiment_id', 'INTEGER')
  ensureColumn('experiment_phase_variables', 'step_id', 'INTEGER')
  ensureColumn('experiment_phase_variables', 'step_experiment_id', 'INTEGER')
  ensureColumn('experiment_custom_data', 'step_id', 'INTEGER')
  ensureColumn('experiment_custom_data', 'step_experiment_id', 'INTEGER')
  ensureColumn('prediction_experiments', 'step_id', 'INTEGER')
  ensureColumn('prediction_experiments', 'step_experiment_id', 'INTEGER')
  ensureColumn('document_figures', 'step_id', 'INTEGER')
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
