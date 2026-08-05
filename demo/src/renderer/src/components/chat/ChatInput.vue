<template>
  <div
    ref="containerRef"
    class="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-alt)] transition-colors duration-200"
  >
    <div class="flex items-end gap-2 p-3">
      <textarea
        ref="textareaRef"
        v-model="text"
        rows="1"
        placeholder="输入消息… (Enter 发送, Shift+Enter 换行)"
        :disabled="disabled"
        class="flex-1 resize-none bg-transparent text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] outline-none leading-relaxed max-h-[200px] scrollbar-thin"
        @keydown="handleKeydown"
        @focus="onFocus"
        @blur="onBlur"
        @input="autoResize"
      />
      <button
        :disabled="disabled || !text.trim()"
        class="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity duration-150 hover:bg-[var(--color-primary-light)]"
        @click="handleSend"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import gsap from 'gsap'

const emit = defineEmits<{
  send: [content: string]
}>()

const props = defineProps<{
  disabled: boolean
}>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

function autoResize(): void {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend(): void {
  const content = text.value.trim()
  if (!content || props.disabled) return
  console.log('[Component] ChatInput 发送消息:', content.slice(0, 50))
  emit('send', content)
  text.value = ''
  nextTick(() => autoResize())
}

onMounted(() => {
  console.log('[Component] ChatInput 挂载')
  if (containerRef.value) {
    gsap.fromTo(
      containerRef.value,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.2 }
    )
  }
})

function onFocus(): void {
  if (containerRef.value) {
    gsap.to(containerRef.value, {
      borderColor: 'var(--color-primary-light)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.15)',
      duration: 0.2,
      ease: 'power1.out'
    })
  }
}

function onBlur(): void {
  if (containerRef.value) {
    gsap.to(containerRef.value, {
      borderColor: 'var(--color-border)',
      boxShadow: 'none',
      duration: 0.2,
      ease: 'power1.out'
    })
  }
}
</script>
