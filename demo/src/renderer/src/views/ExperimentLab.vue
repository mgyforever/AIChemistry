<template>
  <div ref="rootRef" class="lab-page">
    <!-- 背景装饰 -->
    <div class="lab-bg">
      <div class="bg-glow glow-1"></div>
      <div class="bg-glow glow-2"></div>
      <div class="bg-lattice"></div>
    </div>

    <LabTopBar title="实验管理台">
      <template #actions>
        <button class="tb-create" type="button" @click="showCreate = true">
          <LabIcon name="plus" />
          <span>新建实验</span>
        </button>
      </template>
    </LabTopBar>

    <main ref="mainRef" class="lab-main">
      <!-- 标题区 -->
      <section class="hero">
        <div class="hero-copy">
          <p class="hero-tag">AI · CHEM · LAB</p>
          <h1 class="hero-title">化学实验管理台</h1>
          <p class="hero-sub">
            自由设计你的每一次实验：自定义阶段与事件，组建实验小组，邀请同伴共同完成。
          </p>
        </div>
        <div class="hero-tools">
          <div class="search-box">
            <LabIcon name="search" />
            <input v-model.trim="search" type="text" placeholder="搜索实验名称或标签…" />
          </div>
        </div>
      </section>

      <!-- 统计 -->
      <section class="stats-row">
        <div v-for="s in stats" :key="s.label" class="stat-card">
          <span class="stat-icon" :style="{ background: s.bg, color: s.color }">
            <LabIcon :name="s.icon" />
          </span>
          <div class="stat-body">
            <span class="stat-value" :data-stat="s.key">{{ s.value }}</span>
            <span class="stat-label">{{ s.label }}</span>
          </div>
        </div>
      </section>

      <!-- 实验列表 -->
      <section class="section">
        <div class="section-head">
          <div class="section-title">
            <LabIcon name="flask" />
            <h2>我的实验</h2>
            <span class="count-pill">{{ filtered.length }}</span>
          </div>
          <div class="filter-tabs">
            <button
              v-for="t in filters"
              :key="t.value"
              type="button"
              :class="{ active: statusFilter === t.value }"
              @click="statusFilter = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filtered.length === 0" class="empty-state">
          <div class="empty-art">
            <LabIcon name="beaker" />
          </div>
          <h3>{{ experiments.length === 0 ? '还没有实验' : '没有符合条件的实验' }}</h3>
          <p>{{ experiments.length === 0 ? '点击右上角「新建实验」，开始搭建你的第一场化学实验吧。' : '尝试调整搜索关键词或筛选条件。' }}</p>
          <button v-if="experiments.length === 0" class="empty-cta" type="button" @click="showCreate = true">
            <LabIcon name="plus" /> 新建实验
          </button>
        </div>

        <!-- 实验卡片 -->
        <div v-else class="exp-grid">
          <article
            v-for="(exp, i) in filtered"
            :key="exp.id"
            class="exp-card"
            :class="{ 'card-enter': entered }"
            :style="{ '--exp-color': exp.color, transitionDelay: `${i * 40}ms` }"
            role="button"
            tabindex="0"
            @click="open(exp.id)"
            @keydown.enter="open(exp.id)"
          >
            <div class="exp-card-top">
              <div class="exp-name">
                <span class="exp-dot" :style="{ background: exp.color }"></span>
                <h3>{{ exp.name }}</h3>
              </div>
              <div class="exp-actions">
                <span class="status-badge" :class="exp.status">
                  <span class="status-dot" :style="statusColor(exp.status)"></span>
                  {{ STATUS_META[exp.status].label }}
                </span>
                <button
                  class="card-menu"
                  type="button"
                  aria-label="更多操作"
                  @click.stop="menuFor = menuFor === exp.id ? '' : exp.id"
                >
                  <LabIcon name="dots" />
                </button>
                <div v-if="menuFor === exp.id" class="menu-pop">
                  <button type="button" @click.stop="askDelete(exp)">
                    <LabIcon name="trash" /> 删除实验
                  </button>
                </div>
              </div>
            </div>

            <p class="exp-desc">{{ exp.description || '暂无简介' }}</p>

            <div class="exp-tags">
              <span v-for="t in exp.tags" :key="t" class="tag">{{ t }}</span>
            </div>

            <div class="exp-progress">
              <div class="progress-head">
                <span>阶段进度</span>
                <span class="progress-num">{{ progressOf(exp) }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: `${progressOf(exp)}%`, background: exp.color }"></div>
              </div>
              <div class="progress-meta">
                <span>{{ exp.stages.length }} 个阶段 · {{ countEvents(exp) }} 个事件</span>
                <span>{{ doneEvents(exp) }} 已完成</span>
              </div>
            </div>

            <div class="exp-card-foot">
              <div class="avatar-stack">
                <span
                  v-for="m in exp.members.slice(0, 4)"
                  :key="m.id"
                  class="mini-avatar"
                  :style="{ background: m.avatarColor, zIndex: 10 - (exp.members.indexOf(m) || 0) }"
                  :title="m.name"
                >
                  {{ m.name.charAt(0) }}
                </span>
                <span v-if="exp.members.length > 4" class="mini-avatar more">
                  +{{ exp.members.length - 4 }}
                </span>
              </div>
              <span class="foot-meta">
                <LabIcon name="clock" /> 约 {{ exp.estimatedMinutes }} 分钟
              </span>
            </div>
          </article>

          <!-- 新建卡片 -->
          <button class="exp-card add-card" type="button" @click="showCreate = true">
            <span class="add-circle"><LabIcon name="plus" /></span>
            <span class="add-text">新建化学实验</span>
            <span class="add-sub">自由编排阶段与事件</span>
          </button>
        </div>
      </section>

      <!-- 实验小组 -->
      <section class="section" v-if="groupCards.length > 0">
        <div class="section-head">
          <div class="section-title">
            <LabIcon name="users" />
            <h2>实验小组</h2>
            <span class="count-pill">{{ groupCards.length }}</span>
          </div>
        </div>

        <div class="group-grid">
          <article v-for="g in groupCards" :key="g.group.id + g.exp.id" class="group-card" role="button" tabindex="0" @click="open(g.exp.id)" @keydown.enter="open(g.exp.id)">
            <div class="group-card-top">
              <span class="group-icon"><LabIcon name="users" /></span>
              <div class="group-info">
                <h3>{{ g.group.name }}</h3>
                <span class="group-exp">{{ g.exp.name }}</span>
              </div>
              <span class="group-members">{{ g.group.memberIds.length }} 人</span>
            </div>
            <p class="group-desc">{{ g.group.description || '暂无小组简介' }}</p>
            <div class="avatar-stack">
              <span
                v-for="mid in g.group.memberIds.slice(0, 6)"
                :key="mid"
                class="mini-avatar"
                :style="{ background: memberColor(g.exp, mid) }"
                :title="memberName(g.exp, mid)"
              >
                {{ (memberName(g.exp, mid) || '?').charAt(0) }}
              </span>
            </div>
          </article>
        </div>
      </section>

      <footer class="lab-foot">
        AIChemistry 实验台 · 所有数据保存在本地
        <button type="button" @click="experimentStore.resetDemo()">重置示例数据</button>
      </footer>
    </main>

    <!-- 删除确认 -->
    <div v-if="pendingDelete" class="modal-mask light-mask" @click.self="pendingDelete = null">
      <div class="confirm-panel">
        <div class="confirm-icon"><LabIcon name="trash" /></div>
        <h3>删除实验「{{ pendingDelete.name }}」？</h3>
        <p>该操作会连同所有阶段、事件与小组数据一并删除，且无法恢复。</p>
        <div class="confirm-actions">
          <button class="btn-ghost" type="button" @click="pendingDelete = null">取消</button>
          <button class="btn-danger" type="button" @click="confirmDelete">确认删除</button>
        </div>
      </div>
    </div>

    <CreateExperimentModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import LabIcon from '../components/lab/LabIcon.vue'
