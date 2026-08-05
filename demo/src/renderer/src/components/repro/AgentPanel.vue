<template>
  <aside class="agent-panel">
    <div class="ap-head">
      <span class="ap-title">AI 实验助手</span>
      <span class="ap-dot" :class="{ busy: loading }" />
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
import { ref, nextTick, onMounted, watch } from 'vue'
import gsap from 'gsap'
import { reproStore } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ChartCard from './ChartCard.vue'

const text = ref('')
const listRef = ref<HTMLElement | null>(null)

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
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}
.ap-title { font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.ap-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); }
.ap-dot.busy { background: var(--color-warning); animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: 0.4; } }
.ap-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.msg { display: flex; }
.msg.user { justify-content: flex-end; }
.msg.assistant { justify-content: flex-start; }
.bubble {
  max-width: 92%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.6;
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
