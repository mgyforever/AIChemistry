import dotenv from 'dotenv'
import type { FigureType, StructuredFigureData } from '../ai-server/type'

dotenv.config()

/**
 * Kimi-K2.6 图表识别（硅基流动 SiliconFlow，Pro/moonshotai/Kimi-K2.6）
 *
 * - API Key：.env 的 SILICONFLOW_API_KEY（硅基流动平台）
 * - 模型与 baseURL：.env 中用户标注 VLM_MODEL / VLM_BASE_URL
 * - 接口：OpenAI 兼容 Chat Completions（image_url 传 base64）
 * - 参考：https://api-docs.siliconflow.cn/docs/api/chat-completions-post
 */

const API_KEY = process.env.SILICONFLOW_API_KEY
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
  /** 图类细分（如 scheme / sem / nmr_1h / line_chart 等） */
  subtype?: string
  /** 图题 */
  caption: string
  /** 结构化数据 */
  structured: StructuredFigureData
}

/** 识别提示词（6.3 契约 JSON：type 五类 + subtype 细分，覆盖化学论文绝大多数图类） */
const PROMPT = `你是化学文献图表识别专家。分析给定的图片（化学论文中的图表），并输出严格 JSON：
{
  "type": "table | chemical_structure | spectrum | chart | photograph",
  "subtype": "具体子类型（见下方分类，必须给出）",
  "caption": "图题（若图中无文字则根据内容概括）",
  "content": {
    "table": [["列头","..."],["行数据","..."]],
    "smiles": "化学结构式 SMILES（仅 type=chemical_structure 且可准确转换时）",
    "spectrum": {
      "spectrum_type": "谱图子类型",
      "x": [数值...],
      "y": [数值...],
      "x_label": "X 轴名称，如 '2θ (°)'、'波长 (nm)'、'm/z'",
      "y_label": "Y 轴名称，如 '强度 (a.u.)'、'透过率 (%)'",
      "unit": "单位",
      "peaks": [{"ppm": 峰位, "multiplicity": "s/d/t/m（NMR 用）", "intensity": 数值}]
    },
    "chart": { "x_label": "X 轴名称", "y_label": "Y 轴名称", "unit": "单位", "series": [{"name": "系列名", "data": [数值或[x,y]]}] },
    "description": "客观描述（照片/无法结构化的图）"
  }
}
type 与 subtype 分类：
1. table 表格：数据表、物理性质表、晶体学参数表、条件筛选/优化表、化合物对比表、产率汇总表等。
2. chemical_structure 化学结构：键线式/结构式、反应方案图(scheme)、合成或逆合成路线、反应机理图、3D 分子结构(球棍/填充)、晶体结构图(ORTEP)、分子轨道/静电势图等；subtype 如 scheme / mechanism / retrosynthesis / crystal / 3d_structure。
3. spectrum 谱图：subtype 如 nmr_1h / nmr_13c / ir / ms / uv_vis / xrd / tga_dsc / raman / fluorescence / epr / hplc / gc / cv(循环伏安) 等；尽量给出坐标数据点，NMR 给出峰表(ppm/多重峰/强度)，XRD 峰表用 2θ 与强度，MS 峰表用 m/z 与相对丰度，IR 峰表用波数(cm-1)。
4. chart 数据图：折线、柱状、散点、直方图、3D 曲面、等高线/热图、相图、能量曲线(反应势能面/Gibbs 自由能)、Arrhenius/van't Hoff 图等；subtype 如 line_chart / bar_chart / scatter / histogram / contour / 3d_surface / phase_diagram / energy_profile。
5. photograph 照片/显微图：SEM/TEM/AFM 显微照片、光学显微图、晶体实物照片、实验装置照片、TLC 板、凝胶电泳、接触角等；subtype 如 sem / tem / afm / optical / crystal / apparatus / tlc。
要求：
- 只输出 JSON，不要任何多余文字或解释。
- type 必须是上面五类之一；subtype 必须给出（不确定时取最相近的）。
- 表格数据要完整准确；谱图给出坐标轴数据点与关键峰表；数据图给出各序列数据与坐标轴标签/单位。
- 数值型数据尽量精确读取坐标轴刻度；无法读取的置为 null 或省略。
- 化学结构式若无法准确给出 SMILES，则在 description 中用文字描述其骨架与官能团。
- content 只包含与 type 匹配的字段，其余省略。`

/**
 * 调用 Kimi-K2.6（SiliconFlow）识别单张图块。
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
        max_tokens: 4096,
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
    const subtype = typeof parsed.subtype === 'string' ? parsed.subtype : undefined
    const caption = typeof parsed.caption === 'string' ? parsed.caption : ''
    console.log('[VLM] 识别成功:', JSON.stringify({ type, subtype, captionLength: caption.length }))
    return {
      type,
      subtype,
      caption,
      // 透传 content 并附带 subtype，使细分类型随 structured_data 一并持久化
      structured: {
        ...((parsed.content ?? {}) as StructuredFigureData),
        ...(subtype ? { subtype } : {})
      }
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
