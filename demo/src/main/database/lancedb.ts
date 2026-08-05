import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import { join } from 'path'

let db: lancedb.Connection | null = null

export async function initLanceDB(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'lancedb')
  console.log('[LanceDB] 初始化, 连接路径:', dbPath)
  db = await lancedb.connect(dbPath)
  console.log('[LanceDB] 初始化完成')
}

export function getLanceDB(): lancedb.Connection {
  if (!db) throw new Error('LanceDB not initialized')
  return db
}

/** 瞬时 IO 错误（Windows 文件锁/杀软扫描，os error 5 拒绝访问）重试 */
const IO_ERROR_RE = /os error 5|拒绝访问|Access denied|EACCES|LanceError\(IO\)/i

function isTransientIOError(err: unknown): boolean {
  return err instanceof Error && IO_ERROR_RE.test(err.message)
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 300): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries - 1 || !isTransientIOError(err)) throw err
      console.warn(
        `[LanceDB] 瞬时 IO 错误（第 ${attempt + 1}/${retries - 1} 次重试）:`,
        err instanceof Error ? err.message : err
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}

export async function createTable(name: string, data: Record<string, unknown>[]): Promise<void> {
  console.log(`[LanceDB] createTable 开始, 表名: ${name}, 数据条数: ${data.length}`)
  try {
    await withRetry(async () => {
      const conn = getLanceDB()
      await conn.createTable(name, data)
    })
    console.log(`[LanceDB] createTable 完成, 表名: ${name}, 写入 ${data.length} 条`)
  } catch (err) {
    console.error(`[LanceDB] createTable 失败, 表名: ${name}:`, err)
    throw err
  }
}

export async function addData(tableName: string, data: Record<string, unknown>[]): Promise<void> {
  console.log(`[LanceDB] addData 开始, 表名: ${tableName}, 数据条数: ${data.length}`)
  try {
    await withRetry(async () => {
      const conn = getLanceDB()
      const table = await conn.openTable(tableName)
      await table.add(data)
    })
    console.log(`[LanceDB] addData 完成, 表名: ${tableName}, 追加 ${data.length} 条`)
  } catch (err) {
    console.error(`[LanceDB] addData 失败, 表名: ${tableName}:`, err)
    throw err
  }
}

export async function searchVectors(
  tableName: string,
  vector: number[],
  limit: number = 10
): Promise<Record<string, unknown>[]> {
  console.log(`[LanceDB] searchVectors 开始, 表名: ${tableName}, limit: ${limit}, 向量维度: ${vector.length}`)
  try {
    const conn = getLanceDB()
    const table = await conn.openTable(tableName)
    const results = await table.search(vector).limit(limit).toArray()
    console.log(`[LanceDB] searchVectors 完成, 表名: ${tableName}, 结果条数: ${results.length}`)
    return results
  } catch (err) {
    console.error(`[LanceDB] searchVectors 失败, 表名: ${tableName}:`, err)
    throw err
  }
}

export async function tableExists(name: string): Promise<boolean> {
  console.log(`[LanceDB] tableExists 开始, 表名: ${name}`)
  try {
    const conn = getLanceDB()
    const tables = await conn.tableNames()
    const exists = tables.includes(name)
    console.log(`[LanceDB] tableExists 完成, 表名: ${name}, 存在: ${exists}`)
    return exists
  } catch (err) {
    console.error(`[LanceDB] tableExists 失败, 表名: ${name}:`, err)
    throw err
  }
}

/**
 * 按过滤条件删除表内数据（filter 为 SQL 风格条件，如 `project_id = 3`）
 */
export async function deleteRows(tableName: string, filter: string): Promise<void> {
  console.log(`[LanceDB] deleteRows 开始, 表名: ${tableName}, filter: ${filter}`)
  try {
    await withRetry(async () => {
      const conn = getLanceDB()
      const table = await conn.openTable(tableName)
      await table.delete(filter)
    })
    console.log(`[LanceDB] deleteRows 完成, 表名: ${tableName}, filter: ${filter}`)
  } catch (err) {
    console.error(`[LanceDB] deleteRows 失败, 表名: ${tableName}, filter: ${filter}:`, err)
    throw err
  }
}
