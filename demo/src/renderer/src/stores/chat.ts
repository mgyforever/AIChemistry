import { reactive } from 'vue'

interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

const api = window.api

/** 获取当前登录用户的 token（登录时保存到 localStorage） */
function getToken(): string {
  return localStorage.getItem('token') || ''
}

/** 从 AI 返回的 JSON 字符串中解析 think 和 messages */
function parseAiReply(reply: string): { think: string; messages: string } {
  try {
    const data = JSON.parse(reply)
    if (data && typeof data === 'object') {
      return {
        think: typeof data.think === 'string' ? data.think : '',
        messages: typeof data.messages === 'string' ? data.messages : reply
      }
    }
  } catch {
    // 非 JSON 格式，整体作为 messages
  }
  return { think: '', messages: reply }
}

export const chatStore = reactive({
  conversations: [] as Conversation[],
  currentConversationId: null as number | null,
  messages: [] as Message[],
  streamingText: '',
  /** 伪流式期间的思考内容（完整展示） */
  streamingThink: '',
  isLoading: false,
  _pseudoStreamTimer: null as ReturnType<typeof setInterval> | null,

  async loadConversations(): Promise<void> {
    const token = getToken()
    const list = await api.db.conversation.list(token)
    this.conversations = list as Conversation[]
    // 重置当前会话，避免残留上一个用户的数据
    this._clearPseudoStream()
    this.currentConversationId = null
    this.messages = []
    this.streamingText = ''
    this.streamingThink = ''
  },

  async selectConversation(id: number): Promise<void> {
    this._clearPseudoStream()
    this.currentConversationId = id
    this.streamingText = ''
    this.streamingThink = ''
    this.isLoading = false
    const msgs = await api.db.message.list(id)
    this.messages = msgs as Message[]
  },

  async createConversation(title?: string): Promise<Conversation> {
    const token = getToken()
    const { id } = await api.db.conversation.create(title || '新对话', token)
    const conv = (await api.db.conversation.get(id)) as Conversation
    this.conversations.unshift(conv)
    await this.selectConversation(id)
    return conv
  },

  async deleteConversation(id: number): Promise<void> {
    await api.db.conversation.delete(id)
    this.conversations = this.conversations.filter((c) => c.id !== id)
    if (this.currentConversationId === id) {
      this.currentConversationId = null
      this.messages = []
      this.streamingText = ''
      this.streamingThink = ''
    }
  },

  async sendMessage(content: string): Promise<void> {
    if (!content.trim() || this.isLoading) return
    console.log('[Store] sendMessage 开始:', { content: content.slice(0, 50), convId: this.currentConversationId })

    // 如果没有会话，自动创建一个
    let convId = this.currentConversationId
    if (!convId) {
      const conv = await this.createConversation(content.slice(0, 30))
      convId = conv.id
      console.log('[Store] 自动创建会话:', conv)
    }

    // 存用户消息
    const userMsg = await api.db.message.create(convId, 'user', content)
    console.log('[Store] 用户消息已存储:', userMsg)
    const updatedMsgs = (await api.db.message.list(convId)) as Message[]
    this.messages = updatedMsgs
    this.streamingText = ''
    this.streamingThink = ''
    this.isLoading = true

    // 构造历史消息（assistant 消息只传 messages 纯文本，去掉 JSON 包裹）
    const history = updatedMsgs.map((m) => {
      let content = m.content
      if (m.role === 'assistant') {
        try {
          const parsed = JSON.parse(content)
          if (parsed && typeof parsed.messages === 'string') {
            content = parsed.messages
          }
        } catch {
          // 不是 JSON 则原样使用
        }
      }
      return { role: m.role, content }
    })
    console.log('[Store] 发送给AI的消息数:', history.length)

    try {
      // 调用 AI（后端不再流式推送，等全部完成后统一返回）
      console.log('[Store] 调用AI开始...')
      const reply = await api.ai.chatStream(history)
      console.log('[Store] AI回复完成:', { replyLen: reply.length })

      // 如果会话已切换，丢弃本次结果
      if (this.currentConversationId !== convId) {
        console.log('[Store] 会话已切换，忽略AI回复')
        this.isLoading = false
        return
      }

      // 先存 AI 回复到数据库（存完整的 JSON 字符串）
      const aiMsg = await api.db.message.create(convId, 'assistant', reply)
      console.log('[Store] AI回复已存储:', aiMsg)
      const finalMsgs = (await api.db.message.list(convId)) as Message[]

      // 解析 JSON，提取 think 和 messages 文本
      const { think, messages: messagesText } = parseAiReply(reply)

      // ---- 前端伪流式输出 ----
      // streamingThink 立即完整展示思考内容
      // streamingText 逐步揭示回答文本
      this.streamingThink = think

      const contentLength = messagesText.length
      // 总时长 2~4 秒
      const totalDurationMs = Math.min(4000, Math.max(2000, contentLength * 2))
      const intervalMs = 30
      const totalFrames = Math.ceil(totalDurationMs / intervalMs)
      const charsPerTick = Math.max(1, Math.ceil(contentLength / totalFrames))

      let currentIndex = 0
      this.streamingText = messagesText.slice(0, 1) || ' '
      this._pseudoStreamTimer = setInterval(() => {
        const nextIndex = Math.min(currentIndex + charsPerTick, contentLength)
        this.streamingText = messagesText.slice(0, nextIndex)
        currentIndex = nextIndex

        // 伪流式结束
        if (currentIndex >= contentLength) {
          this._clearPseudoStream()
          this.isLoading = false
          // 更新为数据库中的完整消息
          this.messages = finalMsgs
          this.streamingText = ''
          this.streamingThink = ''
          console.log('[Store] 伪流式输出完成')
        }
      }, intervalMs)
      setTimeout(() => {
        if (this._pseudoStreamTimer) {
          // 如果 messagesText 为空，伪流式立刻完成
          if (contentLength === 0) {
            this._clearPseudoStream()
            this.isLoading = false
            this.messages = finalMsgs
            this.streamingText = ''
            this.streamingThink = ''
          }
        }
      }, 0)
    } catch (err) {
      console.error('[Store] sendMessage 异常:', err)
      this.isLoading = false
    } finally {
      console.log('[Store] sendMessage 结束')
    }
  },

  _clearPseudoStream(): void {
    if (this._pseudoStreamTimer) {
      clearInterval(this._pseudoStreamTimer)
      this._pseudoStreamTimer = null
    }
  }
})
