import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import { join } from 'path'

let db: lancedb.Connection | null = null

export async function initLanceDB(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'lancedb')
  db = await lancedb.connect(dbPath)
}

export function getLanceDB(): lancedb.Connection {
  if (!db) throw new Error('LanceDB not initialized')
  return db
}

export async function createTable(name: string, data: Record<string, unknown>[]): Promise<void> {
  const conn = getLanceDB()
  await conn.createTable(name, data)
}

export async function addData(tableName: string, data: Record<string, unknown>[]): Promise<void> {
  const conn = getLanceDB()
  const table = await conn.openTable(tableName)
  await table.add(data)
}

export async function searchVectors(
  tableName: string,
  vector: number[],
  limit: number = 10
): Promise<Record<string, unknown>[]> {
  const conn = getLanceDB()
  const table = await conn.openTable(tableName)
  const results = await table.search(vector).limit(limit).toArray()
  return results
}

export async function tableExists(name: string): Promise<boolean> {
  const conn = getLanceDB()
  const tables = await conn.tableNames()
  return tables.includes(name)
}
