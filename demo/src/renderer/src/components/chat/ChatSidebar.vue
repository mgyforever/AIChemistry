<template>
  <aside class="w-[var(--sidebar-width)] h-full bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex flex-col">
    <!-- 头部 -->
    <div class="shrink-0 flex items-center justify-between p-4 border-b border-[var(--color-border)]">
      <h1 class="text-sm font-semibold text-[var(--color-text)] tracking-wide">AI Chemistry</h1>
      <div class="flex items-center gap-1">
        <!-- 主题切换 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] cursor-pointer transition-colors duration-150"
          :title="themeStore.mode === 'dark' ? '切换亮色' : '切换暗色'"
          @click="themeStore.toggle()"
        >
          <svg v-if="themeStore.mode === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] cursor-pointer transition-colors duration-150"
          title="新建会话"
          @click="emit('create')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 会话列表 -->
    <div ref="listRef" class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="sidebar-item group flex items-center rounded-lg px-3 py-2.5 cursor-pointer transition-colors duration-150"
        :class="
          conv.id === currentId
            ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary-light)]'
            : 'text-[var(--color-text)] hover:bg-[var(--color-surface)]'
        "
        @click="emit('select', conv.id)"
      >
        <span class="flex-1 text-sm truncate">{{ conv.title }}</span>
        <button
          class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] hover:bg-[var(--color-border)] cursor-pointer transition-all duration-150"
          title="删除"
          @click.stop="emit('delete', conv.id)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      <!-- 空列表占位 -->
      <div
        v-if="conversations.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <p class="text-[var(--color-text-muted)] text-xs">暂无对话记录</p>
        <p class="text-[var(--color-text-muted)] text-xs mt-1">点击 + 开始新对话</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import gsap from 'gsap'
import { themeStore } from '../../stores/theme'

interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
}

const props = defineProps<{
  conversations: Conversation[]
  currentId: number | null
}>()

const emit = defineEmits<{
  select: [id: number]
  create: []
  delete: [id: number]
}>()

const listRef = ref<HTMLElement | null>(null)

function animateList(): void {
  nextTick(() => {
    if (listRef.value) {
      const items = listRef.value.querySelectorAll('.sidebar-item')
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, x: -20 },
          {
            opacity: 1,
            x: 0,
            duration: 0.3,
            stagger: 0.03,
            ease: 'power2.out'
          }
        )
      }
    }
  })
}

watch(() => props.conversations.length, animateList)
onMounted(() => {
  console.log('[Component] ChatSidebar 挂载, 会话数:', props.conversations.length)
  animateList()
})
</script>
