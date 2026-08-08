import dotenv from 'dotenv'
import { performance } from 'perf_hooks'
import { model } from '../ai-server/model'
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

/** 图片识别上下文（P4：论文上下文注入，帮助 VLM 结合全文理解图片） */
export interface FigureContext {
  /** 论文整体摘要（文献目的/研究对象/关键结果） */
  summary?: string
  /** 图题（论文正文中的 "Figure N. ..."） */
  caption?: string
  /** 所在页及邻近页正文摘录 */
  pageText?: string
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
- 禁止输出任何 HTML 标签（如 <table>/<tr>/<td>/<b>）；表格必须是纯文本二维数组，单元格内公式用 $...$ 包裹的 LaTeX 表示。
- 所有文字字段（caption/description/series 名称等）一律使用中文输出；化学专有名词用中文，可在括号内附英文（如 铜粉(Cu powder)）；禁止中英混杂的句子，caption 控制在 50 字内。
- 表格数据要完整准确；谱图给出坐标轴数据点与关键峰表；数据图给出各序列数据与坐标轴标签/单位。
- 数值型数据尽量精确读取坐标轴刻度；无法读取的置为 null 或省略。
- 化学结构式若无法准确给出 SMILES，则在 description 中用中文文字描述其骨架与官能团。
- content 只包含与 type 匹配的字段，其余省略。`

/**
 * 调用 Kimi-K2.6（SiliconFlow）识别单张图块。
 * ctx 为论文上下文（摘要/图题/所在页正文），帮助模型结合全文精确理解图片。
 * 失败/非法 JSON 返回 null（由调用方降级为 OCR + 人工）。
 */
export async function recognizeFigure(dataUrl: string, ctx?: FigureContext): Promise<FigureRecognition | null> {
  console.log('[VLM] 开始识别图片，已配置:', isVlmConfigured(), '图片数据长度:', dataUrl.length)
  if (!isVlmConfigured()) return null
  const t0 = performance.now()
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
              { type: 'text', text: PROMPT + buildContextBlock(ctx) },
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
      console.warn('[VLM] 请求失败:', res.status, (await res.text()).slice(0, 300), '耗时:', Math.round(performance.now() - t0), 'ms')
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
    console.log(
      '[VLM] 识别成功:',
      JSON.stringify({ type, subtype, captionLength: caption.length }),
      '耗时:',
      Math.round(performance.now() - t0),
      'ms'
    )
    return {
      type,
      subtype,
      caption,
      // 透传 content 并附带 subtype，使细分类型随 structured_data 一并持久化
      structured: {
        ...sanitizeStructured((parsed.content ?? {}) as StructuredFigureData),
        ...(subtype ? { subtype } : {})
      }
    }
  } catch (err) {
    console.warn('[VLM] 识别异常:', err, '耗时:', Math.round(performance.now() - t0), 'ms')
    return null
  }
}

/**
 * 拼接论文上下文提示块（注入 PROMPT 末尾）。
 * 仅输出存在且有内容的字段，避免无谓 token 消耗。
 */
function buildContextBlock(ctx?: FigureContext): string {
  if (!ctx) return ''
  const lines: string[] = []
  if (ctx.summary?.trim()) lines.push(`- 文献摘要（论文目的与整体内容）：${ctx.summary.trim()}`)
  if (ctx.caption?.trim()) lines.push(`- 图题（论文正文中的图注，优先级高于图中文字）：${ctx.caption.trim()}`)
  if (ctx.pageText?.trim()) lines.push(`- 所在页正文摘录（图片附近的论述，用于辅助判断图意）：\n${ctx.pageText.trim()}`)
  if (!lines.length) return ''
  return (
    '\n\n【论文上下文】\n以下是论文相关上下文，请据此准确理解这张图的内容、研究对象与目的；' +
    'caption/description/series 名称中可引用上下文中的化合物名与条件，但图题若有则以其为准。\n' +
    lines.join('\n')
  )
}

/** 论文摘要输入截断上限（字符） */
const SUMMARY_INPUT_LIMIT = 6000

/**
 * 生成论文整体摘要（供图片识别上下文使用），说明文献目的/研究对象/关键结果。
 * 使用 DeepSeek 文本模型；失败返回空串（不影响图片识别）。
 */
export async function summarizePaper(documentText: string): Promise<string> {
  if (!documentText?.trim()) return ''
  const t0 = performance.now()
  try {
    const input = documentText.slice(0, SUMMARY_INPUT_LIMIT)
    const res = await model.invoke([
      {
        role: 'system',
        content:
          '你是化学文献摘要专家。请阅读用户提供的论文文本，输出严格 JSON：{"summary": "..."}。' +
          'summary 用中文，200 字以内，概括：论文研究目的与创新点、研究对象/材料体系、主要研究方法与表征手段、关键结论。' +
          '该摘要会提供给图片识别模型，帮助它理解论文中图表的含义，因此请突出与图表相关的化合物、实验条件与关键结果。' +
          '只输出 JSON 对象，不要多余文字或 markdown 代码块标记。'
      },
      { role: 'human', content: `论文文本（可能不完整、含提取噪声，请忽略无关内容）：\n${input}` }
    ])
    const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
    const parsed = extractJson(raw)
    const summary =
      parsed && typeof parsed.summary === 'string' ? parsed.summary.trim() : (raw.trim().slice(0, 500) || '')
    console.log(
      '[VLM] 论文摘要生成:',
      JSON.stringify({ len: summary.length, head: summary.slice(0, 60) }),
      '耗时:',
      Math.round(performance.now() - t0),
      'ms'
    )
    return summary
  } catch (err) {
    console.warn('[VLM] 论文摘要生成失败:', err, '耗时:', Math.round(performance.now() - t0), 'ms')
    return ''
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

/** 剔除文本中的 HTML 标签并还原常见实体（模型偶发在表格/描述里输出 HTML） */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/** 将 HTML 表格字符串解析为二维数组（兼容模型输出 <table><tr><td> 的脏数据） */
function htmlTableToRows(html: string): unknown[][] | null {
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows: unknown[][] = []
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(html)) !== null) {
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    const cells: unknown[] = []
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]))
    }
    if (cells.length) rows.push(cells)
  }
  return rows.length ? rows : null
}

/** 将模型输出的 table 归一化为二维数组（兼容数组 / JSON 数组字符串 / HTML 表格字符串） */
function normalizeTable(table: unknown): unknown[][] | null {
  if (Array.isArray(table)) {
    const rows = table.filter((r): r is unknown[] => Array.isArray(r))
    return rows.length ? rows : null
  }
  if (typeof table === 'string') {
    const trimmed = table.trim()
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed)
        if (Array.isArray(arr)) return normalizeTable(arr)
      } catch {
        /* 继续尝试 HTML 解析 */
      }
    }
    return htmlTableToRows(trimmed)
  }
  return null
}

/** 入库前清洗结构化数据：表格归一化为二维数组并剔除 HTML，描述剔除 HTML */
function sanitizeStructured(content: StructuredFigureData): StructuredFigureData {
  const out: StructuredFigureData = { ...content }
  const rows = normalizeTable(out.table)
  if (rows) {
    out.table = rows.map((row) => row.map((cell) => stripHtml(String(cell ?? ''))))
  } else {
    delete out.table
  }
  if (typeof out.description === 'string') {
    out.description = stripHtml(out.description)
  }
  return out
}
