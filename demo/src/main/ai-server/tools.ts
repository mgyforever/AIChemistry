import dotenv from 'dotenv'
import { tool } from 'langchain/tools'
import { z } from 'zod'

dotenv.config()

const TAVILY_API_KEY = process.env.TAVILY_API_KEY

/**
 * 调用 Tavily Search API 进行网络搜索
 */
export async function searchWeb(query: string, maxResults: number = 5): Promise<string> {
  if (!TAVILY_API_KEY) {
    console.warn('[Tools] TAVILY_API_KEY 未配置，跳过搜索')
    return ''
  }

  console.log('[Tools] searchWeb 开始:', { query, maxResults })

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        include_answer: true
      })
    })

    if (!response.ok) {
      console.error('[Tools] Tavily API 错误:', response.status, response.statusText)
      return ''
    }

    const data = await response.json()

    // 组装搜索结果文本
    const parts: string[] = []
    if (data.answer) {
      parts.push(`摘要：${data.answer}`)
    }

    if (data.results?.length > 0) {
      parts.push('搜索结果：')
      for (const r of data.results) {
        parts.push(`- ${r.title}: ${r.content}`)
      }
    }

    const result = parts.join('\n')
    console.log('[Tools] searchWeb 完成:', { resultLen: result.length })
    return result
  } catch (err) {
    console.error('[Tools] searchWeb 异常:', err)
    return ''
  }
}

/**
 * LangChain 标准 Tool —— 使用 `tool()` 函数 + Zod schema
 * 让 Agent 可以自动调用
 */
export const searchTool = tool(
  async ({ query }) => {
    const result = await searchWeb(query)
    return result || '未搜索到相关信息'
  },
  {
    name: 'web_search',
    description:
      '搜索网络获取最新实时信息，如新闻、价格、数据、事件、论文等。' +
      '当用户询问需要最新资料的问题时，请使用此工具。输入应为搜索关键词。',
    schema: z.object({
      query: z.string().describe('搜索关键词')
    })
  }
)
