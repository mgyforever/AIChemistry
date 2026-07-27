<template>
  <div class="h-screen w-screen flex bg-[var(--color-surface)]">
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
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ChatSidebar from '../components/chat/ChatSidebar.vue'
import ChatView from '../components/chat/ChatView.vue'
import ChatInput from '../components/chat/ChatInput.vue'
import { chatStore } from '../stores/chat'

onMounted(async () => {
  await chatStore.loadConversations()
})

async function handleSelect(id: number): Promise<void> {
  await chatStore.selectConversation(id)
}

async function handleCreate(): Promise<void> {
  await chatStore.createConversation()
}

async function handleDelete(id: number): Promise<void> {
  await chatStore.deleteConversation(id)
}

async function handleSend(content: string): Promise<void> {
  await chatStore.sendMessage(content)
}
</script>
