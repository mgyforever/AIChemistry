import { ipcMain } from 'electron'
import { initSQLite, closeSQLite } from './sqlite'
import { initLanceDB, createTable, addData, searchVectors, tableExists, deleteRows } from './lancedb'
import {
  ConversationDao,
  MessageDao,
  DocumentDao,
  ProjectDao,
  ProjectDocumentDao,
  ProjectChatDao,
  ReproductionDao,
  ExperimentDao,
  PaperDao,
  FigureDao,
  PredictionDao
} from './dao'
import type { ProjectContext, Project } from '../ai-server/type'

/**
 * 参数摘要：对象转 JSON 截断 120 字符，字符串截断 100 字符，敏感字段打码
 */
function summarizeArg(arg: unknown): string {
  if (arg === null || arg === undefined) return String(arg)
  if (typeof arg === 'string') {
    const s = arg.length > 100 ? arg.slice(0, 100) + '...' : arg
    return JSON.stringify(s)
  }
  if (typeof arg === 'object') {
    try {
      const s = JSON.stringify(arg, (_key, value) => {
        if (typeof value === 'string' && /token|secret|apikey|password|api_key/i.test(_key)) {
          return '[已隐藏]'
        }
        return value
      })
      return s.length > 120 ? s.slice(0, 120) + '...' : s
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

type HandleListener = Parameters<typeof ipcMain.handle>[1]

/**
 * 全局 IPC 调用日志包装：在 registerIpcHandlers 之前替换 ipcMain.handle
 * 会对后续注册的所有 IPC handler（db/ai/file）打印调用与耗时
 */
function wrapIpcHandleLogging(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((channel: string, listener: HandleListener) => {
    const wrapped: HandleListener = (event, ...args) => {
      const start = Date.now()
      try {
        console.log(`[IPC] 调用 ${channel}: ${args.map(summarizeArg).join(', ')}`)
        const result = listener(event, ...args)
        if (result instanceof Promise) {
          return result.then(
            (value) => {
              console.log(`[IPC] 完成 ${channel}: ${Date.now() - start}ms`)
              return value
            },
            (err) => {
              console.error(`[IPC] 失败 ${channel}:`, err)
              throw err
            }
          )
        }
        console.log(`[IPC] 完成 ${channel}: ${Date.now() - start}ms`)
        return result
      } catch (err) {
        console.error(`[IPC] 失败 ${channel}:`, err)
        throw err
      }
    }
    return originalHandle(channel, wrapped)
  }) as typeof ipcMain.handle
}

// 模块加载时即替换 ipcMain.handle，仅本文件内生效
wrapIpcHandleLogging()

export async function initDatabases(): Promise<void> {
  console.log('[DB] initDatabases 开始')
  initSQLite()
  await initLanceDB()
  registerIpcHandlers()
  console.log('[DB] initDatabases 完成, IPC 处理器注册完成')
}

function registerIpcHandlers(): void {
  // ========== Conversation DAO handlers ==========

  ipcMain.handle('db:conversation-list', (_event, token: string) => {
    return ConversationDao.findAll(token)
  })

  ipcMain.handle('db:conversation-get', (_event, id: number) => {
    return ConversationDao.findById(id)
  })

  ipcMain.handle('db:conversation-create', (_event, title: string, token: string) => {
    return ConversationDao.create(title, token)
  })

  ipcMain.handle('db:conversation-update', (_event, id: number, title: string) => {
    ConversationDao.update(id, title)
  })

  ipcMain.handle('db:conversation-delete', (_event, id: number) => {
    ConversationDao.delete(id)
  })

  // ========== Message DAO handlers ==========

  ipcMain.handle('db:message-list', (_event, conversationId: number) => {
    return MessageDao.findByConversationId(conversationId)
  })

  ipcMain.handle('db:message-get', (_event, id: number) => {
    return MessageDao.findById(id)
  })

  ipcMain.handle(
    'db:message-create',
    (_event, conversationId: number, role: 'user' | 'assistant' | 'system', content: string) => {
      return MessageDao.create(conversationId, role, content)
    }
  )

  ipcMain.handle('db:message-delete', (_event, id: number) => {
    MessageDao.delete(id)
  })

  // ========== Document DAO handlers ==========

  ipcMain.handle('db:document-list', () => {
    return DocumentDao.findAll()
  })

  ipcMain.handle('db:document-get', (_event, id: number) => {
    return DocumentDao.findById(id)
  })

  ipcMain.handle(
    'db:document-create',
    (_event, title: string, content: string, metadata?: string) => {
      return DocumentDao.create(title, content, metadata)
    }
  )

  ipcMain.handle(
    'db:document-update',
    (_event, id: number, title: string, content: string, metadata?: string) => {
      DocumentDao.update(id, title, content, metadata)
    }
  )

  ipcMain.handle('db:document-delete', (_event, id: number) => {
    DocumentDao.delete(id)
  })

  // ========== LanceDB handlers ==========

  ipcMain.handle(
    'db:lancedb-create-table',
    async (_event, name: string, data: Record<string, unknown>[]) => {
      await createTable(name, data)
    }
  )

  ipcMain.handle(
    'db:lancedb-add',
    async (_event, tableName: string, data: Record<string, unknown>[]) => {
      await addData(tableName, data)
    }
  )

  ipcMain.handle(
    'db:lancedb-search',
    async (_event, tableName: string, vector: number[], limit?: number) => {
      return await searchVectors(tableName, vector, limit)
    }
  )

  ipcMain.handle('db:lancedb-table-exists', async (_event, name: string) => {
    return await tableExists(name)
  })

  // ========== 实验复现 Agent（P2 新增） ==========

  // ---- 项目 ----
  ipcMain.handle('db:project-list', () => ProjectDao.findAll())
  ipcMain.handle('db:project-get', (_e, id: number) => ProjectDao.findById(id))
  ipcMain.handle('db:project-create', (_e, name: string, description?: string) =>
    ProjectDao.create(name, description ?? '')
  )
  ipcMain.handle('db:project-update', (_e, id: number, patch: Partial<Project>) => ProjectDao.update(id, patch))
  ipcMain.handle('db:project-delete', async (_e, id: number) => {
    ProjectDao.delete(id)
    // 同步清理该项目在 LanceDB 中的向量摘要
    await deleteRows('project_summaries', `project_id = ${id}`)
  })
  ipcMain.handle('db:project-document-create', (_e, projectId: number, documentId: number, role?: string) =>
    ProjectDocumentDao.create(projectId, documentId, role)
  )
  ipcMain.handle('db:project-context', (_e, id: number): ProjectContext => {
    const project = ProjectDao.findById(id)
    if (!project) throw new Error(`项目不存在: ${id}`)
    return {
      project,
      documents: ProjectDocumentDao.findByProject(id),
      materials: ReproductionDao.materials(id),
      steps: ReproductionDao.steps(id),
      instruments: ReproductionDao.instruments(id),
      concerns: ReproductionDao.concerns(id),
      reactions: ReproductionDao.reactions(id),
      characterizations: ReproductionDao.characterizations(id),
      gaps: ReproductionDao.gaps(id),
      assessment: ReproductionDao.assessment(id) ?? null,
      phases: ExperimentDao.phases(id),
      records: ExperimentDao.records(id),
      customData: ExperimentDao.customData(id),
      predictions: PredictionDao.findByProject(id),
      papers: PaperDao.findByProject(id),
      summaries: []
    }
  })

  // ---- 项目 AI 陪伴对话（持久化，中断后可恢复） ----
  ipcMain.handle('db:project-chat-list', (_e, projectId: number) => ProjectChatDao.findByProject(projectId))
  ipcMain.handle(
    'db:project-chat-create',
    (_e, projectId: number, role: 'user' | 'assistant', content: string, chartsJson?: string) =>
      ProjectChatDao.create(projectId, role, content, chartsJson ?? '[]')
  )
  ipcMain.handle('db:project-chat-clear', (_e, projectId: number) => ProjectChatDao.deleteByProject(projectId))

  // ---- 复现方案 ----
  ipcMain.handle('db:reproduction-get', (_e, projectId: number) => ({
    materials: ReproductionDao.materials(projectId),
    steps: ReproductionDao.steps(projectId),
    instruments: ReproductionDao.instruments(projectId),
    concerns: ReproductionDao.concerns(projectId),
    reactions: ReproductionDao.reactions(projectId),
    characterizations: ReproductionDao.characterizations(projectId),
    gaps: ReproductionDao.gaps(projectId),
    assessment: ReproductionDao.assessment(projectId) ?? null
  }))
  ipcMain.handle(
    'db:reproduction-save',
    (
      _e,
      projectId: number,
      data: {
        materials?: Array<{ name: string; formula?: string; cas?: string; quantity?: string; purity?: string; purpose?: string; notes?: string }>
        reactions?: Array<{ equation: string; type?: string; purpose?: string; notes?: string }>
        steps?: Array<{ step_no: number; title?: string; description: string; conditions?: string | Record<string, string>; duration?: string; notes?: string }>
        instruments?: Array<{ name: string; specification?: string; purpose?: string; notes?: string }>
        characterizations?: Array<{ target?: string; method: string; conditions?: string; expected?: string; notes?: string }>
        concerns?: Array<{ category?: 'safety' | 'operation' | 'waste' | 'other'; content: string; risk_level?: string; solution?: string }>
        gaps?: Array<{ category?: string; content: string; impact?: string; assumption?: string }>
        assessment?: { difficulty_score: number; feasibility: string; analysis: string; risk_points: string }
      }
    ) => {
      ReproductionDao.clearMaterials(projectId)
      ReproductionDao.clearSteps(projectId)
      ReproductionDao.clearInstruments(projectId)
      ReproductionDao.clearConcerns(projectId)
      ReproductionDao.clearReactions(projectId)
      ReproductionDao.clearCharacterizations(projectId)
      ReproductionDao.clearGaps(projectId)
      data.materials?.forEach((m) => ReproductionDao.addMaterial(projectId, m))
      data.reactions?.forEach((r) => ReproductionDao.addReaction(projectId, r))
      data.steps?.forEach((s) => ReproductionDao.addStep(projectId, s))
      data.instruments?.forEach((i) => ReproductionDao.addInstrument(projectId, i))
      data.characterizations?.forEach((c) => ReproductionDao.addCharacterization(projectId, c))
      data.concerns?.forEach((c) => ReproductionDao.addConcern(projectId, c))
      data.gaps?.forEach((g) => ReproductionDao.addGap(projectId, g))
      if (data.assessment) ReproductionDao.upsertAssessment(projectId, data.assessment)
    }
  )

  // ---- 阶段与记录 ----
  ipcMain.handle('db:experiment-phases', (_e, projectId: number) => ExperimentDao.phases(projectId))
  ipcMain.handle('db:experiment-phase-add', (_e, projectId: number, name: string, expected?: string, order?: number) =>
    ExperimentDao.addPhase(projectId, name, expected ?? '', order)
  )
  ipcMain.handle(
    'db:experiment-phase-update',
    (
      _e,
      id: number,
      patch: { name?: string; status?: 'pending' | 'in_progress' | 'completed'; expected?: string }
    ) => ExperimentDao.updatePhase(id, patch)
  )
  ipcMain.handle('db:experiment-phase-delete', (_e, id: number) => ExperimentDao.deletePhase(id))
  ipcMain.handle('db:experiment-records', (_e, projectId: number) => ExperimentDao.records(projectId))
  ipcMain.handle(
    'db:experiment-record-add',
    (
      _e,
      projectId: number,
      data: {
        phase_id?: number | null
        record_type?: 'phase' | 'phenomenon'
        name: string
        content: string
        data_json?: string
        expected?: string
        compliance_percent?: number | null
        is_expected?: number | null
        cause_analysis?: string
        detail?: string
      }
    ) => ExperimentDao.addRecord(projectId, data)
  )
  ipcMain.handle('db:experiment-record-delete', (_e, id: number) => ExperimentDao.deleteRecord(id))
  ipcMain.handle('db:experiment-custom-data', (_e, projectId: number) => ExperimentDao.customData(projectId))
  ipcMain.handle(
    'db:experiment-custom-add',
    (
      _e,
      projectId: number,
      data: {
        record_id?: number | null
        data_name: string
        data_type: string
        data_value: string
        unit?: string
        extra?: string
      }
    ) => ExperimentDao.addCustomData(projectId, data)
  )
  ipcMain.handle('db:experiment-custom-delete', (_e, id: number) => ExperimentDao.deleteCustomData(id))

  // ---- 论文 ----
  ipcMain.handle('db:paper-list', (_e, projectId: number) => PaperDao.findByProject(projectId))
  ipcMain.handle('db:paper-create', (_e, projectId: number, title: string, content: string, charts?: string) =>
    PaperDao.create(projectId, title, content, charts ?? '[]')
  )
  ipcMain.handle('db:paper-delete', (_e, id: number) => PaperDao.delete(id))

  // ---- 图表 ----
  ipcMain.handle('db:figure-list-by-doc', (_e, documentId: number) => FigureDao.findByDocument(documentId))
  ipcMain.handle('db:figure-list-by-project', (_e, projectId: number) => FigureDao.findByProject(projectId))
  ipcMain.handle(
    'db:figure-create',
    (
      _e,
      data: {
        document_id: number
        project_id?: number | null
        figure_index?: number
        page_number?: number
        figure_type?: string
        caption?: string
        structured_data?: string
        ocr_text?: string
        image_path?: string
        status?: string
      }
    ) => FigureDao.create(data)
  )
  ipcMain.handle(
    'db:figure-update',
    (
      _e,
      id: number,
      patch: {
        project_id?: number | null
        figure_type?: string
        caption?: string
        structured_data?: string
        ocr_text?: string
        image_path?: string
        status?: string
      }
    ) => FigureDao.update(id, patch as never)
  )
  ipcMain.handle('db:figure-delete', (_e, id: number) => FigureDao.delete(id))

  // ---- 预测实验 ----
  ipcMain.handle('db:prediction-list', (_e, projectId: number) => PredictionDao.findByProject(projectId))
  ipcMain.handle(
    'db:prediction-create',
    (
      _e,
      data: {
        project_id: number
        name: string
        base_flow: string
        variables: string
        predicted_result: string
        property_analysis: string
        theory_basis: string
      }
    ) => PredictionDao.create(data)
  )
  ipcMain.handle('db:prediction-delete', (_e, id: number) => PredictionDao.delete(id))
}

export function closeDatabases(): void {
  closeSQLite()
}
