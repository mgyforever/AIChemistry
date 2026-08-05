<template>
  <div class="h-screen w-screen flex flex-col bg-[var(--color-surface)]">
    <LabTopBar title="AI 对话" />

    <div class="flex-1 flex min-h-0">
      <ChatSidebar
        :conversations="chatStore.conversations"
        :current-id="chatStore.currentConversationId"
        @select="handleSelect"
        @create="handleCreate"
        @delete="handleDelete"
      />

      <!-- 主聊天区域 -->
      <main class="flex-1 flex flex-col min-w-0">
        <ChatView
          :messages="chatStore.messages"
          :streaming-text="chatStore.streamingText"
          :streaming-think="chatStore.streamingThink"
          :is-loading="chatStore.isLoading"
        />

        <div class="shrink-0 px-4 pb-4 pt-2">
          <ChatInput
            :disabled="chatStore.isLoading"
            @send="handleSend"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import LabTopBar from '../components/lab/LabTopBar.vue'
import ChatSidebar from '../components/chat/ChatSidebar.vue'
import ChatView from '../components/chat/ChatView.vue'
import ChatInput from '../components/chat/ChatInput.vue'
import { chatStore } from '../stores/chat'

onMounted(async () => {
  console.log('[View] Home 挂载，开始加载会话列表')
  await chatStore.loadConversations()
  console.log('[View] Home 会话列表加载完成，共', chatStore.conversations.length, '条')
})

async function handleSelect(id: number): Promise<void> {
  console.log('[View] 切换会话:', id)
  await chatStore.selectConversation(id)
  console.log('[View] 会话切换完成:', id, '消息数:', chatStore.messages.length)
}

async function handleCreate(): Promise<void> {
  console.log('[View] 创建新会话')
  const conv = await chatStore.createConversation()
  console.log('[View] 新会话创建完成, 会话ID:', conv.id)
}

async function handleDelete(id: number): Promise<void> {
  console.log('[View] 删除会话:', id)
  await chatStore.deleteConversation(id)
  console.log('[View] 会话已删除:', id)
}

async function handleSend(content: string): Promise<void> {
  console.log('[View] 发送消息:', content.slice(0, 50))
  await chatStore.sendMessage(content)
}
</script>
