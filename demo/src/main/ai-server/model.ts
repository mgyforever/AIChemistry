import { ChatOpenAI } from '@langchain/openai'
import dotenv from 'dotenv'

dotenv.config()

export const model = new ChatOpenAI({
  model: process.env.MODEL,
  temperature: 0,
  apiKey: process.env.DEEPSEEK_API_KEY
})
