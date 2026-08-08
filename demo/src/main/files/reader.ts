import { readFileSync, existsSync } from 'fs'
import { basename, extname } from 'path'
import { PDFParse } from 'pdf-parse'
import type { FigureSource } from '../ai-server/type'

/**
 * 文件读取模块（P3）
 * 支持 txt / md / pdf 文本提取；pdf 额外提取内嵌图片（供图表识别）
 */

export interface ExtractedDocument {
  /** 文件名（不含扩展名） */
  title: string
  /** 提取的正文文本 */
  content: string
  /** PDF 内嵌图片（含页码/图题/所在页上下文，非 PDF 为空） */
  images: FigureSource[]
  /** PDF 简单表格（二维数组，非 PDF 为空） */
  tables: unknown[][][]
}

/**
 * 中文 PDF 文本规范化：
 * 1. 移除 pdf.js 提取时在字符间插入的制表符/零宽定位符
 * 2. 全角拉丁/数字/标点（U+FF01~U+FF5E）→ 半角
 * 3. 常见私有区（PUA）字符映射（本 PDF 系：E010=小数点、E011=连字符），其余 PUA 移除
 * 4. 合并连续空白
 */
function normalizePdfText(raw: string): string {
  let out = ''
  for (const ch of raw) {
    const cp = ch.codePointAt(0) as number
    // 制表符/零宽字符 → 删除（pdf.js 的字符间距定位符）
    if (ch === '\t' || ch === '\u200b' || ch === '\u2009' || cp === 0xfeff) continue
    // 全角 → 半角
    if (cp >= 0xff01 && cp <= 0xff5e) {
      out += String.fromCodePoint(cp - 0xfee0)
      continue
    }
    // 私有区映射
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      if (cp === 0xe010) out += '.'
      else if (cp === 0xe011) out += '-'
      else continue // 其余 PUA 字符无法可靠识别，删除
      continue
    }
    out += ch
  }
  // 合并连续空白（保留单个空格与换行）
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** 图题识别正则（"Figure N. ..." / "Fig. N: ..." / "Scheme/Table N. ..."，跨行截断） */
const CAPTION_RE = /(?:Figure|Fig\.?|Scheme|Table)\s*S?\d+[\.:、][^\n]{3,220}/gi

/** 单页正文摘录上限（字符），供 VLM 上下文使用 */
const PAGE_CONTEXT_LIMIT = 4000

/** 从单页正文中提取图题（最多 3 条） */
function extractCaptions(text: string): string[] {
  if (!text) return []
  const out: string[] = []
  const re = new RegExp(CAPTION_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const cap = m[0].replace(/\s+/g, ' ').trim()
    if (cap.length > 3 && !out.includes(cap)) out.push(cap)
    if (out.length >= 3) break
  }
  return out
}

/**
 * 构建某页图片的上下文：页码 + 邻近页正文摘录 + 图题。
 * 图题通常位于图片下方（本页或下一页），其次可能是上一页底部。
 */
function buildFigureContext(pn: number, pageTexts: Map<number, string>): Pick<FigureSource, 'pageText' | 'caption'> {
  const pages: string[] = []
  for (const n of [pn - 1, pn, pn + 1]) {
    const t = pageTexts.get(n)?.trim()
    if (t) pages.push(t)
  }
  const captions = extractCaptions(pageTexts.get(pn) ?? '')
  if (!captions.length) captions.push(...extractCaptions(pageTexts.get(pn + 1) ?? ''))
  if (!captions.length) captions.push(...extractCaptions(pageTexts.get(pn - 1) ?? ''))
  return {
    pageText: pages.join('\n').slice(0, PAGE_CONTEXT_LIMIT) || undefined,
    caption: captions.slice(0, 2).join('\n') || undefined
  }
}

/**
 * 提取 PDF 文本与内嵌图片（pdf-parse v2）。
 * 图片附带页码/图题/所在页上下文，供 VLM 结合论文精确识别。
 */
async function extractPdf(buffer: Buffer): Promise<{ text: string; images: FigureSource[]; tables: unknown[][][] }> {
  const parser = new PDFParse({ data: buffer })
  try {
    const [textRes, imageRes, tableRes] = await Promise.allSettled([
      parser.getText(),
      parser.getImage({ imageDataUrl: true, imageBuffer: false, imageThreshold: 60 }),
      parser.getTable()
    ])

    const rawText = textRes.status === 'fulfilled' ? textRes.value.text : ''
    const text = normalizePdfText(rawText)
    // 分页文本（key = 页码），用于图片上下文
    const pageTexts = new Map<number, string>()
    if (textRes.status === 'fulfilled') {
      for (const page of textRes.value.pages ?? []) {
        pageTexts.set(page.num, normalizePdfText(page.text ?? ''))
      }
    }
    const images: FigureSource[] = []
    if (imageRes.status === 'fulfilled') {
      for (const page of imageRes.value.pages ?? []) {
        for (const img of page.images ?? []) {
          if (!img.dataUrl) continue
          const { pageText, caption } = buildFigureContext(page.pageNumber, pageTexts)
          images.push({
            dataUrl: img.dataUrl,
            pageNumber: page.pageNumber,
            caption,
            pageText
          })
        }
      }
    }
    const tables: unknown[][][] = []
    if (tableRes.status === 'fulfilled') {
      tables.push(...(tableRes.value.mergedTables ?? []))
    }
    return { text, images, tables }
  } finally {
    try {
      await parser.destroy()
    } catch {
      /* 忽略销毁异常 */
    }
  }
}

/**
 * 读取并解析单个文件，返回文本 + 图片 + 表格
 */
export async function readDocument(filePath: string): Promise<ExtractedDocument> {
  console.log('[Reader] 开始读取文件:', filePath)
  if (!existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`)

  const title = basename(filePath).replace(/\.[^.]+$/, '')
  const ext = extname(filePath).toLowerCase()
  console.log('[Reader] 文件扩展名:', ext)

  if (ext === '.pdf') {
    const buffer = readFileSync(filePath)
    try {
      const { text, images, tables } = await extractPdf(buffer)
      console.log(
        '[Reader] 读取完成:',
        JSON.stringify({ title, textLength: text.length, imageCount: images.length, tableCount: tables.length })
      )
      return { title, content: text, images, tables }
    } catch (err) {
      console.error('[Reader] PDF 提取失败:', filePath, err)
      throw err
    }
  }

  if (ext === '.txt' || ext === '.md' || ext === '.markdown') {
    const content = readFileSync(filePath, 'utf-8')
    console.log('[Reader] 读取完成:', JSON.stringify({ title, textLength: content.length, imageCount: 0, tableCount: 0 }))
    return { title, content, images: [], tables: [] }
  }

  console.warn('[Reader] 暂不支持的文件格式:', ext, '文件路径:', filePath)
  throw new Error(`暂不支持的文件格式: ${ext}（支持 pdf / txt / md）`)
}
