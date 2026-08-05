import { ipcMain } from 'electron'
import { chatStreamWithSearch, chatStream } from './agent'
import { experimentChat } from './experiment/agent'
import { parseDocumentsIntoProject, saveExperimentRecordWithAnalysis } from './experiment/tools'
import type { ParseDocumentsResult, SaveRecordInput, SaveRecordResult } from './experiment/tools'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { ExperimentAgentRequest } from './type'

function toBaseMessages(raw: { role: string; content: string }[]): BaseMessage[] {
  return raw.map((msg) => {
    switch (msg.role) {
      case 'system':
        return new SystemMessage(msg.content)
      case 'assistant':
        return new AIMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

export function registerAiHandlers(): void {
  // 非流式 AI 聊天：内部收集完整内容后统一返回 JSON 字符串
  ipcMain.handle(
    'ai:chat',
    async (
      _event,
      messages: { role: string; content: string }[]
    ): Promise<string> => {
      console.log('[AI] chat 开始, 消息数:', messages.length)
      try {
        const result = await chatStream(toBaseMessages(messages))
        console.log('[AI] chat 完成:', { resultLen: result.length })
        return result
      } catch (err) {
        console.error('[AI] chat 异常:', err)
        throw err
      }
    }
  )

  // 带搜索的 AI 聊天：内部收集完整内容后统一返回 JSON 字符串
  ipcMain.handle(
    'ai:chat-stream',
    async (
      _event,
      messages: { role: string; content: string }[]
    ): Promise<string> => {
      console.log('[AI] chatStreamWithSearch 开始, 消息数:', messages.length)
      try {
        const result = await chatStreamWithSearch(toBaseMessages(messages))
        console.log('[AI] chatStreamWithSearch 完成:', { resultLen: result.length })
        return result
      } catch (err) {
        console.error('[AI] chatStreamWithSearch 异常:', err)
        throw err
      }
    }
  )

  // 实验复现 Agent（与聊天完全独立，仅工作台页面调用）
  ipcMain.handle(
    'ai:experiment-chat-stream',
    async (_event, req: ExperimentAgentRequest): Promise<string> => {
      console.log('[AI] experimentChat 开始:', { projectId: req.projectId, msgLen: req.message.length })
      try {
        const result = await experimentChat(req)
        console.log('[AI] experimentChat 完成:', { resultLen: result.length })
        return result
      } catch (err) {
        console.error('[AI] experimentChat 异常:', err)
        throw err
      }
    }
  )

  // 上传文献后确定性解析到当前项目（不依赖 agent 决策）
  ipcMain.handle(
    'ai:project-parse-documents',
    async (_event, projectId: number, documentIds: number[]): Promise<ParseDocumentsResult> => {
      console.log('[AI] parseDocumentsIntoProject 开始:', { projectId, docCount: documentIds.length })
      const result = await parseDocumentsIntoProject(projectId, documentIds)
      console.log('[AI] parseDocumentsIntoProject 完成:', {
        projectId,
        textLen: result.text.length,
        chartCount: result.charts.length
      })
      return result
    }
  )

  // 主界面表单保存实验记录（自动分析符合度，不经过 agent）
  ipcMain.handle(
    'ai:save-record',
    async (_event, input: SaveRecordInput): Promise<SaveRecordResult> => {
      console.log('[AI] save-record 开始:', { projectId: input.project_id, name: input.name })
      const result = await saveExperimentRecordWithAnalysis(input)
      console.log('[AI] save-record 完成:', { recordId: result.recordId })
      return result
    }
  )
}
