import { ipcMain } from 'electron'
import { initSQLite, closeSQLite } from './sqlite'
import { initLanceDB, createTable, addData, searchVectors, tableExists } from './lancedb'
import {
  ConversationDao,
  MessageDao,
  DocumentDao,
  ProjectDao,
  ProjectDocumentDao,
  ProjectLinkDao,
  ProjectLinkRequestDao,
  ProjectChatDao,
  ReproductionDao,
  ExperimentDao,
  PaperDao,
  FigureDao,
  PredictionDao
} from './dao'
import { cleanupProjectMedia, cleanupMineruMd } from '../files/mineru'
import { deleteProjectSummaries, indexBranchSummaries } from '../ai-server/experiment/summaries'
import { notifyStateChange } from '../ai-server/experiment/events'
import { generateStageSummary } from '../ai-server/experiment/pipeline'
import type { ProjectContext, Project, StepStatus, PhaseGateStatus } from '../ai-server/type'

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
    // v3 问题⑨：删除文档时清理 papers_md 落盘文件
    const doc = DocumentDao.findById(id)
    if (doc?.metadata) {
      try {
        const meta = JSON.parse(doc.metadata) as Record<string, unknown>
        if (typeof meta.mdPath === 'string') cleanupMineruMd(meta.mdPath)
      } catch {
        /* 忽略 metadata 解析失败 */
      }
    }
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
    // 同步清理该项目在 LanceDB 中的向量摘要 + 媒体目录（v0.10 D10）
    // LanceDB 写操作在 Windows 上可能偶发文件锁（拒绝访问），失败不阻塞项目删除
    try {
      await deleteProjectSummaries(id)
    } catch (err) {
      console.warn('[DB] 清理项目向量摘要失败（不影响项目删除）:', err)
    }
    cleanupProjectMedia(id)
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
      phaseVariables: ExperimentDao.allPhaseVariables(id),
      events: ExperimentDao.events(id),
      branches: ExperimentDao.branches(id),
      stepExperiments: ExperimentDao.stepExperiments(id),
      links: ProjectLinkDao.findByProject(id),
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
      patch: {
        name?: string
        status?: 'pending' | 'in_progress' | 'completed' | 'pending_review'
        expected?: string
        gate_status?: PhaseGateStatus
        summary?: string
        summary_created_at?: string
        can_parallel?: number
        branch_id?: number | null
      }
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
        step_id?: number | null
        branch_id?: number | null
        step_experiment_id?: number | null
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
        step_id?: number | null
        step_experiment_id?: number | null
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
        step_id?: number | null
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
        step_id?: number | null
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
        branch_id?: number | null
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

  // ==================== v0.7：步骤 DAG 与阶段门禁 ====================
  ipcMain.handle('db:step-update-status', (_e, id: number, status: StepStatus) => {
    ReproductionDao.updateStepStatus(id, status)
  })
  ipcMain.handle('db:step-ready-list', (_e, projectId: number, branchId: number | null) => {
    return ReproductionDao.readySteps(projectId, branchId)
  })
  ipcMain.handle('db:step-recompute', (_e, projectId: number, branchId: number | null) => {
    ReproductionDao.recomputeReady(projectId, branchId)
  })
  // ---- v3 问题④：步骤增删改 ----
  ipcMain.handle(
    'db:step-update',
    (
      _e,
      id: number,
      patch: {
        step_no?: number
        title?: string
        description?: string
        conditions?: Record<string, string> | string
        duration?: string
        notes?: string
        depends_on?: number[]
      }
    ) => ReproductionDao.updateStep(id, patch)
  )
  ipcMain.handle(
    'db:step-add',
    (
      _e,
      projectId: number,
      data: {
        step_no: number
        title?: string
        description: string
        conditions?: Record<string, string> | string
        duration?: string
        notes?: string
        depends_on?: number[]
        branch_id?: number | null
      }
    ) => ReproductionDao.insertStep(projectId, data)
  )
  ipcMain.handle('db:step-delete', (_e, id: number) => {
    ReproductionDao.deleteStep(id)
  })
  ipcMain.handle(
    'db:phase-generate-summary',
    (
      _e,
      id: number,
      patch: { summary: string; status: 'pending_review' }
    ) => ExperimentDao.updatePhase(id, patch)
  )
  // v0.7：用户点击"生成小结"按钮 → 主进程调用 LLM 生成阶段小结并写入（不经过 agent 对话流）
  ipcMain.handle(
    'db:phase-summary-ai',
    async (_e, projectId: number, phaseId: number): Promise<string> => {
      const phase = ExperimentDao.phaseById(phaseId)
      if (!phase || phase.project_id !== projectId) throw new Error(`阶段不存在: ${phaseId}`)
      const records = ExperimentDao
        .records(projectId, phase.branch_id)
        .filter((r) => r.phase_id === phaseId)
      const events = ExperimentDao
        .events(projectId, phaseId, phase.branch_id)
        .map((e) => `- 【${e.name}】${e.content}`)
        .join('\n')
      const context =
        `【阶段名称】${phase.name}\n【阶段预期】${phase.expected}\n` +
        `【本阶段记录】\n${records.map((r) => `- ${r.name}（符合度 ${r.compliance_percent ?? 'N/A'}%）: ${r.content}`).join('\n')}\n` +
        (events ? `【本阶段实验事件】\n${events}` : '')
      const summary = await generateStageSummary(context)
      const markdown =
        `## 阶段小结：${phase.name}\n\n` +
        `**结果汇总**: ${summary.results}\n\n` +
        `**符合预期**: ${summary.compliance}\n\n` +
        `**异常与偏差**: ${summary.anomalies}\n\n` +
        `**经验教训**: ${summary.lessons}\n\n` +
        `**下一步建议**: ${summary.next_advice}\n\n`
      ExperimentDao.updatePhase(phaseId, {
        summary: markdown,
        summary_created_at: new Date().toISOString(),
        status: 'pending_review'
      })
      notifyStateChange(projectId, 'phase-gate', phaseId)
      return markdown
    }
  )
  ipcMain.handle(
    'db:phase-confirm-gate',
    (_e, id: number, decision: 'pass' | 'back', gate_status: PhaseGateStatus, status?: string) => {
      const patch: Record<string, unknown> = { gate_status }
      if (status) patch.status = status
      ExperimentDao.updatePhase(id, patch as never)
      const phase = ExperimentDao.phaseById(id)
      if (!phase) return
      if (decision === 'pass') {
        // 放行后自动解锁下一阶段（同分支内 phase_order 更大的第一个 locked，§7.7）
        const nextPhase = ExperimentDao
          .phases(phase.project_id, phase.branch_id)
          .filter((p) => p.phase_order > phase.phase_order && p.gate_status === 'locked')
          .sort((a, b) => a.phase_order - b.phase_order)[0]
        if (nextPhase) {
          ExperimentDao.updatePhase(nextPhase.id, { gate_status: 'open', status: 'in_progress' })
          notifyStateChange(phase.project_id, 'phase-gate', nextPhase.id)
        }
      }
      notifyStateChange(phase.project_id, 'phase-gate', id)
    }
  )

  // ==================== v0.8：并行实验分叉 ====================
  ipcMain.handle('db:branch-list', (_e, projectId: number) => ExperimentDao.branches(projectId))
  ipcMain.handle(
    'db:branch-create',
    (
      _e,
      data: {
        project_id: number
        parent_branch_id?: number | null
        fork_phase_id: number
        name: string
        description?: string
        variable_overrides?: Record<string, unknown>
      }
    ) => ExperimentDao.createBranch(data)
  )
  ipcMain.handle('db:branch-finish', (_e, branchId: number | null, projectId?: number) => {
    // 标记完成 + 后台延迟压缩入库（v0.9 §7.11：不阻塞 UI）
    if (branchId !== null) ExperimentDao.finishBranch(branchId)
    const pid = branchId !== null ? (ExperimentDao.branchById(branchId)?.project_id ?? projectId) : projectId
    if (!pid) return
    const pendingRecords = ExperimentDao.pendingRecords(pid, branchId)
    const events = ExperimentDao.events(pid, null, branchId)
    void (async (): Promise<void> => {
      try {
        await indexBranchSummaries(
          pid,
          pendingRecords.map((r) => ({
            id: r.id,
            name: r.name,
            content: r.content,
            expected: r.expected,
            compliance_percent: r.compliance_percent,
            is_expected: r.is_expected,
            cause_analysis: r.cause_analysis,
            detail: r.detail,
            chart_data: r.chart_data
          })),
          events.map((e) => ({ name: e.name, content: e.content })),
          branchId
        )
        for (const r of pendingRecords) ExperimentDao.markRecordIndexed(r.id)
        if (branchId !== null) ExperimentDao.markBranchIndexed(branchId)
        notifyStateChange(pid, 'branch-status', branchId ?? undefined, { indexed: true })
      } catch (err) {
        console.error('[DB] db:branch-finish 后台索引失败（下次触发时重试）:', err)
      }
    })()
  })
  ipcMain.handle('db:branch-phases', (_e, branchId: number) => ExperimentDao.branchPhases(branchId))
  ipcMain.handle('db:branch-records', (_e, branchId: number) => ExperimentDao.branchRecords(branchId))

  // ==================== v0.9：阶段实验变量 / 实验事件 ====================
  ipcMain.handle('db:phase-variables', (_e, phaseId: number, branchId: number | null) =>
    ExperimentDao.phaseVariables(phaseId, branchId)
  )
  ipcMain.handle(
    'db:phase-variable-upsert',
    (_e, data: Record<string, unknown>) => ExperimentDao.upsertPhaseVariable(data as never)
  )
  ipcMain.handle('db:phase-variable-delete', (_e, id: number) => ExperimentDao.deletePhaseVariable(id))
  ipcMain.handle('db:event-list', (_e, projectId: number, phaseId: number | null, branchId: number | null) =>
    ExperimentDao.events(projectId, phaseId, branchId)
  )
  ipcMain.handle(
    'db:event-add',
    (
      _e,
      data: {
        project_id: number
        branch_id?: number | null
        phase_id?: number | null
        step_id?: number | null
        step_experiment_id?: number | null
        name: string
        content?: string
        media_paths?: string[]
      }
    ) => ExperimentDao.addEvent(data)
  )
  ipcMain.handle('db:event-delete', (_e, id: number) => ExperimentDao.deleteEvent(id))

  // ==================== v3：步骤级并行实验变体（问题⑥） ====================
  ipcMain.handle('db:step-experiment-list', (_e, projectId: number) => ExperimentDao.stepExperiments(projectId))
  ipcMain.handle('db:step-experiment-list-by-step', (_e, stepId: number) =>
    ExperimentDao.stepExperimentsByStep(stepId)
  )
  ipcMain.handle(
    'db:step-experiment-create',
    (
      _e,
      data: {
        project_id: number
        step_id: number
        branch_id?: number | null
        parent_experiment_id?: number | null
        name: string
        description?: string
        variable_overrides?: Record<string, unknown>
      }
    ) => ExperimentDao.createStepExperiment(data)
  )
  ipcMain.handle(
    'db:step-experiment-update',
    (
      _e,
      id: number,
      patch: {
        name?: string
        description?: string
        variable_overrides?: Record<string, unknown> | string
        status?: string
      }
    ) => ExperimentDao.updateStepExperiment(id, patch)
  )
  ipcMain.handle('db:step-experiment-delete', (_e, id: number) => {
    const se = ExperimentDao.stepExperimentById(id)
    ExperimentDao.deleteStepExperiment(id)
    if (se) notifyStateChange(se.project_id, 'branch-status', id, { stepExperimentDeleted: true })
  })

  // ==================== v0.9/v0.10：项目间共享 ====================
  ipcMain.handle('db:link-list', (_e, projectId: number) => ProjectLinkDao.findByProject(projectId))
  ipcMain.handle('db:link-add', (_e, projectId: number, refProjectId: number, scope?: string) =>
    ProjectLinkDao.addLink(projectId, refProjectId, scope)
  )
  ipcMain.handle('db:link-remove', (_e, id: number) => ProjectLinkDao.removeLink(id))
  ipcMain.handle('db:link-request-list', (_e, projectId: number, asRequester: boolean) =>
    asRequester ? ProjectLinkRequestDao.sent(projectId) : ProjectLinkRequestDao.received(projectId)
  )
  ipcMain.handle(
    'db:link-request-create',
    (
      _e,
      data: {
        project_id: number
        target_project_id: number
        scope: string
        reason?: string
      }
    ) => ProjectLinkRequestDao.create(data)
  )
  ipcMain.handle('db:link-request-resolve', (_e, id: number, decision: 'approve' | 'reject') =>
    ProjectLinkRequestDao.resolve(id, decision)
  )
}

export function closeDatabases(): void {
  closeSQLite()
}
