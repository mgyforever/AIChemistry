import { tool } from 'langchain/tools'
import { z } from 'zod'

/**
 * CRS (Chemical Recommender System) - 化学化合物推荐系统工具
 *
 * 通过多维度的相似性分析（分子指纹、热物理性质、毒性评估、结构属性、合成可及性），
 * 为用户输入的查询分子推荐结构相似、性质相近的候选化合物。
 *
 * CRS Web API 默认在 http://localhost:5005 运行（通过 `docker compose up -d` 启动）。
 */

const CRS_API_BASE = process.env.CRS_API_BASE || 'http://localhost:5005'

// ==================== API 调用函数 ====================

interface SearchSimilarParams {
  query: string
  final_number?: number
  thermo_properties?: string[]
  include_all_elements?: boolean
  include_specific_elements?: string[]
  disallow_isotopes?: boolean
  substructure_smarts?: string | null
  substructure_count?: number | null
  weights?: number[]
}

interface SearchSimilarResult {
  status: string
  message: string
  query: {
    input: string
    smiles: string
    name: string
    cid: number
  }
  results: Array<{
    cid: string
    final_score: number
    structural_similarity: number
    mw_similarity: number
    thermo_similarity: number
    toxicity: number
    sa_score: number
    properties: Record<string, string>
  }>
  meta: {
    total_results: number
    substructure_search_relaxed: boolean
    opera_failed: boolean
  }
}

/**
 * 调用 CRS REST API 进行化合物相似性搜索
 */
