import dotenv from 'dotenv'
import { tool } from 'langchain/tools'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

dotenv.config()

/**
 * SciGraph-SCP 科学知识图谱工具
 *
 * 通过上海 AI Lab 的 SciGraph SCP Server（MCP streamableHttp 协议）远程查询科学知识图谱，
 * 支持跨学科知识检索（化学、生物、药物、材料、物理等）。
 *
 * MCP 端点：https://scp.intern-ai.org.cn/api/v1/mcp/37/SciGraph
 * 鉴权方式：请求头 SCP-HUB-API-KEY（值来自 .env 的 SCP_API_KEY）
 *
 * 服务提供 4 个工具：
 * - query_cypher           在指定图谱上执行 Cypher 查询
 * - get_kg_statistics      获取图谱节点/关系统计
 * - get_node_labels        获取图谱节点类型
 * - get_relationship_types 获取图谱关系类型
 */

const SCP_API_KEY = process.env.SCP_API_KEY
const SCP_MCP_URL =
  process.env.SCP_MCP_URL || 'https://scp.intern-ai.org.cn/api/v1/mcp/37/SciGraph'

/**
 * 服务端实际支持的知识图谱（共 70 个，通过 get_kg_statistics 探测验证）。
 * 覆盖化学、药物、生物、材料、物理、数学、地球科学等领域。
 */
const SUPPORTED_KGS = [
  // 化学
  'ElementKG',
  'KANO-ChEBI',
  'ReaKE',
  'SciMKG',
  'YaSAScore',
  // 药物 / 生物医学
  'ADR-Graph',
  'BEACON',
  'Biomedical-Drug',
  'CISREG',
  'DDKG',
  'Healx',
  'MKG-FENN',
  'OM',
  'OPB',
  'SpaTalk',
  'SSC-CoT',
  'DTINet',
  'DTINet-Data',
  'KG-FM',
  'ProteinKG25',
  'TxGNN',
  'Otter-PrimeKG',
  'Otter-UBC',
  'Otter-DUDe',
  'Otter-STITCH',
  'PertKGE',
  'RNA-KG',
  'ClinicalKG',
  'InstructProteinKG',
  'BioActivity',
  'iKraph',
  'KG-MTL',
  'KGNN',
  'KnowDDI',
  'MEKG',
  'MiKG',
  'NAFLDkb',
  'PPIKG',
  'PyBioMart',
  'BiomolKG',
  'immuneXpresso',
  'InnateDB',
  'KGE-UNITKG',
  'MMIKG',
  'SMUDGE',
  'TCM-KG',
  'IDP',
  'E-Coli',
  // 材料
  'KANO',
  'Material',
  'MatKG',
  'MatMechOnto',
  // 物理 / 数学
  'PhySci',
  'AEQG-Physics',
  'GraPhysics',
  'MathTTKG',
  'PhysTTKG',
  'TransFOL',
  'Theoria',
  'QUDT',
  // 地球 / 环境 / 海洋
  'RegionalGeoTime',
  'MarineExpert',
  'OceanGraph',
  'KnowUREnvironment',
  'HistoricalMarineBio',
  'WorldKG',
  // 其他通用 / 图谱
  'KCL',
  'GraphEvo',
  'MGEDKG',
  'PSPP'
]

// ==================== MCP 连接管理（懒加载单例） ====================

let mcpClient: Client | null = null
let connecting: Promise<Client> | null = null

/**
 * 获取（或创建）到 SciGraph SCP Server 的 MCP 客户端连接。
 * 使用 promise 单例避免并发调用时重复建立连接。
 */
async function getClient(): Promise<Client> {
  if (mcpClient) return mcpClient
  if (connecting) return connecting

  connecting = (async () => {
    const client = new Client({
      name: 'ai-chemistry-agent',
      version: '1.0.0'
    })
    const transport = new StreamableHTTPClientTransport(
      new URL(SCP_MCP_URL),
      {
        requestInit: {
          headers: {
            'SCP-HUB-API-KEY': SCP_API_KEY || '',
            'Content-Type': 'application/json'
          }
        }
      }
    )
    await client.connect(transport)
    mcpClient = client
    return client
  })()

  try {
    return await connecting
  } catch (err) {
    connecting = null
    throw err
  } finally {
    connecting = null
  }
}

/** 重置连接（连接失效后下次调用会重新建立） */
function resetClient(): void {
  mcpClient = null
  connecting = null
}

interface CallToolResult {
  content?: Array<{ type: string; text?: string }>
}

/**
 * 调用 SciGraph MCP 工具，返回文本内容（服务端返回的是 JSON 字符串）
 */
