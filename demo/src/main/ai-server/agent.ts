import { model } from './model'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { Prompt } from './prompt'
import { searchTool } from './tools'
import { createAgent } from 'langchain'

const prompt = new Prompt('')

// ==================== 基础聊天（无搜索） ====================

function withSystem(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length === 0 || !(messages[0] instanceof SystemMessage)) {
    return [new SystemMessage(prompt.AIChatSystemPrompt), ...messages]
  }
  return messages
}

/**
 * 从模型输出中提取 think 和 messages
 * 模型可能输出非 JSON（旧格式）或 JSON（response_format 启用后），统一处理
 */
function parseModelOutput(raw: string): { think: string; messages: string } {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object') {
      return {
        think: typeof parsed.think === 'string' ? parsed.think : '',
        messages: typeof parsed.messages === 'string' ? parsed.messages : raw
      }
    }
  } catch {
    // 非 JSON 格式，整体作为 messages
  }
  return { think: '', messages: raw }
}

/**
 * 发送消息列表给 AI 模型，返回完整响应（无搜索能力）
 */
export async function chatStream(
  messages: BaseMessage[]
): Promise<string> {
  const stream = await model.stream(withSystem(messages))

  let fullContent = ''
  for await (const chunk of stream) {
    fullContent += (chunk.content as string)
  }

  // 解析模型 JSON 输出
  const { think, messages: msg } = parseModelOutput(fullContent)
  return JSON.stringify({ think, messages: msg })
}

// ==================== LangChain 标准 Agent 框架 ====================

/**
 * LangChain 标准的 ReAct Agent
 * 自动决定何时调用 web_search 工具，并生成最终回答
 */
const agent = createAgent({
  model,
  tools: [searchTool],
  systemPrompt: prompt.AIChatSystemPrompt
})

/**
 * 将 BaseMessage[] 转换为 agent 所需的 { role, content }[] 格式
 */
function toAgentMessages(messages: BaseMessage[]): Array<{ role: string; content: string }> {
  const result: Array<{ role: string; content: string }> = []

  for (const m of messages) {
    // system 消息由 agent prompt 处理，跳过
    if (m instanceof SystemMessage) continue

    const content = m.content as string
    if (m instanceof HumanMessage) {
      result.push({ role: 'human', content })
    } else {
      // AIMessage / ToolMessage 等
      result.push({ role: 'ai', content })
    }
  }

  return result
}

/**
 * 带搜索引擎支持的聊天
 * 使用 LangChain 标准的 createAgent + streamEvents({ version: "v3" })
 * agent 自动判断是否需要调用搜索工具
 * 内部收集所有 token，最终统一返回完整 JSON 字符串：{ think: string, messages: string }
 */
export async function chatStreamWithSearch(
  messages: BaseMessage[]
): Promise<string> {
  const agentMessages = toAgentMessages(messages)

  if (agentMessages.length === 0) {
    console.warn('[Agent] 无有效消息，回退到普通 chatStream')
    return chatStream(messages)
  }

  console.log('[Agent] createAgent 开始执行:', {
    msgCount: agentMessages.length,
    lastInput: agentMessages[agentMessages.length - 1]?.content?.slice(0, 50)
  })

  let messagesContent = ''

  try {
    // 使用 streamEvents({ version: "v3" }) 获取 token 级别的流式输出
    const run = await agent.streamEvents(
      { messages: agentMessages },
      { version: 'v3' }
    )

    // 并发消费：消息流 + 工具调用流
    await Promise.all([
      // 消息 token 收集
      (async () => {
        for await (const msg of run.messages) {
          for await (const token of msg.text) {
            messagesContent += token
          }
        }
      })(),

      // 工具调用监控（只在后台收集通知，不阻塞消息流）
      (async () => {
        for await (const call of run.toolCalls) {
          if (call.name === 'web_search') {
            console.log('[Agent] 工具调用开始: web_search')
            messagesContent += '\n【正在搜索相关信息…】\n'
          }
          // 等待工具执行完成
          try {
            await call.output
          } catch {
            // 工具执行失败不影响整体流程
          }
        }
      })()
    ])

    // 等待最终状态
    await run.output

    // 解析模型输出的 JSON，提取 think 和 messages
    let think = ''
    let messages = messagesContent
    try {
      const parsed = JSON.parse(messagesContent)
      if (typeof parsed.think === 'string') {
        think = parsed.think
      }
      if (typeof parsed.messages === 'string') {
        messages = parsed.messages
      }
      console.log('[Agent] 成功解析模型 JSON 输出:', { thinkLen: think.length, msgLen: messages.length })
    } catch {
      console.log('[Agent] 模型输出非 JSON 格式，整体作为 messages:', { contentLen: messagesContent.length })
    }

    const jsonResult = JSON.stringify({ think, messages })
    console.log('[Agent] createAgent 执行完成:', {
      thinkLen: think.length,
      msgLen: messages.length
    })
    return jsonResult
  } catch (err) {
    console.error('[Agent] createAgent 流式执行失败:', err)
    // 失败时回退到普通 chatStream
    console.log('[Agent] 回退到普通 chatStream')
    const fallbackResult = await chatStream(messages)
    return fallbackResult
  }
}
