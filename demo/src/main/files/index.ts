import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { performance } from 'perf_hooks'
import { readDocument } from './reader'
import { parseDocumentFigures } from './figures'
import {
  parsePdfWithMineru,
  importMediaToAppData,
  cleanupProjectMedia,
  saveMineruMd
} from './mineru'
import { DocumentDao } from '../database/dao/document.dao'
import { notifyDocumentImportProgress } from '../ai-server/experiment/events'
import { extname } from 'path'
import type { DocumentImportResult, FigureSource } from '../ai-server/type'

/**
 * 文件导入 IPC（P3/P4，v0.8：PDF 走 MinerU 精准解析）
 * - file:open          文献文件选择对话框
 * - file:import        读取文件 → MinerU（PDF）/ 本地直读（txt/md）→ documents 入库 → 图表解析
 * - file:pick-media    图片/视频选择对话框（阶段数据录入附件，v0.9）
 * - file:import-media  复制附件到应用数据目录（v0.10 D10 定案）并返回持久路径
 * - file:cleanup-media 清理某项目媒体目录（删除项目时调用）
 */
export function registerFileHandlers(): void {
  ipcMain.handle('file:open', async () => {
    const opts: Electron.OpenDialogOptions = {
      title: '选择文献文件（支持 PDF / TXT / MD）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '文献文件', extensions: ['pdf', 'txt', 'md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
    const win = BrowserWindow.getFocusedWindow()
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const filePaths = res.canceled ? [] : res.filePaths
    console.log('[Files] 文件选择完成，选中数量:', filePaths.length)
    return filePaths
  })

  ipcMain.handle('file:import', async (_e, paths: string[]): Promise<DocumentImportResult[]> => {
    console.log('[Files] 开始导入文件，数量:', paths.length, '路径:', paths)
    const results: DocumentImportResult[] = []
    const fileTotal = paths.length
    for (let fi = 0; fi < paths.length; fi++) {
      const p = paths[fi]
      const fileName = p.split(/[\\/]/).pop() ?? p
      const t0 = performance.now()
      try {
        // v0.8：PDF 优先走 MinerU 精准解析（配置 MINERU_API_KEY 时），失败自动降级本地
        let title = ''
        let content = ''
        let images: FigureSource[] = []
        let tables: unknown[][][] = []
        let parser = 'local'
        let mineru: Awaited<ReturnType<typeof parsePdfWithMineru>> = null
        notifyDocumentImportProgress({
          stage: 'parsing',
          fileIndex: fi + 1,
          fileTotal,
          fileName,
          detail: `正在解析 ${fileName}…`
        })
        if (extname(p).toLowerCase() === '.pdf') {
          mineru = await parsePdfWithMineru(p)
          if (mineru) {
            content = mineru.text
            tables = mineru.tables
            parser = 'mineru'
            // v3 问题⑦：MinerU 图片块（已从结果 zip 提取为 dataURL），连同自带图题紧接图表解析
            images = mineru.images.map((i) => ({ dataUrl: i.path, caption: i.caption }))
          }
        }
        if (parser !== 'mineru') {
          const doc = await readDocument(p)
          title = doc.title
          content = doc.content
          images = doc.images
          tables = doc.tables
        }
        const tParse = performance.now()
        notifyDocumentImportProgress({
          stage: 'saving',
          fileIndex: fi + 1,
          fileTotal,
          fileName,
          parser,
          detail: `正在保存 ${title || basenameNoExt(p)}…`
        })
        const { id } = DocumentDao.create(
          title || basenameNoExt(p),
          content,
          JSON.stringify({ sourcePath: p, parser, figures: images.length, tables: tables.length })
        )
        // v3 问题⑨：解析结果 markdown 落盘 papers_md（MinerU 用重建 md，本地兜底用提取文本），
        // 路径写入 metadata，方便调试
        let mdPath: string | undefined
        const mdContent = mineru && mineru.md ? mineru.md : content
        mdPath = saveMineruMd(id, title || basenameNoExt(p), mdContent) ?? undefined
        if (mdPath) {
          try {
            const meta = JSON.parse(
              DocumentDao.findById(id)?.metadata ?? '{}'
            ) as Record<string, unknown>
            DocumentDao.update(id, title || basenameNoExt(p), content, JSON.stringify({ ...meta, mdPath }))
          } catch {
            /* 忽略 metadata 更新失败 */
          }
        }
        const tDb = performance.now()
        // v0.8：图表解析（MinerU 与本地路径均执行；MinerU 表格结构化、图片 VLM/OCR，VLM 注入论文上下文）
        const figureCount = await parseDocumentFigures(id, images, tables, content)
        notifyDocumentImportProgress({
          stage: 'done',
          fileIndex: fi + 1,
          fileTotal,
          fileName,
          detail: `「${title || basenameNoExt(p)}」导入完成，识别图表 ${figureCount} 张`
        })
        const tFigure = performance.now()
        const totalMs = tFigure - t0
        const parseMs = tParse - t0 // 文本/图片/表格提取（MinerU 或本地 pdfjs）
        const dbMs = tDb - tParse // 入库 + markdown 落盘
        const figuresMs = tFigure - tDb // 图表解析（摘要 + VLM/OCR）
        const pct = (ms: number): string =>
          `${Math.round(ms)}ms (${(totalMs > 0 ? (ms / totalMs) * 100 : 0).toFixed(1)}%)`
        console.log(
          '[Files] 导入耗时占比: ' +
            `${parser}解析 ` +
            pct(parseMs) +
            '，入库+markdown落盘 ' +
            pct(dbMs) +
            '，图表解析 ' +
            pct(figuresMs) +
            '，总计 ' +
            Math.round(totalMs) +
            'ms'
        )
        results.push({
          documentId: id,
          title: title || basenameNoExt(p),
          contentLength: content.length,
          figureCount,
          parser,
          mdPath
        })
        console.log(
          '[Files] 文件导入成功:',
          JSON.stringify({ docId: id, title: title || basenameNoExt(p), contentLength: content.length, figureCount, parser, mdPath })
        )
      } catch (err) {
        console.error('[Files] 导入失败:', p, err)
      }
    }
    console.log('[Files] 全部导入完成，成功:', results.length, '/', paths.length)
    return results
  })

  // v0.9：附件（图片/视频）选择对话框
  ipcMain.handle('file:pick-media', async () => {
    const opts: Electron.OpenDialogOptions = {
      title: '选择图片/视频（实验记录/事件附件）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '图片/视频', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm'] }
      ]
    }
    const win = BrowserWindow.getFocusedWindow()
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? [] : res.filePaths
  })

  // v0.10（D10 已定）：附件复制到应用数据目录，返回持久路径
  ipcMain.handle('file:import-media', async (_e, projectId: number, sourcePaths: string[]) => {
    return importMediaToAppData(projectId, sourcePaths)
  })

  // v0.8/0.10：删除项目时清理媒体目录
  ipcMain.handle('file:cleanup-media', async (_e, projectId: number) => {
    cleanupProjectMedia(projectId)
  })

  // v0.9：用系统默认程序打开本地附件（图片/视频）
  ipcMain.handle('file:open-media', async (_e, filePath: string) => {
    try {
      if (!existsSync(filePath)) return `文件不存在: ${filePath}`
      const err = await shell.openPath(filePath)
      return err ? `打开失败: ${err}` : ''
    } catch (err) {
      console.error('[Files] 打开媒体失败:', filePath, err)
      return err instanceof Error ? err.message : String(err)
    }
  })

  // v0.9：读取本地图片转 data URL 供前端 <img> 预览（视频不转，仅展示文件名）
  ipcMain.handle('file:read-media', async (_e, filePath: string): Promise<string | null> => {
    try {
      if (!existsSync(filePath)) return null
      const ext = extname(filePath).toLowerCase().replace('.', '')
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp'
      }
      const mime = mimeMap[ext]
      if (!mime) return null
      const buf = readFileSync(filePath)
      // 限制单张预览大小（5MB），防止 IPC 传输过大
      if (buf.byteLength > 5 * 1024 * 1024) return null
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch (err) {
      console.error('[Files] 读取媒体失败:', filePath, err)
      return null
    }
  })
}

function basenameNoExt(p: string): string {
  const base = p.split(/[\\/]/).pop() ?? p
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}
