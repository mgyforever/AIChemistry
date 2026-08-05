import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { FigureDao } from '../database/dao/figure.dao'
import { recognizeFigure, isVlmConfigured } from './vlm'
import { ocrImage } from './ocr'
import type { StructuredFigureData } from '../ai-server/type'

/**
 * 文献图表解析调度（P4）
 *
 * 对 pdf 提取的图片/表格：
 * 1. pdf-parse 识别出的简单表格 → 直接入库（type=table, parsed）
 * 2. 内嵌图片 → Kimi-K2.6 识别（结构化 JSON），原图落盘 papers_figs 存 image_path
 * 3. VLM 不可用/失败 → tesseract.js OCR 兜底 + 标记 manual 待人工确认（原图同样落盘）
 */

/** 文献原图缓存目录（papers_figs，与 papers_md 同规则） */
function figuresDir(): string {
  return app.isPackaged
    ? join(app.getPath('userData'), 'papers_figs')
    : join(process.cwd(), 'src/main/database/data/papers_figs')
}

/** 将图片 data URL 落盘到 papers_figs，返回本地路径（失败返回 null） */
function saveFigureImage(documentId: number, index: number, dataUrl: string): string | null {
  try {
    const m = /^data:(image\/(?:png|jpeg|jpg|gif|webp|bmp));base64,([\s\S]+)$/.exec(dataUrl)
    if (!m) return null
    const ext = m[1] === 'image/jpeg' || m[1] === 'image/jpg' ? 'jpg' : m[1].split('/')[1]
    const dir = figuresDir()
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, `${documentId}-${index + 1}.${ext}`)
    writeFileSync(filePath, Buffer.from(m[2], 'base64'))
    console.log('[Figures] 原图已保存:', filePath)
    return filePath
  } catch (err) {
    console.error('[Figures] 原图落盘失败:', err)
    return null
  }
}

export async function parseDocumentFigures(
  documentId: number,
  images: string[],
  tables: unknown[][][]
): Promise<number> {
  console.log('[Figures] 开始解析图表，docId:', documentId, '图片数:', images.length, '表格数:', tables.length)
  let count = 0

  // 表格直接入库（文本层已可重建的表格）
  for (const table of tables) {
    FigureDao.create({
      document_id: documentId,
      figure_type: 'table',
      structured_data: JSON.stringify({ table } satisfies StructuredFigureData),
      status: 'parsed'
    })
    count++
  }

  // 图片：原图落盘 + VLM 识别 / OCR 兜底
  const vlmReady = isVlmConfigured()
  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i]
    const imagePath = saveFigureImage(documentId, i, dataUrl) ?? ''
    let recognized = vlmReady ? await recognizeFigure(dataUrl) : null

    if (recognized) {
      console.log('[Figures] 图片走 VLM 识别成功，docId:', documentId, '图片序号:', i + 1)
      FigureDao.create({
        document_id: documentId,
        figure_index: i + 1,
        figure_type: recognized.type,
        caption: recognized.caption,
        structured_data: JSON.stringify(recognized.structured),
        image_path: imagePath,
        status: 'parsed'
      })
    } else {
      console.log('[Figures] 图片走 OCR 兜底，docId:', documentId, '图片序号:', i + 1)
      const ocrText = await ocrImage(dataUrl)
      FigureDao.create({
        document_id: documentId,
        figure_index: i + 1,
        figure_type: '',
        ocr_text: ocrText,
        image_path: imagePath,
        status: 'manual'
      })
    }
    count++
  }

  console.log('[Figures] 图表解析完成，docId:', documentId, '入库总数:', count)
  return count
}
