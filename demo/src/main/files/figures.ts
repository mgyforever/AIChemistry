import { FigureDao } from '../database/dao/figure.dao'
import { recognizeFigure, isVlmConfigured } from './vlm'
import { ocrImage } from './ocr'
import type { StructuredFigureData } from '../ai-server/type'

/**
 * 文献图表解析调度（P4）
 *
 * 对 pdf 提取的图片/表格：
 * 1. pdf-parse 识别出的简单表格 → 直接入库（type=table, parsed）
 * 2. 内嵌图片 → DeepSeek-VL2 识别（结构化 JSON）
 * 3. VLM 不可用/失败 → tesseract.js OCR 兜底 + 标记 manual 待人工确认
 */
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

  // 图片：VLM 识别 / OCR 兜底
  const vlmReady = isVlmConfigured()
  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i]
    let recognized = vlmReady ? await recognizeFigure(dataUrl) : null

    if (recognized) {
      console.log('[Figures] 图片走 VLM 识别成功，docId:', documentId, '图片序号:', i + 1)
      FigureDao.create({
        document_id: documentId,
        figure_index: i + 1,
        figure_type: recognized.type,
        caption: recognized.caption,
        structured_data: JSON.stringify(recognized.structured),
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
        status: 'manual'
      })
    }
    count++
  }

  console.log('[Figures] 图表解析完成，docId:', documentId, '入库总数:', count)
  return count
}
