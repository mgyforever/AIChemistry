<template>
  <aside class="agent-panel">
    <div class="ap-head">
      <div class="ap-title-wrap">
        <span class="ap-title">AI 实验助手</span>
        <span v-if="currentConvTitle" class="ap-conv" :title="currentConvTitle">{{ currentConvTitle }}</span>
      </div>
      <div class="ap-actions">
        <button
          type="button"
          class="ap-icon"
          :class="{ active: showHistory }"
          title="历史对话"
          @click="showHistory = !showHistory"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="ap-ic"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h10" /></svg>
        </button>
        <button
          type="button"
          class="ap-icon"
          title="新建对话"
          :disabled="!reproStore.currentProjectId"
          @click="newConversation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="ap-ic"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14" /></svg>
        </button>
        <span class="ap-dot" :class="{ busy: loading }" />
      </div>
    </div>

    <!-- 历史对话列表 -->
    <div v-if="showHistory" class="ap-history">
      <div v-if="!reproStore.conversations.length" class="ap-h-empty">暂无历史对话</div>
      <div
        v-for="c in reproStore.conversations"
        :key="c.id"
        class="ap-h-item"
        :class="{ active: c.id === reproStore.currentConversationId }"
        @click="pickConversation(c.id)"
      >
        <div class="ap-h-main">
          <b>{{ c.title || '新对话' }}</b>
          <span class="ap-h-preview">{{ previewOf(c) }}</span>
          <span class="ap-h-meta">{{ metaOf(c) }}</span>
        </div>
        <button type="button" class="ap-h-del" title="删除对话" @click.stop="removeConversation(c.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="ap-ic-sm"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>

    <div ref="listRef" class="ap-list">
      <div
        v-for="(m, i) in reproStore.messages"
        :key="i"
        class="msg"
        :class="m.role"
        ref="msgRefs"
      >
        <div class="bubble">
          <MarkdownRenderer :content="m.content" />
          <div v-if="m.charts?.length" class="charts">
            <ChartCard v-for="c in m.charts" :key="c.id" :spec="c" />
          </div>
        </div>
      </div>
      <div v-if="loading" class="msg assistant">
        <div class="bubble typing">
          <span class="t-dot" /><span class="t-dot" /><span class="t-dot" />
        </div>
      </div>
      <p v-if="!reproStore.messages.length" class="ap-empty">
        实验全程 AI 陪伴：可随时提问化学原理、步骤、现象分析；也可执行建项目、记录数据、预测实验、生成论文等工作流。
      </p>
    </div>

    <div class="ap-input">
      <textarea
        v-model="text"
        rows="2"
        placeholder="输入问题或指令…"
        :disabled="loading"
        @keydown.enter.exact.prevent="send"
      />
      <button type="button" class="ap-send" :disabled="loading || !text.trim()" @click="send">发送</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch, computed } from 'vue'
import gsap from 'gsap'
import { reproStore, type ChatConversationUI } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ChartCard from './ChartCard.vue'

const text = ref('')
const listRef = ref<HTMLElement | null>(null)

/* ---------- 会话（新建对话 / 历史对话） ---------- */
const showHistory = ref(false)
const currentConvTitle = computed(() => {
  const c = reproStore.conversations.find((x) => x.id === reproStore.currentConversationId)
  return c?.title || ''
})

async function newConversation(): Promise<void> {
  showHistory.value = false
  if (!reproStore.currentProjectId) return
  await reproStore.createConversation()
}

async function pickConversation(id: number): Promise<void> {
  showHistory.value = false
  await reproStore.selectConversation(id)
}

async function removeConversation(id: number): Promise<void> {
  if (!window.confirm('删除该对话？对话下的消息将一并删除。')) return
  await reproStore.deleteConversation(id)
}

function previewOf(c: ChatConversationUI): string {
  const p = (c.preview ?? '').replace(/\s+/g, ' ').trim()
  return p ? p.slice(0, 42) : '暂无消息'
}

function metaOf(c: ChatConversationUI): string {
  const t = (c.updated_at || '').slice(5, 16).replace('T', ' ')
  return `${c.message_count ?? 0} 条 · ${t}`
}