export async function searchSimilarCompounds(
  params: SearchSimilarParams
): Promise<string> {
  console.log('[CRS Tools] searchSimilarCompounds 开始:', {
    query: params.query,
    final_number: params.final_number
  })

  try {
    const response = await fetch(`${CRS_API_BASE}/api/search_similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.query,
        final_number: params.final_number ?? 30,
        thermo_properties: params.thermo_properties ?? [],
        include_all_elements: params.include_all_elements ?? false,
        include_specific_elements: params.include_specific_elements ?? [],
        disallow_isotopes: params.disallow_isotopes ?? false,
        substructure_smarts: params.substructure_smarts ?? null,
        substructure_count: params.substructure_count ?? null,
        weights: params.weights ?? [1, 1, 1, 1, 1]
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[CRS Tools] API 错误:', response.status, errorBody)
      return `CRS API 调用失败 (${response.status}): ${errorBody}`
    }

    const data: SearchSimilarResult = await response.json()

    if (data.status !== 'success') {
      return `搜索失败: ${data.message}`
    }

    // 格式化为可读文本
    const lines: string[] = []
    lines.push(`## 化合物相似性搜索结果`)
    lines.push(``)
    lines.push(`**查询**: ${data.query.input}`)
    lines.push(`**名称**: ${data.query.name || '未知'}`)
    lines.push(`**SMILES**: ${data.query.smiles || '未知'}`)
    lines.push(`**CID**: ${data.query.cid}`)
    lines.push(`**结果数量**: ${data.meta.total_results}`)
    if (data.meta.substructure_search_relaxed) {
      lines.push(`**注意**: 子结构搜索因过于严格已放宽条件`)
    }
    if (data.meta.opera_failed) {
      lines.push(`**警告**: 热物理/毒性属性预测失败，结果精度可能受限`)
    }
    lines.push(``)

    lines.push(`| CID | 综合得分 | 结构相似性 | 分子量相似性 | 热物理相似性 | 毒性 | 合成可及性 |`)
    lines.push(`|-----|----------|------------|--------------|---------------|------|------------|`)
    for (const r of data.results) {
      lines.push(
        `| ${r.cid} | ${r.final_score.toFixed(4)} | ${r.structural_similarity.toFixed(4)} | ` +
        `${r.mw_similarity.toFixed(4)} | ${r.thermo_similarity.toFixed(4)} | ` +
        `${r.toxicity.toFixed(4)} | ${r.sa_score.toFixed(4)} |`
      )
    }

    // 如果有 OPERA 属性预测，附加显示
    const propsResults = data.results.filter((r) => Object.keys(r.properties).length > 0)
    if (propsResults.length > 0) {
      lines.push(``)
      lines.push(`### OPERA 属性预测 (前 5 个结果)`)
      const propKeys = Object.keys(propsResults[0].properties)
      lines.push(`| CID | ${propKeys.join(' | ')} |`)
      lines.push(`|-----|${propKeys.map(() => '---|').join('')}`)
      for (const r of propsResults.slice(0, 5)) {
        const vals = propKeys.map((k) => r.properties[k] || 'N/A')
        lines.push(`| ${r.cid} | ${vals.join(' | ')} |`)
      }
    }

    const result = lines.join('\n')
    console.log('[CRS Tools] searchSimilarCompounds 完成:', { resultLen: result.length })
    return result
  } catch (err) {
    console.error('[CRS Tools] searchSimilarCompounds 异常:', err)
    return `CRS API 调用异常: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ==================== LangChain Tool 定义 ====================

/**
 * 搜索相似化合物——LangChain 标准 Tool
 *
 * 可以搜索与给定化合物结构相似、性质相近的候选化合物。
 * 支持 PubChem CID、IUPAC 名称或 SMILES 三种查询方式。
 */
export const searchSimilarTool = tool(
  async ({ query, final_number, thermo_properties, include_all_elements, include_specific_elements, disallow_isotopes, substructure_smarts, substructure_count, weights }) => {
    const result = await searchSimilarCompounds({
      query,
      final_number,
      thermo_properties,
      include_all_elements,
      include_specific_elements,
      disallow_isotopes,
      substructure_smarts,
      substructure_count,
      weights
    })
    return result || '未搜索到相关化合物'
  },
  {
    name: 'search_similar_compounds',
    description:
      '搜索与给定化合物结构相似、性质相近的候选化合物。' +
      '支持 PubChem CID（如 "6517"）、IUPAC 名称（如 "quinolin-8-ol"）或 SMILES（如 "C1=CC=C2C(=C1)C=CC=N2"）三种查询方式。' +
      '系统通过分子指纹相似度、热物理性质、毒性评估、结构属性和合成可及性五个维度对候选化合物进行综合排序。' +
      '返回结果包含综合得分及各维度得分。' +
      '注意：CRS Docker 环境必须先启动（docker compose up -d），API 默认运行在 http://localhost:5005。',
    schema: z.object({
      query: z.string().describe(
        '查询输入：PubChem CID（如 "6517"）、IUPAC 名称（如 "quinolin-8-ol"）或 SMILES 字符串（如 "C1=CC=C2C(=C1)C=CC=N2"）'
      ),
      final_number: z.number().optional().describe(
        '返回的候选化合物数量，默认 30，建议不超过 1000'
      ),
      thermo_properties: z.array(z.string()).optional().describe(
        '需要比较的热物理属性列表，可选值: MeltingPoint, BoilingPoint, LogP, HenrysLaw, VaporPressure。默认为空数组（不比较热物理属性）'
      ),
      include_all_elements: z.boolean().optional().describe(
        '是否允许所有元素。默认为 false，仅允许 H, C, N, O, F, P, S, Cl, Se, Br, I 这 11 种元素'
      ),
      include_specific_elements: z.array(z.string()).optional().describe(
        '在默认 11 种元素之外额外允许的元素符号列表，如 ["Si", "B", "Li"]。默认为空'
      ),
      disallow_isotopes: z.boolean().optional().describe(
        '是否禁止同位素候选化合物。默认为 false（允许同位素）'
      ),
      substructure_smarts: z.string().nullable().optional().describe(
        'SMARTS 子结构模式字符串，如 "CCO"（必须含有 C-C-O 子结构）、"c1ccccc1"（必须含苯环）。不使用时传 null'
      ),
      substructure_count: z.number().nullable().optional().describe(
        '子结构必须出现的次数。null 表示至少出现 1 次'
      ),
      weights: z.array(z.number()).optional().describe(
        '5 维权重数组 [结构相似性, 分子量, 热物理, 毒性, 合成可及性]，默认 [1,1,1,1,1]。增大某个维度的权重会使其对最终排名影响更大'
      )
    })
  }
)
