import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

dotenv.config()

console.log('[Model] 初始化模型配置:', {
  model: process.env.MODEL,
  baseURL: 'https://api.deepseek.com',
  hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY)
})

export const model = new ChatOpenAI({
  model: process.env.MODEL,
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: 'https://api.deepseek.com'
  },
  modelKwargs: {
    response_format: { type: 'json_object' }
  }
})
