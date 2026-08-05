import { createTable, addData, searchVectors, tableExists, deleteRows } from '../../database/lancedb'
import { embedText } from '../../embedding'
import type { ProjectSummary, SummarySource } from '../type'

/**
 * 项目向量摘要服务（P5）
 *
 * LanceDB 表 project_summaries：
 *   { project_id, chunk_index, text, source, vector }
 *
 * 写入时机：① 文献解析建项目时；② 每次保存记录/现象时增量追加
 * 读取时机：get_project 语义补充召回
 */

const TABLE = 'project_summaries'

async function ensureTable(): Promise<void> {
  const exists = await tableExists(TABLE)
  if (!exists) {
    await createTable(TABLE, [
      {
        project_id: 0,
        chunk_index: 0,
        text: '',
        source: 'document' as SummarySource,
        vector: new Array<number>(384).fill(0)
      }
    ])
  }
}

/**
 * 写入项目摘要向量（增量）
 */
export async function addProjectSummaries(
  projectId: number,
  chunks: Array<{ text: string; source: SummarySource }>
): Promise<void> {
  if (chunks.length === 0) return
  console.log('[Summaries] addProjectSummaries 开始:', { projectId, chunkCount: chunks.length })
  await ensureTable()
  const rows: ProjectSummary[] = []
  const startedAt = Date.now()
  for (let i = 0; i < chunks.length; i++) {
    const vector = await embedText(chunks[i].text)
    rows.push({
      project_id: projectId,
      chunk_index: i,
      text: chunks[i].text,
      source: chunks[i].source,
      vector
    })
  }
  await addData(TABLE, rows as unknown as Record<string, unknown>[])
  console.log('[Summaries] addProjectSummaries 完成:', {
    chunkCount: rows.length,
    embedCostMs: Date.now() - startedAt
  })
}

/**
 * 语义召回项目摘要（默认仅当前项目，跨项目召回时传 projectId=null）
 */
export async function searchProjectSummaries(
  query: string,
  limit = 5,
  projectId: number | null = null
): Promise<string[]> {
  console.log('[Summaries] searchProjectSummaries 开始:', {
    query: query.slice(0, 100),
    limit,
    projectId
  })
  const exists = await tableExists(TABLE)
  if (!exists) {
    console.log('[Summaries] searchProjectSummaries 表不存在，返回空')
    return []
  }
  const vector = await embedText(query)
  const results = await searchVectors(TABLE, vector, limit * 3)
  const texts: string[] = []
  for (const r of results) {
    const pid = r.project_id as number | undefined
    if (projectId !== null && pid !== undefined && pid !== projectId) continue
    const text = r.text as string | undefined
    if (text) texts.push(text)
    if (texts.length >= limit) break
  }
  console.log('[Summaries] searchProjectSummaries 完成:', { hitCount: texts.length })
  return texts
}

/**
 * 删除某个项目全部向量摘要（项目删除时调用）
 */
export async function deleteProjectSummaries(projectId: number): Promise<void> {
  const exists = await tableExists(TABLE)
  if (!exists) return
  console.log('[Summaries] 删除项目向量摘要, projectId:', projectId)
  await deleteRows(TABLE, `project_id = ${projectId}`)
}
