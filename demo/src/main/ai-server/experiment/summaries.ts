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
 * 语义召回项目摘要（v0.9：默认仅当前项目；跨项目召回时传 referenceProjectIds）
 */
export async function searchProjectSummaries(
  query: string,
  limit = 5,
  projectId: number | null = null,
  referenceProjectIds: number[] = []
): Promise<string[]> {
  console.log('[Summaries] searchProjectSummaries 开始:', {
    query: query.slice(0, 100),
    limit,
    projectId,
    refCount: referenceProjectIds.length
  })
  const exists = await tableExists(TABLE)
  if (!exists) {
    console.log('[Summaries] searchProjectSummaries 表不存在，返回空')
    return []
  }
  const vector = await embedText(query)
  const results = await searchVectors(TABLE, vector, limit * 3)
  // 允许的项目集合：本项目 + 显式参考项目（v0.9 隔离/共享）
  const allowed = new Set<number>()
  if (projectId !== null) allowed.add(projectId)
  for (const refId of referenceProjectIds) allowed.add(refId)
  const texts: string[] = []
  for (const r of results) {
    const pid = r.project_id as number | undefined
    // 默认严格隔离：仅在允许集合内的项目可被召回
    if (pid !== undefined && !allowed.has(pid)) continue
    const text = r.text as string | undefined
    if (text) texts.push(text)
    if (texts.length >= limit) break
  }
  console.log('[Summaries] searchProjectSummaries 完成:', { hitCount: texts.length })
  return texts
}

/**
 * 后台延迟批量索引（v0.9 §7.11）：
 * 点击"完成本次并行实验"后由主进程后台执行，压缩该分支全部 pending 记录写入向量库。
 * - 记录 content / 符合度分析 / 统计图录数（chart_data 转文本摘要）拼接为压缩文本
 * - 写入后置 vector_status=indexed；分支置 index_status=indexed
 */
export async function indexBranchSummaries(
  projectId: number,
  records: Array<{
    id: number
    name: string
    content: string
    expected: string
    compliance_percent: number | null
    is_expected: number | null
    cause_analysis: string
    detail: string
    chart_data: string
  }>,
  events: Array<{ name: string; content: string }>,
  branchId: number | null = null
): Promise<number> {
  if (records.length === 0 && events.length === 0) return 0
  console.log('[Summaries] indexBranchSummaries 开始:', {
    projectId,
    branchId,
    recordCount: records.length,
    eventCount: events.length
  })
  await ensureTable()
  const chunks: Array<{ text: string; source: SummarySource }> = []
  for (const r of records) {
    const parts: string[] = [`记录「${r.name}」: ${r.content}`]
    if (r.expected) parts.push(`预期: ${r.expected}`)
    if (r.compliance_percent !== null) {
      parts.push(`符合预期 ${r.compliance_percent}%${r.is_expected === 1 ? '（符合）' : '（不符合）'}`)
    }
    if (r.cause_analysis) parts.push(`原因分析: ${r.cause_analysis}`)
    if (r.detail) parts.push(`实验细节: ${r.detail}`)
    // 统计图录数 → 文本摘要（chart_data JSON 内嵌 summary_text 或启发式文本）
    if (r.chart_data && r.chart_data !== '{}') {
      parts.push(`统计图数据: ${chartDataToText(r.chart_data)}`)
    }
    chunks.push({ text: parts.join('\n'), source: 'record' })
  }
  for (const ev of events) {
    chunks.push({ text: `实验事件「${ev.name}」: ${ev.content}`, source: 'phenomenon' })
  }
  await addProjectSummaries(projectId, chunks)
  console.log('[Summaries] indexBranchSummaries 完成:', { chunkCount: chunks.length })
  return chunks.length
}

/** 将 ChartRecordData JSON 转为可检索文本（优先使用 LLM 生成的 summary_text） */
function chartDataToText(chartDataJson: string): string {
  try {
    const d = JSON.parse(chartDataJson) as {
      title?: string
      x_label?: string
      y_label?: string
      unit?: string
      summary_text?: string
      series?: Array<{ name?: string; data?: Array<[number | string, number]> }>
    }
    if (d.summary_text) return d.summary_text
    const parts: string[] = []
    if (d.title) parts.push(`图表:${d.title}`)
    for (const s of d.series ?? []) {
      const points = (s.data ?? []).map((p) => `${p[0]}→${p[1]}`).join(', ')
      parts.push(`${s.name ?? '序列'}: ${points}`)
    }
    if (d.unit) parts.push(`单位:${d.unit}`)
    return parts.join('；') || '（无数据）'
  } catch {
    return '（统计图数据解析失败）'
  }
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
