<template>
  <div class="panel">
    <div v-if="!projectId" class="panel-empty"><p>选择左侧项目生成论文</p></div>
    <div v-else class="panel-body">
      <section class="card">
        <h3>论文生成（可选）</h3>
        <p class="hint">
          基于数据库中的真实数据生成标准论文（Markdown）。缺失真实数据处自动标注
          <b>【待人工补充】</b>；图表以数据表 + 占位符输出，可在预览中渲染 ECharts。
        </p>
        <button type="button" class="gen" :disabled="loading" @click="generate">
          {{ loading ? '生成中…' : '生成论文' }}
        </button>
      </section>

      <section class="card">
        <h3>论文列表（{{ papers.length }}）</h3>
        <div v-for="p in papers" :key="p.id" class="paper">
          <div class="paper-head">
            <b>{{ p.title }}</b>
            <div class="paper-actions">
              <button type="button" @click="download(p)">下载 .md</button>
            </div>
          </div>
          <div class="paper-body">
            <MarkdownRenderer :content="preview(p)" />
          </div>
        </div>
        <p v-if="!papers.length" class="muted">暂无论文</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reproStore, type ProjectContextUI, type PaperUI } from '../../stores/repro'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{ projectId: number | null; ctx: ProjectContextUI | null }>()

onMounted(() => {
  console.log('[Component] PaperPanel 挂载')
})

const loading = ref(false)
const papers = computed(() => props.ctx?.papers ?? [])

async function generate(): Promise<void> {
  if (!props.projectId) return
  console.log('[Component] PaperPanel 生成论文, 项目ID:', props.projectId)
  loading.value = true
  try {
    await reproStore.sendMessage('所有阶段已完成，请生成标准论文（generate_paper），内容必须属实。')
    await reproStore.refreshContext()
    console.log('[Component] PaperPanel 论文生成完成')
  } catch (err) {
    console.error('[Component] PaperPanel 论文生成异常:', err)
  } finally {
    loading.value = false
  }
}

function preview(p: PaperUI): string {
  return p.content.length > 4000 ? p.content.slice(0, 4000) + '\n\n…（预览截断）' : p.content
}

function download(p: PaperUI): void {
  console.log('[Component] PaperPanel 下载论文:', p.title || '(未命名)')
  const blob = new Blob([p.content], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${p.title || 'paper'}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 8px; font-size: 13.5px; font-weight: 700; }
.hint { margin: 0 0 10px; font-size: 12px; color: var(--color-text-muted); line-height: 1.6; }
.gen { padding: 9px 14px; border: none; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #06b6d4); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity var(--transition-fast); }
.gen:hover { opacity: 0.9; }
.gen:disabled { opacity: 0.5; cursor: not-allowed; }
.paper { padding: 12px; border: 1px solid var(--color-border); border-radius: 10px; margin-bottom: 10px; background: var(--color-surface); }
.paper-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.paper-actions button { padding: 4px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-alt); color: var(--color-text); font-size: 12px; cursor: pointer; }
.paper-actions button:hover { border-color: var(--color-primary-light); }
.paper-body { max-height: 480px; overflow-y: auto; }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
