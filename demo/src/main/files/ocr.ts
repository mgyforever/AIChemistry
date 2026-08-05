/**
 * OCR 兜底模块（P4）：tesseract.js 提取图内文字
 * VLM 不可用/失败时使用；OCR 失败返回空串
 */
import { createWorker } from 'tesseract.js'

let worker: Awaited<ReturnType<typeof createWorker>> | null = null

async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng')
  }
  return worker
}

export async function ocrImage(dataUrl: string): Promise<string> {
  try {
    console.log('[OCR] 开始识别图片，图片数据长度:', dataUrl.length)
    const w = await getWorker()
    const { data } = await w.recognize(dataUrl)
    const text = (data.text ?? '').trim()
    console.log('[OCR] 识别完成，文本长度:', text.length)
    return text
  } catch (err) {
    console.warn('[OCR] 识别失败:', err)
    return ''
  }
}
