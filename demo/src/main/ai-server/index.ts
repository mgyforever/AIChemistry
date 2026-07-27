import { ipcMain } from 'electron'
import { chatStreamWithSearch, chatStream } from './agent'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

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
      const result = await chatStream(toBaseMessages(messages))
      return result
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
      const result = await chatStreamWithSearch(toBaseMessages(messages))
      console.log('[AI] chatStreamWithSearch 完成:', { resultLen: result.length })
      return result
    }
  )
}
