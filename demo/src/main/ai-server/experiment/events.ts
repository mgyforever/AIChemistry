import { BrowserWindow } from 'electron'
import type {
  ExperimentEventName,
  ExperimentStateKind,
  DocumentImportProgress
} from '../type'

/**
 * 主进程 → 渲染进程事件广播（v0.10，见实施计划 §10.4）
 *
 * 阶段/步骤/分支状态变更、后台延迟入库完成、共享请求、文献导入进度等由主进程
 * webContents.send 广播，渲染进程 stores/repro.ts / 视图组件监听后刷新（不依赖 Agent 对话流）。
 */

function broadcast(name: ExperimentEventName, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(name, payload)
    }
  }
}

/** 结构化状态变更（门禁/步骤/分支/项目/记录） */
export function notifyStateChange(
  projectId: number,
  kind: ExperimentStateKind,
  entityId?: number,
  extra?: Record<string, unknown>
): void {
  broadcast('experiment:state-changed', { projectId, kind, entityId, ...(extra ?? {}) })
}

/** 后台延迟入库完成（§7.11） */
export function notifyIndexDone(projectId: number, branchId?: number): void {
  broadcast('experiment:index-done', { projectId, kind: 'branch-status', entityId: branchId })
}

/** 收到共享请求（§7.10） */
export function notifyShareRequestReceived(targetProjectId: number, requestId: number): void {
  broadcast('experiment:share-request-received', {
    projectId: targetProjectId,
    kind: 'project-status',
    entityId: requestId
  })
}

/** 共享请求审批结果 */
export function notifyShareResolved(projectId: number, requestId: number, status: string): void {
  broadcast('experiment:share-resolved', {
    projectId,
    kind: 'project-status',
    entityId: requestId,
    status
  })
}

/** 文献导入/图表解析进度（前端等待动画按阶段切换） */
export function notifyDocumentImportProgress(payload: DocumentImportProgress): void {
  broadcast('document-import:progress', payload)
}