async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  if (!SCP_API_KEY) {
    console.warn('[SciGraph] SCP_API_KEY 未配置，跳过调用')
    return 'SciGraph 调用失败：.env 中未配置 SCP_API_KEY'
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const client = await getClient()
      console.log('[SciGraph] 调用 MCP 工具:', { name, args })
      const result = (await client.callTool({
        name,
        arguments: args
      })) as CallToolResult

      const textBlocks = (result.content ?? [])
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
      const text = textBlocks.join('\n')
      console.log('[SciGraph] 调用完成:', { resultLen: text.length })
      return text || JSON.stringify(result)
    } catch (err) {
      console.error('[SciGraph] 调用异常:', err)
      resetClient()
      // 若连接失效，重连后重试一次
      if (attempt === 1) {
        return `SciGraph 调用异常: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }
  return 'SciGraph 调用失败'
}

// ==================== 结果格式化工具 ====================

/** 将服务端返回的 JSON 字符串解析为对象（失败时返回 null） */
function parseResult(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text)
    return typeof obj === 'object' && obj !== null ? obj : null
  } catch {
    return null
  }
}

/** 将数据行数组格式化为 Markdown 表格 */
function formatRowsAsTable(rows: unknown[]): string {
  if (rows.length === 0) return '（无数据）'
  const colCount = Math.max(
    ...rows.map((r) => (Array.isArray(r) ? r.length : 1))
  )
  const headers = Array.from(
    { length: colCount },
    (_, i) => `列${i + 1}`
  )
  const lines: string[] = [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---|').join('')}`
  ]
  for (const row of rows.slice(0, 50)) {
    const cells = Array.isArray(row)
      ? row.map((c) => String(c ?? '').replace(/\|/g, '\\|'))
      : [String(row)]
    while (cells.length < colCount) cells.push('')
    lines.push(`| ${cells.join(' | ')} |`)
  }
  if (rows.length > 50) {
    lines.push(`… 共 ${rows.length} 行，仅显示前 50 行`)
  }
  return lines.join('\n')
}

/** 解析 query_cypher 的结果并格式化为可读文本 */
function formatQueryResult(text: string): string {
  const obj = parseResult(text)
  if (!obj) return text
  if (obj.success === false) {
    return `图谱查询失败: ${obj.message ?? text}`
  }
  const kgName = String(obj.kg_name ?? '未知')
  const count = obj.count ?? (Array.isArray(obj.data) ? obj.data.length : 0)
  const data = Array.isArray(obj.data) ? obj.data : []
  const lines: string[] = []
  lines.push(`## 科学图谱查询结果`)
  lines.push(`**图谱**: ${kgName}  |  **返回行数**: ${count}`)
  lines.push('')
  lines.push(formatRowsAsTable(data))
  return lines.join('\n')
}

/** 解析 get_kg_statistics 的结果 */
function formatStatisticsResult(text: string): string {
  const obj = parseResult(text)
  if (!obj) return text
  if (obj.success === false) {
    return `获取图谱统计失败: ${obj.message ?? text}`
  }
  const stats = (obj.statistics ?? {}) as Record<string, unknown>
  const lines: string[] = []
  lines.push(`## 知识图谱统计（${String(obj.kg_name ?? '未知')}）`)
  if (typeof stats.total_nodes === 'number') {
    lines.push(`**总节点数**: ${stats.total_nodes}`)
  }
  if (typeof stats.total_relationships === 'number') {
    lines.push(`**总关系数**: ${stats.total_relationships}`)
  }
  const nodeTypes = stats.node_types as Array<{ label?: string; count?: number }>
  if (Array.isArray(nodeTypes) && nodeTypes.length > 0) {
    lines.push('')
    lines.push('### 节点类型')
    lines.push('| 类型 | 数量 |')
    lines.push('|------|------|')
    for (const nt of nodeTypes) {
      lines.push(`| ${nt.label ?? '未知'} | ${nt.count ?? 0} |`)
    }
  }
  const relTypes = stats.relationship_types as Array<{
    relationship_type?: string
    count?: number
  }>
  if (Array.isArray(relTypes) && relTypes.length > 0) {
    lines.push('')
    lines.push('### 关系类型')
    lines.push('| 关系 | 数量 |')
    lines.push('|------|------|')
    for (const rt of relTypes) {
      lines.push(`| ${rt.relationship_type ?? '未知'} | ${rt.count ?? 0} |`)
    }
  }
  return lines.join('\n')
}

