import { createAgent } from 'langchain'
import { model } from '../model'
import { experimentSystemPrompt } from './prompt'
import {
  listProjectsTool,
  getProjectTool,
  searchProjectKnowledgeTool,
  importDocumentsTool,
  parseDocumentsIntoProjectTool,
  updateReproductionPlanTool,
  saveExperimentRecordTool,
  addCustomDataTool,
  updateProjectStatusTool,
  listExperimentVariablesTool,
  suggestOptimizationsTool,
  analyzeVariableEffectsTool,
  runPredictionExperimentTool,
  generatePaperTool
} from './tools'
import { extractChartsFromToolOutput } from './charts'
import type { AiChat, ExperimentAgentRequest } from '../type'

/**
 * 实验复现 Agent（P6）
 * 与聊天 Agent 完全独立，仅由工作台页面经 ai:experiment-chat-stream 调用。
 */

const agent = createAgent({
  model,
  tools: [
    listProjectsTool,
    getProjectTool,
    searchProjectKnowledgeTool,
    importDocumentsTool,
    parseDocumentsIntoProjectTool,
    updateReproductionPlanTool,
    saveExperimentRecordTool,
    addCustomDataTool,
    updateProjectStatusTool,
    listExperimentVariablesTool,
    suggestOptimizationsTool,
    analyzeVariableEffectsTool,
    runPredictionExperimentTool,
    generatePaperTool
  ],
  systemPrompt: experimentSystemPrompt
})

interface AgentMsg {
  /** 运行时角色（langchain createAgent 识别 human/ai） */
  role: string
  content: string
  /** 满足 Messages 类型约束（BaseMessageLike.type） */
  type: 'user' | 'assistant'
  [key: string]: unknown
}

/** 将历史消息转换为 agent 输入（assistant 消息提取 messages 部分） */
function toAgentMessages(req: ExperimentAgentRequest): AgentMsg[] {
  const messages: AgentMsg[] = []
  for (const m of req.history ?? []) {
    let content = m.content
    if (m.role === 'assistant') {
      try {
        const parsed = JSON.parse(content) as Partial<AiChat>
        if (typeof parsed.messages === 'string') content = parsed.messages
      } catch {
        /* 非 JSON 原样使用 */
      }
    }
    const isAi = m.role === 'assistant'
    messages.push({ role: isAi ? 'ai' : 'human', content, type: isAi ? 'assistant' : 'user' })
  }
  messages.push({ role: 'human', content: req.message, type: 'user' })
  return messages
}

/** 解析模型最终输出的 {think, messages, charts} */
function parseAiReply(raw: string): AiChat {
  try {
    const parsed = JSON.parse(raw) as Partial<AiChat>
    return {
      think: typeof parsed.think === 'string' ? parsed.think : '',
      messages: typeof parsed.messages === 'string' ? parsed.messages : raw,
      charts: Array.isArray(parsed.charts) ? parsed.charts : []
    }
  } catch {
    const jsonStart = raw.indexOf('{')
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart)) as Partial<AiChat>
        return {
          think: typeof parsed.think === 'string' ? parsed.think : '',
          messages: typeof parsed.messages === 'string' ? parsed.messages : raw,
          charts: Array.isArray(parsed.charts) ? parsed.charts : []
        }
      } catch {
        /* 继续走兜底 */
      }
    }
    return { think: '', messages: raw, charts: [] }
  }
}

/**
 * 实验 Agent 对话入口：完整收集 token 后统一返回 AiChat JSON 字符串。
 * 工具输出中【图表数据】标记会被提取并合并进最终 charts。
 */
export async function experimentChat(req: ExperimentAgentRequest): Promise<string> {
  const agentMessages = toAgentMessages(req)
  console.log('[ExperimentAgent] 开始执行:', {
    projectId: req.projectId,
    msgCount: agentMessages.length,
    lastInput: req.message.slice(0, 50)
  })

  let messagesContent = ''
  const collectedCharts: AiChat['charts'] = []

  try {
    const run = await agent.streamEvents({ messages: agentMessages }, { version: 'v3' })

    await Promise.all([
      // 消息 token 收集
      (async () => {
        for await (const msg of run.messages) {
          for await (const token of msg.text) {
            messagesContent += token
          }
        }
      })(),
      // 工具调用监控 + 图表提取
      (async () => {
        for await (const call of run.toolCalls) {
          console.log('[ExperimentAgent] 工具调用:', call.name)
          try {
            const output = (await call.output) as string | undefined
            if (typeof output === 'string') {
              collectedCharts.push(...extractChartsFromToolOutput(output))
            }
          } catch (err) {
            console.error('[ExperimentAgent] 工具输出获取异常:', call.name, err)
            /* 工具失败不影响整体 */
          }
        }
      })()
    ])

    await run.output

    const reply = parseAiReply(messagesContent)
    // 合并工具生成的图表（工具图表优先，模型补充图表在后）
    reply.charts = [...(collectedCharts ?? []), ...(reply.charts ?? [])]

    const result = JSON.stringify(reply)
    console.log('[ExperimentAgent] 执行完成:', {
      thinkLen: reply.think.length,
      msgLen: reply.messages.length,
      chartCount: reply.charts?.length ?? 0
    })
    return result
  } catch (err) {
    console.error('[ExperimentAgent] 执行失败:', err)
    return JSON.stringify({
      think: '执行出错',
      messages: `实验助手执行出错：${err instanceof Error ? err.message : String(err)}。请重试。`,
      charts: []
    } satisfies AiChat)
  }
}