import LabTopBar from '../components/lab/LabTopBar.vue'
import CreateExperimentModal from '../components/lab/CreateExperimentModal.vue'
import { experimentStore, STATUS_META } from '../stores/experiments'
import type { Experiment } from '../stores/experiments'

const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const mainRef = ref<HTMLElement | null>(null)

const showCreate = ref(false)
const search = ref('')
const statusFilter = ref('all')
const menuFor = ref('')
const pendingDelete = ref<Experiment | null>(null)
const entered = ref(false)

const filters = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '进行中' },
  { value: 'draft', label: '草稿' },
  { value: 'completed', label: '已完成' }
]

const experiments = computed(() => experimentStore.experiments)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return experiments.value.filter((e) => {
    if (statusFilter.value !== 'all' && e.status !== statusFilter.value) return false
    if (!kw) return true
    return (
      e.name.toLowerCase().includes(kw) ||
      e.description.toLowerCase().includes(kw) ||
      e.tags.some((t) => t.toLowerCase().includes(kw))
    )
  })
})

const stats = computed(() => [
  {
    key: 'running',
    label: '进行中实验',
    icon: 'zap',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.14)',
    value: experiments.value.filter((e) => e.status === 'running' || e.status === 'paused').length
  },
  {
    key: 'completed',
    label: '已完成实验',
    icon: 'flag',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.14)',
    value: experiments.value.filter((e) => e.status === 'completed').length
  },
  {
    key: 'groups',
    label: '实验小组',
    icon: 'users',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.14)',
    value: experiments.value.reduce((s, e) => s + e.groups.length, 0)
  },
  {
    key: 'todo',
    label: '待办事件',
    icon: 'target',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.14)',
    value: experiments.value.reduce(
      (s, e) => s + e.stages.reduce((ss, st) => ss + st.events.filter((ev) => !ev.done).length, 0),
      0
    )
  }
])