/** 解析 get_node_labels / get_relationship_types 的结果 */
function formatLabelListResult(text: string, title: string): string {
  const obj = parseResult(text)
  if (!obj) return text
  if (obj.success === false) {
    return `${title}失败: ${obj.message ?? text}`
  }
  const items = (obj.node_labels ?? obj.relationship_types) as Array<{
    label?: string
    relationship_type?: string
    count?: number
  }>
  const lines: string[] = [`## ${title}（${String(obj.kg_name ?? '未知')}）`]
  lines.push('')
  if (!Array.isArray(items) || items.length === 0) {
    lines.push('（无数据）')
    return lines.join('\n')
  }
  lines.push('| 类型 | 数量 |')
  lines.push('|------|------|')
  for (const it of items) {
    lines.push(`| ${it.label ?? it.relationship_type ?? '未知'} | ${it.count ?? 0} |`)
  }
  return lines.join('\n')
}

// ==================== LangChain Tool 定义 ====================

/** 完整图谱列表描述（用于 query_scientific_graph 工具） */
const kgNameDescribeFull = `知识图谱名称（必选，不区分大小写）。服务端共支持 ${SUPPORTED_KGS.length} 个图谱: ${SUPPORTED_KGS.join(', ')}`

/** 精简图谱描述（用于其他工具，避免描述过长） */
const kgNameDescribe = `知识图谱名称（必选，不区分大小写）。服务端共支持 ${SUPPORTED_KGS.length} 个知识图谱（化学/药物/生物/材料/物理等），完整列表见 query_scientific_graph 工具的说明`

/**
 * 在科学知识图谱上执行 Cypher 查询
 */
export const queryScientificGraphTool = tool(
  async ({ kg_name, cypher, limit }) => {
    const result = await callMcpTool('query_cypher', {
      kg_name,
      cypher,
      limit: limit ?? 100
    })
    return formatQueryResult(result) || '图谱查询无返回结果'
  },
  {
    name: 'query_scientific_graph',
    description:
      '在指定的科学知识图谱上执行 Cypher 查询，用于检索化合物/药物/蛋白质/疾病/材料等实体及其关系。' +
      '适用场景：查询某化合物靶向的蛋白质、某蛋白质参与的生物过程与通路、药物-靶点相互作用、材料属性、化学实验知识、跨学科知识关联等。' +
      `${kgNameDescribeFull}。` +
      '化学相关图谱优先选择 ElementKG（含元素性质、化学实验、实验步骤、实验装置、试剂、反应）。' +
      '注意：必须先了解目标图谱的节点类型和关系类型（可用 get_kg_statistics / get_kg_node_labels / get_kg_relationship_types 工具查看），再编写正确的 Cypher 语句。',
    schema: z.object({
      kg_name: z.string().describe(kgNameDescribeFull),
      cypher: z.string().describe(
        'Cypher 查询语句，例如 "MATCH (d:Drug)-[:BINDS_TO]->(p:Protein) WHERE d.name CONTAINS \'Aspirin\' RETURN d.name, p.name LIMIT 30"。必须带 LIMIT 限制返回行数。'
      ),
      limit: z.number().optional().describe(
        '返回的最大行数，默认 100'
      )
    })
  }
)

/**
 * 获取知识图谱统计信息（节点/关系总数、节点类型、关系类型分布）
 */
export const kgStatisticsTool = tool(
  async ({ kg_name }) => {
    const result = await callMcpTool('get_kg_statistics', { kg_name })
    return formatStatisticsResult(result)
  },
  {
    name: 'get_kg_statistics',
    description:
      '获取指定科学知识图谱的统计信息，包括总节点数、总关系数、节点类型分布和关系类型分布。' +
      '在编写 Cypher 查询之前，建议先调用本工具了解图谱结构。',
    schema: z.object({
      kg_name: z.string().describe(kgNameDescribe)
    })
  }
)

/**
 * 获取知识图谱节点类型
 */
export const kgNodeLabelsTool = tool(
  async ({ kg_name }) => {
    const result = await callMcpTool('get_node_labels', { kg_name })
    return formatLabelListResult(result, '知识图谱节点类型')
  },
  {
    name: 'get_kg_node_labels',
    description:
      '获取指定科学知识图谱中所有节点类型（Node Label）及每种类型的数量，用于了解图谱中有哪些实体类型，辅助编写 Cypher 查询。',
    schema: z.object({
      kg_name: z.string().describe(kgNameDescribe)
    })
  }
)

/**
 * 获取知识图谱关系类型
 */
export const kgRelationshipTypesTool = tool(
  async ({ kg_name }) => {
    const result = await callMcpTool('get_relationship_types', { kg_name })
    return formatLabelListResult(result, '知识图谱关系类型')
  },
  {
    name: 'get_kg_relationship_types',
    description:
      '获取指定科学知识图谱中所有关系类型（Relationship Type）及每种关系的数量，用于了解图谱中实体之间的连接方式，辅助编写 Cypher 查询。',
    schema: z.object({
      kg_name: z.string().describe(kgNameDescribe)
    })
  }
)
