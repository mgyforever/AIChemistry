import dotenv from 'dotenv'
import type { FigureType, StructuredFigureData } from '../ai-server/type'

dotenv.config()

/**
 * DeepSeek-VL2 图表识别（D6 已定，v0.6）
 *
 * - API Key：复用 .env 的 DEEPSEEK_API_KEY
 * - 模型与 baseURL：.env 中用户标注 VLM_MODEL / VLM_BASE_URL
 * - 接口：OpenAI 兼容 Chat Completions（image_url 传 base64）
 */

const API_KEY = process.env.DEEPSEEK_API_KEY
const BASE_URL = process.env.VLM_BASE_URL
const MODEL = process.env.VLM_MODEL

/** VLM 是否已配置（未配置时走 OCR + 人工兜底） */
export function isVlmConfigured(): boolean {
  return Boolean(API_KEY && BASE_URL && MODEL)
}

/** 图识别结果 */
export interface FigureRecognition {
  /** 图表类型 */
  type: FigureType
  /** 图题 */
  caption: string
  /** 结构化数据 */
  structured: StructuredFigureData
}

/** 识别提示词（要求输出 6.3 契约 JSON） */
const PROMPT = `你是化学文献图表识别专家。分析给定的图片（化学文献中的图表），并输出严格 JSON：
{
  "type": "table | chemical_structure | spectrum | chart | photograph",
  "caption": "图题（若图中无文字则根据内容概括）",
  "content": {
    "table": [["列头","..."],["行数据","..."]],
    "smiles": "化学结构式（SMILES，仅 type=chemical_structure 时）",
    "spectrum": { "x": [数值...], "y": [数值...], "peaks": [{"ppm": 数值, "multiplicity": "s/d/t/m", "intensity": 数值}] },
    "chart": { "series": [{"name": "系列名", "data": [数值或[x,y]]}] },
    "description": "对照片/其他图表的客观描述"
  }
}
要求：
- 只输出 JSON，不要任何多余文字或解释。
- 表格数据要完整准确；谱图给出坐标轴数据点与峰表；数据图给出各序列数据。
- 数值型数据尽量精确读取坐标轴刻度；无法读取的置为 null 或省略。
- content 只包含与 type 匹配的字段，其余省略。`

/**
 * 调用 DeepSeek-VL2 识别单张图块。
 * 失败/非法 JSON 返回 null（由调用方降级为 OCR + 人工）。
 */
export async function recognizeFigure(dataUrl: string): Promise<FigureRecognition | null> {
  console.log('[VLM] 开始识别图片，已配置:', isVlmConfigured(), '图片数据长度:', dataUrl.length)
  if (!isVlmConfigured()) return null
  try {
    const res = await fetch(`${BASE_URL!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    })

    if (!res.ok) {
      console.warn('[VLM] 请求失败:', res.status, (await res.text()).slice(0, 300))
      return null
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = data.choices?.[0]?.message?.content ?? ''
    const parsed = extractJson(raw)
    if (!parsed) return null

    const type = (parsed.type as FigureType) ?? 'photograph'
    const caption = typeof parsed.caption === 'string' ? parsed.caption : ''
    console.log('[VLM] 识别成功:', JSON.stringify({ type, captionLength: caption.length }))
    return {
      type,
      caption,
      structured: (parsed.content ?? {}) as StructuredFigureData
    }
  } catch (err) {
    console.warn('[VLM] 识别异常:', err)
    return null
  }
}

/** 从模型输出中提取 JSON（兼容 fenced code block 或纯 JSON） */
function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(raw)
    return typeof obj === 'object' ? obj : null
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const obj = JSON.parse(match[0])
      return typeof obj === 'object' ? obj : null
    } catch {
      return null
    }
  }
}