const loading = ref(false)

async function send(): Promise<void> {
  const content = text.value.trim()
  if (!content || loading.value) return
  console.log('[Component] AgentPanel 发送消息:', content.slice(0, 50))
  text.value = ''
  loading.value = true
  try {
    await reproStore.sendMessage(content)
    console.log('[Component] AgentPanel 消息处理完成')
  } catch (err) {
    console.error('[Component] AgentPanel 消息处理异常:', err)
  } finally {
    loading.value = false
  }
}

// GSAP 消息入场动画（尊重 prefers-reduced-motion）
let mm: gsap.MatchMedia | null = null
function animateNew(): void {
  nextTick(() => {
    if (!listRef.value) return
    const items = listRef.value.querySelectorAll('.msg:not(.animated)')
    if (!items.length) return
    if (mm) {
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', stagger: 0.06 }
      )
    }
    items.forEach((el) => el.classList.add('animated'))
    listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

watch(
  () => reproStore.messages.length,
  () => animateNew()
)

onMounted(() => {
  console.log('[Component] AgentPanel 挂载, 初始消息数:', reproStore.messages.length)
  mm = gsap.matchMedia()
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    /* 动画由 animateNew 统一处理 */
  })
  // 监听 loading 结束以滚动到底
  watch(loading, (v) => {
    if (!v) nextTick(() => listRef.value && (listRef.value.scrollTop = listRef.value.scrollHeight))
  })
})
</script>

<style scoped>
.agent-panel {
  display: flex;
  flex-direction: column;
  width: 340px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 16px;
  background: var(--lab-glass);
  backdrop-filter: blur(14px);
  overflow: hidden;
}
.ap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}
.ap-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.ap-title { font-size: 13.5px; font-weight: 700; color: var(--color-text); flex-shrink: 0; }
.ap-conv {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.ap-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.ap-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
}
.ap-icon:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-border);
}
.ap-icon.active {
  color: var(--color-accent-ink);
  border-color: var(--color-border);
  background: rgba(56, 189, 248, 0.1);
}
.ap-icon:disabled { opacity: 0.4; cursor: not-allowed; }
.ap-ic { width: 15px; height: 15px; }
.ap-ic-sm { width: 13px; height: 13px; }
.ap-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); }
.ap-dot.busy { background: var(--color-warning); animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }

/* 历史对话列表 */
.ap-history {
  max-height: 220px;
  overflow-y: auto;
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ap-h-empty { padding: 12px 6px; font-size: 12px; color: var(--color-text-muted); text-align: center; }
.ap-h-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ap-h-item:hover { background: var(--color-surface); }
.ap-h-item.active { border-color: var(--color-primary-light); background: rgba(99, 102, 241, 0.08); }
.ap-h-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ap-h-main b {
  font-size: 12.5px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-h-preview {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ap-h-meta { font-size: 10.5px; color: var(--color-text-muted); opacity: 0.75; }
.ap-h-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.ap-h-del:hover { color: var(--color-danger); border-color: var(--color-border); }
.ap-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.msg { display: flex; }
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }
.bubble {
  max-width: 92%;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.bubble :deep(.markdown-body),
.bubble :deep(.repro-md) {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.bubble :deep(.katex) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
.msg.user .bubble {
  background: var(--color-user-bubble);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.assistant .bubble {
  background: var(--color-ai-bubble);
  border: 1px solid var(--color-border);
  border-bottom-left-radius: 4px;
}
.charts { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.typing { display: flex; gap: 4px; }
.t-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-text-muted); animation: bounce 1.2s infinite; }
.t-dot:nth-child(2) { animation-delay: 0.15s; }
.t-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 30% { transform: translateY(-4px); } }
.ap-empty { font-size: 12.5px; color: var(--color-text-muted); line-height: 1.7; text-align: center; padding: 20px 8px; }
.ap-input {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border);
}
.ap-input textarea {
  flex: 1;
  resize: none;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
}
.ap-input textarea:focus { border-color: var(--color-primary-light); }
.ap-send {
  align-self: flex-end;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.ap-send:hover { opacity: 0.9; }
.ap-send:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
