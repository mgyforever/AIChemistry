<template>
  <div class="panel">
    <div v-if="!projectId" class="panel-empty"><p>选择左侧项目后管理参考项目</p></div>
    <div v-else class="panel-body">
      <!-- 参考项目列表（默认仅文献共享，v0.10） -->
      <section class="card">
        <h3>参考项目（{{ links.length }}）</h3>
        <p class="card-hint">
          默认仅共享对方<b>文献</b>（scope=documents）；如需参考对方<b>实验具体内容</b>，请向作者发起共享请求，审批通过后提升范围。
        </p>
        <div v-if="links.length" class="links">
          <div v-for="l in links" :key="l.id" class="link">
            <div class="link-main">
              <b>{{ l.ref_name }}</b>
              <span class="link-scope" :class="l.scope">{{ scopeLabel(l.scope) }}</span>
            </div>
            <button type="button" class="link-del" @click="removeLink(l)">移除</button>
          </div>
        </div>
        <p v-else class="muted">暂无参考项目。可添加其他项目作为参考（默认仅共享文献）。</p>

        <!-- 添加参考项目 -->
        <div class="add-link">
          <select v-model="newRefId" class="add-input">
            <option :value="null" disabled>选择要参考的项目</option>
            <option v-for="p in candidates" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button type="button" class="add-btn" :disabled="newRefId === null || adding" @click="addLink">
            {{ adding ? '添加中…' : '添加参考项目' }}
          </button>
        </div>
      </section>

      <!-- 共享请求（我发起的） -->
      <section class="card">
        <h3>我发起的共享请求</h3>
        <form class="req-form" @submit.prevent="sendRequest">
          <select v-model="req.target" class="add-input">
            <option :value="null" disabled>选择目标项目</option>
            <option v-for="p in candidates" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select v-model="req.scope" class="add-input">
            <option value="summaries">实验摘要（summaries）</option>
            <option value="all">全部实验内容（all）</option>
          </select>
          <input v-model="req.reason" class="add-input" type="text" placeholder="申请理由（如：需要对比产率数据）" maxlength="200" />
          <button type="submit" class="add-btn" :disabled="req.target === null || !req.reason.trim() || reqSubmitting">
            {{ reqSubmitting ? '发送中…' : '发起共享请求' }}
          </button>
        </form>
        <div v-if="myRequests.length" class="reqs">
          <div v-for="r in myRequests" :key="r.id" class="req">
            <div class="req-main">
              <b>{{ r.target_owner_name }}</b>
              <span class="link-scope" :class="r.status">{{ scopeLabel(r.scope) }}</span>
              <span class="req-status" :class="r.status">{{ statusLabel(r.status) }}</span>
            </div>
            <p v-if="r.reason" class="req-reason">{{ r.reason }}</p>
          </div>
        </div>
        <p v-else class="muted">暂无发起的请求。</p>
      </section>

      <!-- 收到的共享请求（审批） -->
      <section class="card">
        <h3>收到的共享请求（{{ receivedRequests.length }}）</h3>
        <div v-if="receivedRequests.length" class="reqs">
          <div v-for="r in receivedRequests" :key="r.id" class="req" :class="r.status">
            <div class="req-main">
              <b>{{ r.target_owner_name }}</b>
              <span class="link-scope" :class="r.scope">{{ scopeLabel(r.scope) }}</span>
              <span class="req-status" :class="r.status">{{ statusLabel(r.status) }}</span>
            </div>
            <p v-if="r.reason" class="req-reason">理由：{{ r.reason }}</p>
            <div v-if="r.status === 'pending'" class="req-actions">
              <button type="button" class="req-btn approve" @click="resolve(r, 'approve')">批准</button>
              <button type="button" class="req-btn reject" @click="resolve(r, 'reject')">拒绝</button>
            </div>
          </div>
        </div>
        <p v-else class="muted">暂无收到的共享请求。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { reproStore } from '../../stores/repro'
import type { ProjectLinkUI } from '../../stores/repro'

const props = defineProps<{ projectId: number | null }>()

const api = window.api

/** 共享请求 UI（与主进程 ProjectLinkRequest 对应） */
interface ShareRequestUI {
  id: number
  project_id: number
  target_project_id: number
  target_owner_name: string
  scope: string
  reason: string
  status: string
  created_at: string
  resolved_at: string | null
}

const links = ref<ProjectLinkUI[]>([])
const receivedRequests = ref<ShareRequestUI[]>([])
const myRequests = ref<ShareRequestUI[]>([])

/** 候选参考项目 = 全部项目 - 当前项目 - 已关联项目 */
const candidates = computed(() => {
  if (props.projectId === null) return []
  const linkedIds = new Set(links.value.map((l) => l.ref_project_id))
  return reproStore.projects.filter((p) => p.id !== props.projectId && !linkedIds.has(p.id))
})

function scopeLabel(scope: string): string {
  const map: Record<string, string> = { documents: '仅文献', summaries: '实验摘要', all: '全部实验' }
  return map[scope] ?? scope
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { pending: '待审批', approved: '已批准', rejected: '已拒绝' }
  return map[s] ?? s
}

/* ---------- 参考项目 ---------- */
const newRefId = ref<number | null>(null)
const adding = ref(false)

