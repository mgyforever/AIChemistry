import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

/**
 * 步骤详情窗口（v3 修改计划问题③：新建独立 Electron 窗口）
 *
 * - 用户点击步骤 → 打开独立 BrowserWindow（步骤详情窗口）；
 * - 同一项目复用同一个窗口：再点其它步骤 → 窗口 focus + 推送 step-detail:add-tab 事件新增标签；
 * - 标签去重由渲染进程（StepDetailPage）保证（以 step_id 为键，不重复添加）；
 * - 初始步骤通过 window:step-detail-claim 从主进程领取（避免 did-finish-load 早于渲染监听的问题）。
 */

const winMap = new Map<number, BrowserWindow>()
/** 窗口 WebContents id → 初始 { projectId, stepId }（渲染进程 claim 后清除） */
const pendingInit = new Map<number, { projectId: number; stepId: number }>()

function send(win: BrowserWindow, channel: string, payload: unknown): void {
  if (!win.isDestroyed()) win.webContents.send(channel, payload)
}

/** 打开（或复用）某项目的步骤详情窗口 */
export function openStepDetailWindow(projectId: number, stepId: number): void {
  const existing = winMap.get(projectId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    send(existing, 'step-detail:add-tab', { projectId, stepId })
    return
  }

  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: '步骤详情',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  winMap.set(projectId, win)
  win.on('closed', () => {
    winMap.delete(projectId)
  })
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 记录初始步骤，渲染进程挂载后 claim
  pendingInit.set(win.webContents.id, { projectId, stepId })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/step-detail`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/step-detail' })
  }
  console.log('[Window] 步骤详情窗口创建, projectId:', projectId, ', stepId:', stepId)
}

/** 注册步骤详情窗口相关 IPC */
export function registerStepDetailHandlers(): void {
  ipcMain.handle('window:open-step-detail', (_e, projectId: number, stepId: number) => {
    console.log('[Window] window:open-step-detail:', { projectId, stepId })
    openStepDetailWindow(projectId, stepId)
  })
  // 渲染进程挂载后领取初始步骤数据
  ipcMain.handle('window:step-detail-claim', (e) => {
    const init = pendingInit.get(e.sender.id)
    pendingInit.delete(e.sender.id)
    return init ?? null
  })
}
