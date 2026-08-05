import { readFileSync, existsSync } from 'fs'
import { basename, extname } from 'path'
import { PDFParse } from 'pdf-parse'

/**
 * 文件读取模块（P3）
 * 支持 txt / md / pdf 文本提取；pdf 额外提取内嵌图片（供图表识别）
 */

export interface ExtractedDocument {
  /** 文件名（不含扩展名） */
  title: string
  /** 提取的正文文本 */
  content: string
  /** PDF 内嵌图片（base64 dataURL 列表，非 PDF 为空） */
  images: string[]
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

/**
 * 提取 PDF 文本与内嵌图片（pdf-parse v2）
 */
async function extractPdf(buffer: Buffer): Promise<{ text: string; images: string[]; tables: unknown[][][] }> {
  const parser = new PDFParse({ data: buffer })
  try {
    const [textRes, imageRes, tableRes] = await Promise.allSettled([
      parser.getText(),
      parser.getImage({ imageDataUrl: true, imageBuffer: false, imageThreshold: 60 }),
      parser.getTable()
    ])

    const rawText = textRes.status === 'fulfilled' ? textRes.value.text : ''
    const text = normalizePdfText(rawText)
    const images: string[] = []
    if (imageRes.status === 'fulfilled') {
      for (const page of imageRes.value.pages ?? []) {
        for (const img of page.images ?? []) {
          if (img.dataUrl) images.push(img.dataUrl)
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