async function addLink(): Promise<void> {
  if (props.projectId === null || newRefId.value === null) return
  adding.value = true
  try {
    await api.db.link.add(props.projectId, newRefId.value, 'documents')
    newRefId.value = null
    await load()
  } catch (err) {
    console.error('[Component] ReferenceProjectsPanel 添加参考项目失败:', err)
  } finally {
    adding.value = false
  }
}

async function removeLink(l: ProjectLinkUI): Promise<void> {
  try {
    await api.db.link.remove(l.id)
    await load()
  } catch (err) {
    console.error('[Component] ReferenceProjectsPanel 移除参考项目失败:', err)
  }
}

/* ---------- 发起共享请求 ---------- */
const req = reactive<{ target: number | null; scope: string; reason: string }>({
  target: null,
  scope: 'summaries',
  reason: ''
})
const reqSubmitting = ref(false)

async function sendRequest(): Promise<void> {
  if (props.projectId === null || req.target === null || !req.reason.trim()) return
  reqSubmitting.value = true
  try {
    await api.db.link.requestCreate({
      project_id: props.projectId,
      target_project_id: req.target,
      scope: req.scope,
      reason: req.reason.trim()
    })
    req.target = null
    req.reason = ''
    await load()
  } catch (err) {
    console.error('[Component] ReferenceProjectsPanel 发起共享请求失败:', err)
  } finally {
    reqSubmitting.value = false
  }
}

/* ---------- 审批 ---------- */
async function resolve(r: ShareRequestUI, decision: 'approve' | 'reject'): Promise<void> {
  try {
    await api.db.link.requestResolve(r.id, decision)
    await load()
  } catch (err) {
    console.error('[Component] ReferenceProjectsPanel 审批共享请求失败:', err)
  }
}

async function load(): Promise<void> {
  if (props.projectId === null) return
  const [linkRows, received, sent] = await Promise.all([
    api.db.link.list(props.projectId),
    api.db.link.requestList(props.projectId, false),
    api.db.link.requestList(props.projectId, true)
  ])
  links.value = (linkRows as ProjectLinkUI[]) ?? []
  receivedRequests.value = (received as ShareRequestUI[]) ?? []
  myRequests.value = (sent as ShareRequestUI[]) ?? []
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.panel { height: 100%; overflow-y: auto; }
.panel-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 14px; }
.panel-body { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.card { padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface-alt); }
.card h3 { margin: 0 0 10px; font-size: 13.5px; font-weight: 700; color: var(--color-text); }
.card-hint { margin: -6px 0 10px; font-size: 11.5px; color: var(--color-text-muted); line-height: 1.6; }
.card-hint b { color: var(--color-accent-ink); }
.links { display: flex; flex-direction: column; gap: 8px; }
.link { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; }
.link-main { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.link-main b { font-size: 12.5px; color: var(--color-text); }
.link-scope { padding: 2px 8px; border-radius: 6px; font-size: 11px; }
.link-scope.documents { color: var(--color-text-muted); background: var(--color-surface); }
.link-scope.summaries { color: var(--color-accent-ink); background: rgba(56, 189, 248, 0.12); }
.link-scope.all { color: var(--color-primary); background: rgba(99, 102, 241, 0.12); }
.link-scope.approved { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.link-scope.rejected, .link-scope.bad { color: var(--color-danger); background: rgba(244, 63, 94, 0.12); }
.link-del, .add-btn {
  flex-shrink: 0; padding: 5px 12px; border: 1px solid var(--color-border); border-radius: 8px;
  background: transparent; color: var(--color-text-muted); font-size: 12px; cursor: pointer; transition: all var(--transition-fast);
}
.link-del:hover { color: var(--color-danger); border-color: var(--color-danger); }
.add-link { display: flex; gap: 8px; margin-top: 10px; }
.add-input {
  flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px;
  background: var(--color-surface); color: var(--color-text); font-size: 12.5px; outline: none;
}
.add-input:focus { border-color: var(--color-primary-light); }
.add-btn {
  border-color: var(--color-primary-light); color: var(--color-primary);
}
.add-btn:hover:not(:disabled) { background: rgba(99, 102, 241, 0.1); }
.add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.req-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; padding: 12px; border: 1px dashed var(--color-border); border-radius: 12px; }
.reqs { display: flex; flex-direction: column; gap: 8px; }
.req { padding: 10px; border: 1px solid var(--color-border); border-radius: 10px; }
.req.rejected { opacity: 0.7; }
.req-main { display: flex; align-items: center; gap: 8px; }
.req-main b { font-size: 12.5px; color: var(--color-text); }
.req-status { padding: 2px 8px; border-radius: 6px; font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); }
.req-status.approved { color: var(--color-success); background: rgba(34, 197, 94, 0.12); }
.req-status.rejected { color: var(--color-danger); background: rgba(244, 63, 94, 0.12); }
.req-reason { margin: 6px 0 0; font-size: 12px; color: var(--color-text-muted); }
.req-actions { display: flex; gap: 8px; margin-top: 8px; }
.req-btn { padding: 5px 14px; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; }
.req-btn.approve { background: linear-gradient(135deg, #10b981, #06b6d4); }
.req-btn.reject { background: var(--color-surface); color: var(--color-danger); border: 1px solid rgba(244, 63, 94, 0.4); }
.muted { color: var(--color-text-muted); font-size: 12.5px; }
</style>
