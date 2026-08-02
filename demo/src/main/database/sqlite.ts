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
  // 确保目录存在
  const dir = join(dbPath, '..')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables()
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

export function getSQLite(): Database {
  if (!db) throw new Error('SQLite not initialized')
  return db
}

export function closeSQLite(): void {
  if (db) {
    db.close()
    db = null
  }
}
