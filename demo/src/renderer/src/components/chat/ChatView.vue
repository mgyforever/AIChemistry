<template>
  <div class="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth">
    <!-- 空状态 -->
    <div
      v-if="props.messages.length === 0 && !props.streamingText"
      class="flex flex-col items-center justify-center h-full text-center"
    >
      <div class="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-[var(--color-primary-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <p class="text-[var(--color-text-muted)] text-sm">开始一段新的对话</p>
      <p class="text-[var(--color-text-muted)] text-xs mt-1">输入消息开始与 AI 交流</p>
    </div>

    <!-- 历史消息列表 -->
    <MessageBubble
      v-for="msg in props.messages"
      :key="msg.id"
      :role="msg.role"
      :content="msg.content"
    />

    <!-- 伪流式输出的虚拟气泡（独立渲染，避免与消息列表冲突） -->
    <MessageBubble
      v-if="props.streamingText"
      key="streaming-bubble"
      role="assistant"
      :content="props.streamingText"
      :streaming-think="props.streamingThink || undefined"
    />

    <!-- 加载指示器 -->
    <div
      v-if="props.isLoading && !props.streamingText"
      class="flex justify-start"
    >
      <div class="bg-[var(--color-ai-bubble)] border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-4 py-3">
        <div class="flex gap-1.5">
          <span class="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style="animation-delay: 0ms" />
          <span class="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style="animation-delay: 150ms" />
          <span class="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-bounce" style="animation-delay: 300ms" />
        </div>
      </div>
    </div>

    <div ref="messagesEndRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import MessageBubble from './MessageBubble.vue'

interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

const props = defineProps<{
  messages: Message[]
  streamingText: string
  streamingThink: string
  isLoading: boolean
}>()

const messagesEndRef = ref<HTMLElement | null>(null)

function scrollToBottom(): void {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}

watch(
  () => props.messages.length + props.streamingText.length,
  () => scrollToBottom()
)
</script>
