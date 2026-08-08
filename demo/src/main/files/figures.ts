import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { app } from 'electron'
import { FigureDao } from '../database/dao/figure.dao'
import { notifyDocumentImportProgress } from '../ai-server/experiment/events'
import { recognizeFigure, isVlmConfigured, summarizePaper } from './vlm'
import type { FigureRecognition } from './vlm'
import { ocrImage } from './ocr'
import type { FigureSource, StructuredFigureData } from '../ai-server/type'

/**
 * 文献图表解析调度（P4）
 *
 * 对 pdf 提取的图片/表格：
 * 1. pdf-parse 识别出的简单表格 → 直接入库（type=table, parsed）
 * 2. 内嵌图片 → Kimi-K2.6 识别（结构化 JSON），原图落盘 papers_figs 存 image_path；
 *    识别时注入论文上下文（整篇摘要 + 图题 + 所在页正文），帮助模型结合全文精确理解图片
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

/** VLM 图片识别并发上限（避免触发上游限流；OCR 兜底因共享 worker 保持串行） */
const VLM_CONCURRENCY = 4

/**
 * 并发映射（限流）：保持结果顺序与输入一致。
 * 用于多张图片并发调用 VLM，显著缩短图表解析总耗时。
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        results[i] = await fn(items[i], i)
      }
    })
  )
  return results
}

export async function parseDocumentFigures(
  documentId: number,
  sources: FigureSource[],
  tables: unknown[][][],
  documentText?: string
): Promise<number> {
  const t0 = performance.now()
  console.log(
    '[Figures] 开始解析图表，docId:',
    documentId,
    '图片数:',
    sources.length,
    '表格数:',
    tables.length,
    '文本长度:',
    documentText?.length ?? 0
  )
  // 表格直接入库（文本层已可重建的表格）
  const tTables = performance.now()
  for (const table of tables) {
    FigureDao.create({
      document_id: documentId,
      figure_type: 'table',
      structured_data: JSON.stringify({ table } satisfies StructuredFigureData),
      status: 'parsed'
    })
  }
  const tablesMs = performance.now() - tTables

  // 图片：原图落盘 + 并发 VLM 识别 / OCR 兜底
  const vlmReady = isVlmConfigured()
  // 论文整体摘要：整篇一次性生成，供所有图片识别复用（失败为空，不影响识别）
  const tSummary = performance.now()
  notifyDocumentImportProgress({ stage: 'summarizing', detail: '正在通读全文并生成论文摘要…' })
  const summary = vlmReady && documentText?.trim() ? await summarizePaper(documentText) : ''
  const summaryMs = performance.now() - tSummary

  // 阶段 1：并发调用 VLM 识别全部图片（保持源顺序，原图先落盘）
  const tVlm = performance.now()
  notifyDocumentImportProgress({
    stage: 'recognizing',
    imageTotal: sources.length,
    detail: `开始识别 ${sources.length} 张图片…`
  })
  const perImage: Array<{ src: FigureSource; imagePath: string; recognized: FigureRecognition | null }> =
    await mapWithConcurrency(sources, VLM_CONCURRENCY, async (src, i) => {
      const imagePath = saveFigureImage(documentId, i, src.dataUrl) ?? ''
      const recognized = vlmReady
        ? await recognizeFigure(src.dataUrl, {
            summary,
            caption: src.caption,
            pageText: src.pageText
          })
        : null
      if (vlmReady) {
        // 逐张完成回调（并发完成顺序不定，仅作进度展示）
        notifyDocumentImportProgress({
          stage: recognized ? 'recognizing' : 'ocr',
          imageIndex: i,
          imageTotal: sources.length
        })
      }
      return { src, imagePath, recognized }
    })
  const vlmMs = performance.now() - tVlm
  const vlmCount = perImage.filter((r) => r.recognized).length

  // 阶段 2：VLM 成功者入库
  let count = tables.length
  for (let i = 0; i < perImage.length; i++) {
    const { src, imagePath, recognized } = perImage[i]
    if (!recognized) continue
    count++
    console.log(
      '[Figures] 图片走 VLM 识别成功，docId:',
      documentId,
      '图片序号:',
      i + 1,
      '页码:',
      src.pageNumber ?? '-'
    )
    FigureDao.create({
      document_id: documentId,
      figure_index: i + 1,
      page_number: src.pageNumber,
      figure_type: recognized.type,
      caption: recognized.caption,
      structured_data: JSON.stringify(recognized.structured),
      image_path: imagePath,
      status: 'parsed'
    })
  }

  // 阶段 3：VLM 失败/未配置 → OCR 兜底（串行，共享 tesseract worker）
  let ocrMs = 0
  let ocrCount = 0
  const ocrTargets = perImage.filter((r) => !r.recognized)
  if (ocrTargets.length) {
    notifyDocumentImportProgress({
      stage: 'ocr',
      imageTotal: ocrTargets.length,
      detail: `VLM 未识别 ${ocrTargets.length} 张，转入 OCR 文字识别…`
    })
  }
  for (let i = 0; i < perImage.length; i++) {
    const { src, imagePath, recognized } = perImage[i]
    if (recognized) continue
    notifyDocumentImportProgress({ stage: 'ocr', imageIndex: i, imageTotal: ocrTargets.length })
    const tOcr = performance.now()
    const ocrText = await ocrImage(src.dataUrl)
    ocrMs += performance.now() - tOcr
    ocrCount++
    count++
    console.log('[Figures] 图片走 OCR 兜底，docId:', documentId, '图片序号:', i + 1)
    FigureDao.create({
      document_id: documentId,
      figure_index: i + 1,
      page_number: src.pageNumber,
      figure_type: '',
      ocr_text: ocrText,
      image_path: imagePath,
      status: 'manual'
    })
  }

  const totalMs = performance.now() - t0
  const otherMs = Math.max(0, totalMs - tablesMs - summaryMs - vlmMs - ocrMs)
  const pct = (ms: number): string => `${Math.round(ms)}ms (${(totalMs > 0 ? (ms / totalMs) * 100 : 0).toFixed(1)}%)`
  console.log('[Figures] 图表解析完成，docId:', documentId, '入库总数:', count, '总耗时:', Math.round(totalMs), 'ms')
  console.log(
    '[Figures] 耗时占比: 表格入库 ' +
      pct(tablesMs) +
      '，论文摘要生成 ' +
      pct(summaryMs) +
      '，VLM 图片识别(并发' +
      VLM_CONCURRENCY +
      ', x' +
      vlmCount +
      ') ' +
      pct(vlmMs) +
      '，OCR 兜底 x' +
      ocrCount +
      ' ' +
      pct(ocrMs) +
      '，其他(落盘/入库) ' +
      pct(otherMs)
  )
  return count
}
