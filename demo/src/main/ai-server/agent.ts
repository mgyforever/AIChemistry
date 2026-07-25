import { model } from './model'
import type { BaseMessage } from '@langchain/core/messages'

/**
 * 发送消息列表给 AI 模型，返回流式响应
 */
export async function chatStream(
  messages: BaseMessage[],
  options?: { onToken?: (token: string) => void }
): Promise<string> {
  const stream = await model.stream(messages)

  let fullContent = ''
  for await (const chunk of stream) {
    const token = chunk.content as string
    fullContent += token
    options?.onToken?.(token)
  }

  return fullContent
}