const groupCards = computed(() =>
  experiments.value.flatMap((e) => e.groups.map((group) => ({ group, exp: e })))
)

function countEvents(exp: Experiment): number {
  return experimentStore.countEvents(exp)
}

function doneEvents(exp: Experiment): number {
  return experimentStore.countDone(exp)
}

function progressOf(exp: Experiment): number {
  const total = experimentStore.countEvents(exp)
  if (total === 0) return 0
  return Math.round((experimentStore.countDone(exp) / total) * 100)
}

function statusColor(status: Experiment['status']): { background: string } {
  const map: Record<Experiment['status'], string> = {
    draft: '#94a3b8',
    running: '#06b6d4',
    paused: '#f59e0b',
    completed: '#10b981'
  }
  return { background: map[status] }
}

function memberName(exp: Experiment, memberId: string): string {
  return experimentStore.getMember(exp, memberId)?.name || '未知'
}

function memberColor(exp: Experiment, memberId: string): string {
  return experimentStore.getMember(exp, memberId)?.avatarColor || '#64748b'
}

function open(id: string): void {
  router.push(`/lab/${id}`)
}

function askDelete(exp: Experiment): void {
  pendingDelete.value = exp
  menuFor.value = ''
}

function confirmDelete(): void {
  if (pendingDelete.value) experimentStore.deleteExperiment(pendingDelete.value.id)
  pendingDelete.value = null
}

function onCreated(exp: Experiment): void {
  showCreate.value = false
  router.push(`/lab/${exp.id}`)
}

let mm: gsap.MatchMedia | null = null

onMounted(() => {
  entered.value = true
  requestAnimationFrame(() => {
    if (!mainRef.value || !rootRef.value) return
    mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.hero-copy > *', { y: 16, autoAlpha: 0, duration: 0.55, stagger: 0.08 }, 0.05)
        .from('.hero-tools', { y: 14, autoAlpha: 0, duration: 0.45 }, '-=0.35')
        .from('.stat-card', { y: 18, autoAlpha: 0, duration: 0.5, stagger: 0.07 }, '-=0.25')
        .from('.section-head', { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.1 }, '-=0.2')
        .from('.exp-card', { y: 24, autoAlpha: 0, duration: 0.5, stagger: 0.05 }, '-=0.25')
        .from('.group-card', { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, '-=0.2')
        .from('.lab-foot', { autoAlpha: 0, duration: 0.4 }, '-=0.1')

      // 统计数字滚动
      document.querySelectorAll<HTMLElement>('[data-stat]').forEach((el) => {
        const target = Number(el.dataset.stat ? stats.value.find((s) => s.key === el.dataset.stat)?.value ?? 0 : 0)
        const obj = { v: 0 }
        gsap.to(obj, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          delay: 0.3,
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v))
          }
        })
      })
    })
  })
})

onBeforeUnmount(() => {
  mm?.revert()
})
</script>

<style scoped>
.lab-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ================= 背景 ================= */
.lab-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background: var(--color-surface);
}
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.5;
}
.glow-1 {
  width: 520px;
  height: 520px;
  top: -160px;
  left: -120px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%);
}
.glow-2 {
  width: 480px;
  height: 480px;
  bottom: -180px;
  right: -100px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 70%);
}
.bg-lattice {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpath d='M30 7.5L90 7.5L120 52L90 96.5L30 96.5L0 52Z' fill='none' stroke='%236366f1' stroke-width='1'/%3E%3C/svg%3E");
  background-size: 120px 104px;
  opacity: 0.05;
}

.lab-main {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 28px 40px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
}

/* ================= 标题区 ================= */
.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.hero-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.4em;
  color: var(--color-accent);
  margin: 0 0 8px;
}
.hero-title {
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin: 0 0 6px;
}
.hero-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 520px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 9px;
  width: min(320px, 100%);
  height: 42px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--lab-glass);
  color: var(--color-text-muted);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.search-box:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);
}
.search-box svg {
  width: 16px;
  height: 16px;
}
.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
}
.search-box input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* ================= 统计 ================= */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 30px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 16px;
  background: var(--lab-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}
