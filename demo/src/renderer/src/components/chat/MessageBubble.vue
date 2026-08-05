<template>
  <div
    ref="bubbleRef"
    class="flex"
    :class="role === 'user' ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words"
      :class="
        role === 'user'
          ? 'bg-[var(--color-user-bubble)] text-white rounded-br-sm'
          : 'bg-[var(--color-ai-bubble)] border border-[var(--color-border)] text-[var(--color-text)] rounded-bl-sm'
      "
    >
      <!-- 系统消息：斜体灰色显示 -->
      <template v-if="role === 'system'">
        <span class="whitespace-pre-wrap text-[var(--color-text-muted)] italic text-xs">{{ content }}</span>
      </template>

      <!-- AI 消息：包含可折叠思考过程 + Markdown 渲染回答 -->
      <template v-else-if="role === 'assistant'">
        <!-- 思考过程（可折叠），think 内容为空时不渲染该区域 -->
        <div v-if="displayThink" class="mb-2">
          <button
            class="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-border)]/30 cursor-pointer transition-colors duration-150"
            @click="toggleThinking"
          >
            <!-- 右侧箭头图标，展开时旋转 90° -->
            <svg
              class="w-3.5 h-3.5 transition-transform duration-200"
              :class="{ 'rotate-90': isThinkingOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span>思考过程</span>
            <span class="text-[10px] opacity-60">{{ isThinkingOpen ? '点击收起' : '点击展开' }}</span>
          </button>

          <!-- GSAP 控制高度的可折叠内容容器 -->
          <div
            ref="thinkingBodyRef"
            class="overflow-hidden"
            :style="{ height: 0, opacity: 0 }"
          >
            <div class="markdown-body text-xs opacity-80 border-l-2 border-[var(--color-accent)] pl-3 mt-1">
              <div v-html="renderedThink" />
            </div>
          </div>
        </div>

        <!-- messages 内容的 Markdown 渲染 -->
        <div class="markdown-body" v-html="renderedAnswer" />
      </template>

      <!-- 用户消息：纯文本显示 -->
      <template v-else>
        <span class="whitespace-pre-wrap">{{ renderedUserContent }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import gsap from 'gsap'
import { marked } from 'marked'

// 全局配置 marked：支持回车换行 + GFM（表格、任务列表等）
marked.setOptions({ breaks: true, gfm: true })

// ==================== Props ====================

const props = defineProps<{
  role: 'user' | 'assistant' | 'system'
  content: string
  streamingThink?: string
}>()

// ==================== 类型定义 ====================

/** AI 输出的 JSON 结构，与 src/main/ai-server/type.ts 中 AiChat 保持一致 */
interface AiChat {
  think: string    // 思考过程
  messages: string // 最终回答
}

// ==================== 内容解析 ====================

/**
 * 从 AI 回复 JSON 中递归提取 think 和 messages
 * 兼容新旧格式：新格式为扁平 JSON，旧格式 messages 字段可能嵌套了另一层 JSON
 */
function parseThinking(text: string): AiChat | null {
  try {
    // 兼容 AI 用 ```json 代码块包裹 JSON 的情况
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim()

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonStr)
    } catch {
      return null
    }

    if (typeof data?.messages !== 'string') return null

    let think = typeof data.think === 'string' ? data.think : ''
    let messages: string = data.messages

    // 递归解析：如果 messages 字段本身是 JSON 字符串（旧格式兼容）
    let depth = 0
    while (depth < 3) {
      try {
        const nested = JSON.parse(messages)
        if (typeof nested === 'object' && nested !== null) {
          if (typeof nested.messages === 'string') {
            if (typeof nested.think === 'string' && nested.think && !think) {
              think = nested.think
            }
            messages = nested.messages
            depth++
            continue
          }
        }
      } catch {
        // messages 不是 JSON，跳出
      }
      break
    }

    return { think, messages }
  } catch {
    return null
  }
}

/**
 * 当前展示的 AiChat 内容
 * - 伪流式期间：直接使用 streamingThink + content（纯文本）
 * - 非流式消息：从 content JSON 中解析
 */
