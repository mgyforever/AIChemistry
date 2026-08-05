import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readDocument } from './reader'
import { parseDocumentFigures } from './figures'
import { DocumentDao } from '../database/dao/document.dao'
import type { DocumentImportResult } from '../ai-server/type'

/**
 * 文件导入 IPC（P3/P4）
 * - file:open        文件选择对话框
 * - file:import      读取文件 → documents 入库 → 图表解析入库
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
    for (const p of paths) {
      try {
        const doc = await readDocument(p)
        const { id } = DocumentDao.create(
          doc.title,
          doc.content,
          JSON.stringify({ sourcePath: p, figures: doc.images.length, tables: doc.tables.length })
        )
        const figureCount = await parseDocumentFigures(id, doc.images, doc.tables)
        results.push({
          documentId: id,
          title: doc.title,
          contentLength: doc.content.length,
          figureCount
        })
        console.log(
          '[Files] 文件导入成功:',
          JSON.stringify({ docId: id, title: doc.title, contentLength: doc.content.length, figureCount })
        )
      } catch (err) {
        console.error('[Files] 导入失败:', p, err)
      }
    }
    console.log('[Files] 全部导入完成，成功:', results.length, '/', paths.length)
    return results
  })
}