.stat-card:hover {
  border-color: var(--color-border);
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  font-size: 19px;
}
.stat-body {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ================= 区块 ================= */
.section {
  margin-bottom: 34px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 9px;
}
.section-title svg {
  width: 18px;
  height: 18px;
  color: var(--color-accent);
}
.section-title h2 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin: 0;
}
.count-pill {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 2px 10px;
}
.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
}
.filter-tabs button {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.filter-tabs button:hover {
  color: var(--color-text);
}
.filter-tabs button.active {
  background: var(--color-text);
  color: var(--color-surface);
  font-weight: 600;
}

/* ================= 空状态 ================= */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 54px 24px;
  border: 1px dashed var(--color-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-surface-alt) 60%, transparent);
}
.empty-art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  font-size: 28px;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  margin-bottom: 16px;
}
.empty-state h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 6px;
}
.empty-state p {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0 0 18px;
}
.empty-cta {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  background: linear-gradient(120deg, var(--color-primary), var(--color-accent));
}

/* ================= 实验卡片 ================= */
.exp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.exp-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 18px;
  background: var(--lab-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: border-color var(--transition-normal), transform var(--transition-normal), box-shadow var(--transition-normal);
}
.exp-card:hover {
  border-color: color-mix(in srgb, var(--exp-color) 55%, var(--color-border));
  transform: translateY(-3px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
}
.exp-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.exp-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.exp-name {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.exp-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 10px color-mix(in srgb, var(--exp-color) 70%, transparent);
}
.exp-name h3 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.exp-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.card-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 15px;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.card-menu:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}
.menu-pop {
  position: absolute;
  right: 0;
  top: 32px;
  z-index: 20;
  min-width: 128px;
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  background: var(--color-surface);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
  animation: pop-in 0.15s ease;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.97);
  }
}
.menu-pop button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--color-danger);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.menu-pop button:hover {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}
.menu-pop button svg {
  width: 15px;
  height: 15px;
}

.exp-desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--color-text-muted);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 41px;
}

.exp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--exp-color) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--exp-color) 22%, transparent);
}

.exp-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.progress-num {
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition-normal);
}
.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-muted);
}

.exp-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 4px;
}
.avatar-stack {
  display: flex;
}
.mini-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  border: 2px solid var(--color-surface);
  margin-left: -7px;
  background-image: linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.22));
}
.mini-avatar:first-child {
  margin-left: 0;
}
.mini-avatar.more {
  background: var(--color-text-muted);
}
.foot-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.foot-meta svg {
  width: 13px;
  height: 13px;
}

/* 新建卡片 */
.add-card {
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-style: dashed;
  border-color: var(--color-border);
  background: color-mix(in srgb, var(--color-surface-alt) 55%, transparent);
  min-height: 200px;
}
.add-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-accent);
}
.add-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 20px;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  border: 1.5px dashed color-mix(in srgb, var(--color-accent) 45%, transparent);
}
.add-text {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}
.add-sub {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ================= 小组卡片 ================= */
.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.group-card {
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 18px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 18px;
  background: var(--lab-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  transition: border-color var(--transition-normal), transform var(--transition-normal), box-shadow var(--transition-normal);
}
.group-card:hover {
  border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
  transform: translateY(-3px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
}
.group-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  font-size: 17px;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  flex-shrink: 0;
}
.group-info {
  flex: 1;
  min-width: 0;
}
.group-info h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-exp {
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.group-members {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  padding: 3px 9px;
  border-radius: 999px;
  flex-shrink: 0;
}
.group-desc {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
}

.lab-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 18px 0 6px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.lab-foot button {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 11.5px;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.lab-foot button:hover {
  color: var(--color-accent);
}

/* ================= 删除确认 ================= */
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: mask-in 0.25s ease;
}
@keyframes mask-in {
  from {
    opacity: 0;
  }
}
.confirm-panel {
  width: min(400px, 100%);
  padding: 26px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 20px;
  background: var(--color-surface);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  text-align: center;
}
.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 16px;
  font-size: 22px;
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}
.confirm-panel h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
}
.confirm-panel p {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0 0 20px;
}
.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.btn-ghost,
.btn-danger {
  height: 38px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-ghost {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
}
.btn-ghost:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}
.btn-danger {
  border: none;
  color: #fff;
  background: linear-gradient(120deg, #f43f5e, #ef4444);
}
.btn-danger:hover {
  filter: brightness(1.07);
}

/* ================= 响应式 ================= */
@media (max-width: 1100px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .lab-main {
    padding: 16px 16px 32px;
  }
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .search-box {
    width: 100%;
  }
}
</style>