const aiChat = computed<AiChat | null>(() => {
  if (props.role !== 'assistant') return null

  // 伪流式期间：streamingThink 已提取好，content 是纯文本 messages
  if (props.streamingThink !== undefined) {
    console.log('streamingThink:', props.streamingThink)
    return {
      think: props.streamingThink,
      messages: props.content
    }
  }

  // 非流式消息：从 DB 加载的完整 JSON 字符串中解析
  return parseThinking(props.content)
})

/** 当前展示的 think 内容 */
const displayThink = computed(() => aiChat.value?.think ?? '')

// ==================== Markdown 渲染 ====================

/** 安全地将 Markdown 文本转换为 HTML */
function renderMd(text: string): string {
  if (!text) return ''
  try {
    const result = marked.parse(text)
    return typeof result === 'string' ? result : text
  } catch {
    return text
  }
}

/** 思考过程的 HTML（实时渲染 Markdown） */
const renderedThink = computed(() => renderMd(displayThink.value))

/** 回答内容的 HTML */
const renderedAnswer = computed(() => {
  if (aiChat.value) {
    return renderMd(aiChat.value.messages)
  }
  // 非 AI 消息或不支持解析的内容
  return ''
})

/** 用户消息转义（防 XSS） */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const renderedUserContent = computed(() => escapeHtml(props.content))

// ==================== 思考区折叠/展开（GSAP 动画） ====================

const isThinkingOpen = ref(false)
const thinkingBodyRef = ref<HTMLElement | null>(null)
/** 当前正在运行的 GSAP 动画，用于切换时中断上一个 */
let thinkingAnim: gsap.core.Tween | null = null

function toggleThinking(): void {
  if (!thinkingBodyRef.value) return

  // 先中断上次动画，防止重叠
  thinkingAnim?.kill()

  if (isThinkingOpen.value) {
    // 折叠：高度 → 0
    thinkingAnim = gsap.to(thinkingBodyRef.value, {
      height: 0,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        isThinkingOpen.value = false
      }
    })
  } else {
    // 展开：先设为可见但高度为 0，再动画到实际高度
    isThinkingOpen.value = true
    nextTick(() => {
      if (thinkingBodyRef.value) {
        const targetHeight = thinkingBodyRef.value.scrollHeight
        gsap.set(thinkingBodyRef.value, { height: 0, opacity: 0 })
        thinkingAnim = gsap.to(thinkingBodyRef.value, {
          height: targetHeight,
          opacity: 1,
          duration: 0.3,
          ease: 'power2.out'
        })
      }
    })
  }
}

// ==================== 气泡入场动画 ====================

const bubbleRef = ref<HTMLElement | null>(null)

onMounted(() => {
  console.log('[Component] MessageBubble 挂载, role:', props.role, '内容长度:', props.content.length)
  gsap.fromTo(
    bubbleRef.value,
    { opacity: 0, y: 16, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' }
  )
})
</script>

<style scoped>
/* Markdown 渲染样式 — 仅对当前组件的 .markdown-body 生效 */
.markdown-body :deep(p) {
  margin-bottom: 0.5em;
}
.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.markdown-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
}
.markdown-body :deep(pre) {
  margin: 0.5em 0;
  padding: 0.75em 1em;
  border-radius: 8px;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.2);
}
.markdown-body :deep(pre code) {
  padding: 0;
  background: none;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 0.5em;
}
.markdown-body :deep(li) {
  margin-bottom: 0.25em;
}
.markdown-body :deep(strong) {
  font-weight: 600;
}
.markdown-body :deep(a) {
  color: var(--color-primary-light);
  text-decoration: underline;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  font-weight: 600;
  margin: 0.5em 0 0.25em;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 0.75em;
  margin: 0.5em 0;
  opacity: 0.85;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.4em 0.6em;
  text-align: left;
}
.markdown-body :deep(th) {
  font-weight: 600;
  background: rgba(128, 128, 128, 0.1);
}
</style>
