<template>
  <div v-if="exp" ref="rootRef" class="build-page">
    <!-- 背景装饰 -->
    <div class="build-bg">
      <div class="bg-glow g1"></div>
      <div class="bg-glow g2"></div>
      <div class="bg-lattice"></div>
    </div>

    <LabTopBar title="实验构建器" back-to="/lab">
      <template #actions>
        <div class="status-chip" :class="exp.status" :style="{ borderColor: statusColor(exp.status), color: statusColor(exp.status) }">
          <span class="status-dot" :style="{ background: statusColor(exp.status) }"></span>
          {{ STATUS_META[exp.status].label }}
        </div>

        <div class="mode-switch" role="tablist" aria-label="编辑或执行模式">
          <button type="button" :class="{ active: !execMode }" role="tab" :aria-selected="!execMode" @click="execMode = false">
            <LabIcon name="pencil" /> 编辑
          </button>
          <button type="button" :class="{ active: execMode }" role="tab" :aria-selected="execMode" @click="execMode = true">
            <LabIcon name="play" /> 执行
          </button>
        </div>

        <button class="tb-invite" type="button" @click="showInvite = true">
          <LabIcon name="userPlus" /> 邀请成员
        </button>
      </template>
    </LabTopBar>

    <main class="build-main">
      <!-- ============ 左栏：概览 + 阶段时间线 ============ -->
      <aside class="col col-left">
        <!-- 实验概览 -->
        <div class="overview-card">
          <div class="ov-head">
            <span class="ov-dot" :style="{ background: exp.color }"></span>
            <input
              class="ov-title"
              v-model="exp.name"
              type="text"
              aria-label="实验名称"
              @change="experimentStore.persist()"
            />
          </div>
          <textarea
            class="ov-desc"
            v-model="exp.description"
            rows="2"
            placeholder="实验简介…"
            aria-label="实验简介"
            @change="experimentStore.persist()"
          ></textarea>
          <div class="ov-tags">
            <span v-for="t in exp.tags" :key="t" class="ov-tag">{{ t }}</span>
          </div>
          <div class="ov-meta">
            <label class="ov-field">
              <span>安全等级</span>
              <select v-model="exp.safetyLevel" @change="experimentStore.persist()">
                <option value="low">低风险</option>
                <option value="medium">中风险</option>
                <option value="high">高风险</option>
              </select>
            </label>
            <label class="ov-field">
              <span>状态</span>
              <select v-model="exp.status" @change="experimentStore.persist()">
                <option value="draft">草稿</option>
                <option value="running">进行中</option>
                <option value="paused">已暂停</option>
                <option value="completed">已完成</option>
              </select>
            </label>
          </div>
        </div>

        <!-- 阶段时间线 -->
        <div class="rail-head">
          <span class="rail-title"><LabIcon name="layers" /> 实验阶段</span>
          <span class="rail-count">{{ exp.stages.length }}</span>
        </div>

        <div class="stage-rail">
          <div
            v-for="(stage, i) in exp.stages"
            :key="stage.id"
            class="stage-item"
            :class="{
              active: stage.id === selectedStageId,
              'drop-target': stageDropIndex === i,
              dragging: stageDragIndex === i
            }"
            @click="selectStage(stage.id)"
            @dragover.prevent="stageDropIndex = i"
            @drop.prevent="dropStage(i)"
            @dragleave="stageDropIndex = null"
          >
            <div class="stage-rail-col">
              <span class="rail-line" :class="{ hidden: i === 0 }"></span>
              <span class="stage-node" :style="nodeStyle(stage)">
                <LabIcon v-if="stageDone(stage) && stage.events.length > 0" name="check" />
              </span>
              <span class="rail-line" :class="{ hidden: i === exp.stages.length - 1 }"></span>
            </div>

            <div class="stage-body">
              <div class="stage-body-top">
                <span class="stage-name">{{ stage.name }}</span>
                <span class="stage-num">{{ stageDoneCount(stage) }}/{{ stage.events.length }}</span>
              </div>
              <div class="stage-bar">
                <span class="stage-bar-fill" :style="{ width: stagePct(stage) + '%', background: stage.color }"></span>
              </div>
            </div>

            <span
              class="drag-handle"
              draggable="true"
              title="拖拽调整顺序"
              @dragstart="onStageDragStart($event, i)"
              @dragend="resetStageDrag"
            >
              <LabIcon name="grip" />
            </span>
          </div>

          <div v-if="exp.stages.length === 0" class="rail-empty">
            暂无阶段，点击下方按钮添加
          </div>
        </div>

        <button class="add-stage-btn" type="button" @click="addStage">
          <LabIcon name="plus" /> 添加阶段
        </button>
      </aside>

      <!-- ============ 中栏：阶段详情 ============ -->
      <section class="col col-center">
        <template v-if="selectedStage">
          <!-- 阶段头 -->
          <div class="stage-head">
            <div class="sh-main">
              <div class="sh-title-row">
                <input
                  class="sh-title"
                  v-model="selectedStage.name"
                  type="text"
                  aria-label="阶段名称"
                  @change="experimentStore.persist()"
                />
                <span class="sh-badge" :style="{ background: colorMix(selectedStage.color, 0.14), color: selectedStage.color }">
                  {{ selectedStage.events.length }} 个事件
                </span>
              </div>
              <textarea
                class="sh-desc"
                v-model="selectedStage.description"
                rows="2"
                placeholder="描述该阶段的目的、注意事项…"
                aria-label="阶段描述"
                @change="experimentStore.persist()"
              ></textarea>
            </div>
            <div class="sh-side">
              <label class="sh-duration">
                <LabIcon name="clock" />
                <input v-model.number="selectedStage.expectedMinutes" type="number" min="1" max="600" aria-label="预计时长" @change="experimentStore.persist()" />
                <span>分钟</span>
              </label>
              <div v-if="!execMode" class="sh-colors">
                <button
                  v-for="c in STAGE_COLORS"
                  :key="c"
                  type="button"
                  class="color-dot"
                  :class="{ active: selectedStage.color === c }"
                  :style="{ background: c }"
                  :aria-label="`阶段颜色 ${c}`"
                  @click="selectedStage.color = c; experimentStore.persist()"
                ></button>
              </div>
            </div>
          </div>

          <!-- 执行模式进度 -->
          <div v-if="execMode" class="exec-progress">
            <div class="exec-progress-head">
              <span><LabIcon name="zap" /> 实验执行中</span>
              <span class="exec-pct">{{ expProgress }}%</span>
            </div>
            <div class="exec-track">
              <div class="exec-fill" :style="{ width: expProgress + '%', background: exp.color }"></div>
            </div>
            <div class="exec-hint">点击事件圆钮标记完成，全部完成即可推进下一阶段</div>
          </div>

          <!-- 事件列表 -->
          <div class="events-wrap">
            <transition-group name="evt" tag="div" class="events-list">
              <div
                v-for="(ev, i) in selectedStage.events"
                :key="ev.id"
                class="event-card"
                :class="{ done: ev.done, expanded: expandedEvents.has(ev.id), 'drop-target': eventDropIndex === i }"
                :style="{ '--evt-color': EVENT_TYPES[ev.type].color }"
                @dragover.prevent="eventDropIndex = i"
                @drop.prevent="dropEvent(i)"
                @dragleave="eventDropIndex = null"
              >
                <span
                  class="drag-handle evt-handle"
                  draggable="true"
                  title="拖拽调整顺序"
                  @dragstart="onEventDragStart($event, i)"
                  @dragend="resetEventDrag"
                >
                  <LabIcon name="grip" />
                </span>

                <button
                  class="evt-check"
                  type="button"
                  :aria-label="ev.done ? '标记为未完成' : '标记为已完成'"
                  @click="toggleDone(ev, $event)"
                >
                  <span class="check-bg" :style="{ borderColor: EVENT_TYPES[ev.type].color }">
                    <LabIcon v-if="ev.done" name="check" />
                  </span>
                </button>

                <span class="evt-type" :style="{ background: colorMix(EVENT_TYPES[ev.type].color, 0.13), color: EVENT_TYPES[ev.type].color }" :title="EVENT_TYPES[ev.type].label">
                  <LabIcon :name="EVENT_TYPES[ev.type].icon" />
                </span>

                <div class="evt-main">
                  <div class="evt-title-row">
                    <input
                      class="evt-title"
                      v-model="ev.title"
                      type="text"
                      aria-label="事件名称"
                      @change="experimentStore.persist()"
                    />
                    <span class="evt-type-label" :style="{ color: EVENT_TYPES[ev.type].color }">{{ EVENT_TYPES[ev.type].label }}</span>
                  </div>
                  <p class="evt-desc">{{ ev.description }}</p>
                  <div v-if="ev.params" class="evt-params"><span>参数</span>{{ ev.params }}</div>
                  <div v-if="ev.expected" class="evt-expected"><span>预期</span>{{ ev.expected }}</div>

                  <!-- 展开编辑 -->
                  <div v-if="expandedEvents.has(ev.id) && !execMode" class="evt-edit">
                    <label>
                      <span>描述</span>
                      <textarea v-model="ev.description" rows="2" placeholder="事件的详细描述…" @change="experimentStore.persist()"></textarea>
                    </label>
                    <div class="evt-edit-grid">
                      <label>
                        <span>关键参数</span>
                        <input v-model="ev.params" type="text" placeholder="如：NaCl 5.0g · 60mL 水" @change="experimentStore.persist()" />
                      </label>
                      <label>
                        <span>预期结果</span>
                        <input v-model="ev.expected" type="text" placeholder="希望观察到的现象或数据" @change="experimentStore.persist()" />
                      </label>
                    </div>
                    <label>
                      <span>备注</span>
                      <input v-model="ev.note" type="text" placeholder="额外提示或注意事项…" @change="experimentStore.persist()" />
                    </label>
                  </div>
                </div>

                <button
                  v-if="!execMode"
                  class="evt-expand"
                  type="button"
                  :aria-label="expandedEvents.has(ev.id) ? '收起' : '展开编辑'"
                  @click="toggleExpand(ev.id)"
                >
                  <LabIcon :name="expandedEvents.has(ev.id) ? 'chevronDown' : 'chevronRight'" />
                </button>

                <div v-if="!execMode" class="evt-menu-wrap">
                  <button class="evt-menu" type="button" aria-label="更多操作" @click.stop="eventMenuFor = eventMenuFor === ev.id ? '' : ev.id">
                    <LabIcon name="dots" />
                  </button>
                  <div v-if="eventMenuFor === ev.id" class="menu-pop">
                    <button type="button" @click="moveEvent(ev.id, -1)"><LabIcon name="arrowUp" /> 上移</button>
                    <button type="button" @click="moveEvent(ev.id, 1)"><LabIcon name="arrowDown" /> 下移</button>
                    <button type="button" @click="dupEvent(ev)"><LabIcon name="copy" /> 复制</button>
                    <button type="button" class="danger" @click="delEvent(ev)"><LabIcon name="trash" /> 删除</button>
                  </div>
                </div>
              </div>
            </transition-group>

            <!-- 添加事件 -->
            <div class="add-event-row">
              <button class="add-event-btn" type="button" @click="typeMenuOpen = !typeMenuOpen">
                <LabIcon name="plus" /> 添加事件
              </button>
              <div v-if="typeMenuOpen" class="type-menu">
                <button
                  v-for="t in EVENT_TYPE_ORDER"
                  :key="t"
                  type="button"
                  @click="addEventOfType(t)"
                >
                  <span class="type-ico" :style="{ background: colorMix(EVENT_TYPES[t].color, 0.13), color: EVENT_TYPES[t].color }">
                    <LabIcon :name="EVENT_TYPES[t].icon" />
                  </span>
                  <span class="type-name">{{ EVENT_TYPES[t].label }}</span>
                  <span class="type-desc">{{ typeDesc[t] }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="center-empty">
          <div class="center-empty-art"><LabIcon name="layers" /></div>
          <h3>还没有阶段</h3>
          <p>先添加一个阶段，再为阶段规划事件。</p>
          <button type="button" class="empty-cta" @click="addStage"><LabIcon name="plus" /> 添加阶段</button>
        </div>
      </section>

      <!-- ============ 右栏：成员与小组 ============ -->
      <aside class="col col-right">
        <div class="r-section">
          <div class="r-head">
            <span class="r-title"><LabIcon name="users" /> 参与成员</span>
            <button class="r-add" type="button" aria-label="邀请成员" title="邀请成员" @click="showInvite = true">
              <LabIcon name="userPlus" />
            </button>
          </div>

          <div class="member-list">
            <div v-for="m in exp.members" :key="m.id" class="member-row">
              <span class="member-avatar" :style="{ background: m.avatarColor }">
                {{ m.name.charAt(0) }}
                <span class="online-dot" :class="{ on: m.online }"></span>
              </span>
              <div class="member-info">
                <span class="member-name">{{ m.name }}</span>
                <span class="member-sub">{{ m.invited ? '待接受邀请' : (m.online ? '在线' : '离线') }}</span>
              </div>
              <select
                class="role-select"
                :value="m.role"
                :disabled="m.id === 'u-me'"
                aria-label="成员角色"
                @change="setRole(m, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="(meta, r) in ROLE_META" :key="r" :value="r">{{ meta.label }}</option>
              </select>
              <button
                v-if="m.id !== 'u-me'"
                class="member-remove"
                type="button"
                aria-label="移除成员"
                title="移除成员"
                @click="removeMember(m)"
              >
                <LabIcon name="x" />
              </button>
            </div>
          </div>
        </div>

        <div class="r-section">
          <div class="r-head">
            <span class="r-title"><LabIcon name="hexagon" /> 实验小组</span>
            <button class="r-add" type="button" aria-label="新建小组" title="新建小组" @click="newGroupOpen = true">
              <LabIcon name="plus" />
            </button>
          </div>

          <!-- 新建小组 -->
          <div v-if="newGroupOpen" class="group-new">
            <input v-model="newGroupName" type="text" placeholder="小组名称，如：滴定小组 A" />
            <input v-model="newGroupDesc" type="text" placeholder="小组职责（可选）" />
            <div class="group-new-actions">
              <button type="button" class="tiny-ghost" @click="newGroupOpen = false">取消</button>
              <button type="button" class="tiny-primary" @click="createGroup">创建</button>
            </div>
          </div>

          <div v-if="exp.groups.length === 0" class="group-empty">
            尚未建立小组，点击右上角 + 创建
          </div>

          <div v-for="g in exp.groups" :key="g.id" class="group-box">
            <div class="group-box-head">
              <input class="g-name" v-model="g.name" type="text" aria-label="小组名称" @change="experimentStore.persist()" />
              <button class="g-del" type="button" aria-label="删除小组" @click="experimentStore.removeGroup(exp.id, g.id)">
                <LabIcon name="trash" />
              </button>
            </div>
            <input class="g-desc" v-model="g.description" type="text" placeholder="小组职责…" aria-label="小组简介" @change="experimentStore.persist()" />

            <div class="g-members">
              <span v-for="mid in g.memberIds" :key="mid" class="g-chip">
                <span class="g-chip-avatar" :style="{ background: memberOf(mid)?.avatarColor }">{{ (memberOf(mid)?.name || '?').charAt(0) }}</span>
                {{ memberOf(mid)?.name }}
                <button type="button" aria-label="移出小组" @click="experimentStore.toggleGroupMember(exp.id, g.id, mid)">
                  <LabIcon name="x" />
                </button>
              </span>
              <button class="g-add" type="button" @click="togglePicker(g.id)">
                <LabIcon name="plus" /> 成员
              </button>
            </div>

            <div v-if="groupPicker === g.id" class="g-picker">
              <button
                v-for="m in exp.members"
                :key="m.id"
                type="button"
                :class="{ in: g.memberIds.includes(m.id) }"
                @click="experimentStore.toggleGroupMember(exp.id, g.id, m.id)"
              >
                <span class="g-picker-avatar" :style="{ background: m.avatarColor }">{{ m.name.charAt(0) }}</span>
                {{ m.name }}
                <LabIcon v-if="g.memberIds.includes(m.id)" name="check" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <!-- 弹窗 -->
    <InviteMemberModal v-if="showInvite && exp" :exp="exp" @close="showInvite = false" />

    <!-- Toast -->
    <div class="toast-layer">
      <transition-group name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast">{{ t.msg }}</div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import LabIcon from '../components/lab/LabIcon.vue'
import LabTopBar from '../components/lab/LabTopBar.vue'
import InviteMemberModal from '../components/lab/InviteMemberModal.vue'
import {
  experimentStore,
  EVENT_TYPES,
  EVENT_TYPE_ORDER,
  STAGE_COLORS,
  ROLE_META,
  STATUS_META
} from '../stores/experiments'
import type { Experiment, EventItem, Member, Stage, EventType } from '../stores/experiments'

const route = useRoute()
const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)

const expId = computed(() => String(route.params.id))
const exp = computed<Experiment | undefined>(() => experimentStore.getById(expId.value))

const selectedStageId = ref('')
const selectedStage = computed<Stage | undefined>(() => exp.value?.stages.find((s) => s.id === selectedStageId.value))

const execMode = ref(false)
const showInvite = ref(false)
const typeMenuOpen = ref(false)
const expandedEvents = ref(new Set<string>())
const eventMenuFor = ref('')

/* 拖拽状态 */
const stageDragIndex = ref<number | null>(null)
const stageDropIndex = ref<number | null>(null)
const eventDragIndex = ref<number | null>(null)
const eventDropIndex = ref<number | null>(null)

/* 小组 */
const newGroupOpen = ref(false)
const newGroupName = ref('')
const newGroupDesc = ref('')
const groupPicker = ref('')

/* Toast */
const toasts = ref<{ id: number; msg: string }[]>([])
let toastSeq = 0

const typeDesc: Record<EventType, string> = {
  operation: '动手操作步骤',
  reagent: '添加试剂与药品',
  observation: '观察记录现象',
  measurement: '测量读数数据',
  record: '填写数据与结论',
  safety: '安全规范检查'
}

/* ================= 计算 ================= */

function stageDoneCount(stage: Stage): number {
  return stage.events.filter((e) => e.done).length
}

function stagePct(stage: Stage): number {
  if (stage.events.length === 0) return 0
  return Math.round((stageDoneCount(stage) / stage.events.length) * 100)
}

function stageDone(stage: Stage): boolean {
  return stage.events.length > 0 && stage.events.every((e) => e.done)
}

const expProgress = computed(() => {
  if (!exp.value) return 0
  const total = experimentStore.countEvents(exp.value)
  if (total === 0) return 0
  return Math.round((experimentStore.countDone(exp.value) / total) * 100)
})

function nodeStyle(stage: Stage): Record<string, string> {
  const done = stageDone(stage)
  return {
    background: done ? stage.color : stage.id === selectedStageId.value ? stage.color : 'var(--color-surface-alt)',
    borderColor: stage.color,
    boxShadow: stage.id === selectedStageId.value ? `0 0 0 4px ${stage.color}33` : 'none'
  }
}

function colorMix(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function statusColor(status: Experiment['status']): string {
  const map: Record<Experiment['status'], string> = {
    draft: '#94a3b8',
    running: '#06b6d4',
    paused: '#f59e0b',
    completed: '#10b981'
  }
  return map[status]
}

function memberOf(memberId: string): Member | undefined {
  return exp.value ? experimentStore.getMember(exp.value, memberId) : undefined
}

/* ================= 阶段操作 ================= */

function selectStage(id: string): void {
  selectedStageId.value = id
  eventMenuFor.value = ''
  typeMenuOpen.value = false
  animateEvents()
}

function addStage(): void {
  if (!exp.value) return
  console.log('[View] 添加阶段, 实验ID:', exp.value.id)
  const stage = experimentStore.addStage(exp.value.id)
  selectedStageId.value = stage.id
  typeMenuOpen.value = false
  notify(`已添加阶段「${stage.name}」`)
  animateEvents()
}

function onStageDragStart(e: DragEvent, i: number): void {
  stageDragIndex.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i))
  }
}

function resetStageDrag(): void {
  stageDragIndex.value = null
  stageDropIndex.value = null
}

function dropStage(i: number): void {
  if (stageDragIndex.value !== null && stageDragIndex.value !== i && exp.value) {
    experimentStore.moveStage(exp.value.id, stageDragIndex.value, i)
  }
  resetStageDrag()
}

/* ================= 事件操作 ================= */

function toggleExpand(id: string): void {
  const s = new Set(expandedEvents.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedEvents.value = s
}

function onEventDragStart(e: DragEvent, i: number): void {
  eventDragIndex.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i))
  }
}

function resetEventDrag(): void {
  eventDragIndex.value = null
  eventDropIndex.value = null
}

function dropEvent(i: number): void {
  if (eventDragIndex.value !== null && eventDragIndex.value !== i && exp.value && selectedStage.value) {
    experimentStore.moveEvent(exp.value.id, selectedStage.value.id, eventDragIndex.value, i)
  }
  resetEventDrag()
}

function addEventOfType(type: EventType): void {
  if (!exp.value || !selectedStage.value) return
  console.log('[View] 添加事件, 类型:', EVENT_TYPES[type].label, '阶段:', selectedStage.value.name)
  const ev = experimentStore.addEvent(exp.value.id, selectedStage.value.id, type)
  typeMenuOpen.value = false
  expandedEvents.value = new Set(expandedEvents.value).add(ev.id)
  notify(`已添加「${EVENT_TYPES[type].label}」事件`)
}

function toggleDone(ev: EventItem, e: MouseEvent): void {
  if (!exp.value || !selectedStage.value) return
  experimentStore.toggleEvent(exp.value.id, selectedStage.value.id, ev.id)
  console.log('[View] 事件状态切换:', ev.title, '→', !ev.done ? '完成' : '未完成')

  // 勾选反馈动画（尊重减少动效偏好）
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const el = (e.currentTarget as HTMLElement).querySelector('.check-bg')
    if (el) {
      gsap.fromTo(el, { scale: 0.82 }, { scale: 1, duration: 0.32, ease: 'back.out(2.2)', overwrite: 'auto' })
    }
  }
  eventMenuFor.value = ''
}

function moveEvent(evId: string, dir: -1 | 1): void {
  if (!exp.value || !selectedStage.value) return
  const i = selectedStage.value.events.findIndex((e) => e.id === evId)
  experimentStore.moveEvent(exp.value.id, selectedStage.value.id, i, i + dir)
  eventMenuFor.value = ''
}

function dupEvent(ev: EventItem): void {
  if (!exp.value || !selectedStage.value) return
  experimentStore.duplicateEvent(exp.value.id, selectedStage.value.id, ev.id)
  eventMenuFor.value = ''
  notify('已复制事件')
}

function delEvent(ev: EventItem): void {
  if (!exp.value || !selectedStage.value) return
  experimentStore.removeEvent(exp.value.id, selectedStage.value.id, ev.id)
  eventMenuFor.value = ''
  notify('已删除事件')
}

/* ================= 成员与小组 ================= */

function setRole(m: Member, role: string): void {
  if (!exp.value) return
  experimentStore.setMemberRole(exp.value.id, m.id, role as Member['role'])
}

function removeMember(m: Member): void {
  if (!exp.value) return
  experimentStore.removeMember(exp.value.id, m.id)
  notify(`已将 ${m.name} 移出实验`)
}

function createGroup(): void {
  if (!exp.value) return
  if (!newGroupName.value.trim()) {
    notify('请填写小组名称')
    return
  }
  console.log('[View] 创建小组:', newGroupName.value.trim())
  experimentStore.addGroup(exp.value.id, newGroupName.value.trim(), newGroupDesc.value.trim())
  newGroupName.value = ''
  newGroupDesc.value = ''
  newGroupOpen.value = false
  notify('已创建小组')
}

function togglePicker(groupId: string): void {
  groupPicker.value = groupPicker.value === groupId ? '' : groupId
}

/* ================= 反馈 ================= */

function notify(msg: string): void {
  const id = ++toastSeq
  toasts.value.push({ id, msg })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 2400)
}

/* ================= 动画 ================= */

let mm: gsap.MatchMedia | null = null

function animateEvents(): void {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nextTick(() => {
      gsap.fromTo(
        '.event-card',
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' }
      )
    })
  }
}

onMounted(() => {
  if (!exp.value) {
    console.warn('[View] ExperimentBuilder 未找到实验, 实验ID:', expId.value, '，跳回 /lab')
    router.replace('/lab')
    return
  }
  console.log('[View] ExperimentBuilder 挂载, 实验ID:', exp.value.id, '阶段数:', exp.value.stages.length)
  selectedStageId.value = exp.value.stages[0]?.id ?? ''
  requestAnimationFrame(() => {
    if (!rootRef.value) return
    mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.col-left', { xPercent: -3, autoAlpha: 0, duration: 0.55 }, 0.05)
        .from('.col-center', { y: 14, autoAlpha: 0, duration: 0.55 }, 0.12)
        .from('.col-right', { xPercent: 3, autoAlpha: 0, duration: 0.55 }, 0.16)
        .from('.stage-item', { y: 14, autoAlpha: 0, duration: 0.4, stagger: 0.05 }, '-=0.3')
        .from('.event-card', { y: 16, autoAlpha: 0, duration: 0.45, stagger: 0.05 }, '-=0.35')
    })
  })
})

watch(
  () => exp.value?.id,
  () => {
    if (!exp.value) {
      router.replace('/lab')
      return
    }
    selectedStageId.value = exp.value.stages[0]?.id ?? ''
  }
)

onBeforeUnmount(() => {
  mm?.revert()
})
</script>

<style scoped>
.build-page {
  position: relative;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ================= 背景 ================= */
.build-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  background: var(--color-surface);
}
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.42;
}
.g1 {
  width: 560px;
  height: 560px;
  top: -200px;
  left: 20%;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 30%, transparent), transparent 70%);
}
.g2 {
  width: 520px;
  height: 520px;
  bottom: -220px;
  right: -80px;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%);
}
.bg-lattice {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpath d='M30 7.5L90 7.5L120 52L90 96.5L30 96.5L0 52Z' fill='none' stroke='%236366f1' stroke-width='1'/%3E%3C/svg%3E");
  background-size: 120px 104px;
  opacity: 0.045;
}

/* ================= 顶栏动作 ================= */
.status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: transparent;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.mode-switch {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
}
.mode-switch button {
  display: flex;
  align-items: center;
  gap: 6px;
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
.mode-switch button svg {
  width: 14px;
  height: 14px;
}
.mode-switch button.active {
  background: var(--color-text);
  color: var(--color-surface);
  font-weight: 600;
}

.tb-invite {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(120deg, var(--color-primary), var(--color-accent));
  box-shadow: 0 5px 16px color-mix(in srgb, var(--color-primary) 34%, transparent);
  transition: filter var(--transition-fast), box-shadow var(--transition-fast);
}
.tb-invite:hover {
  filter: brightness(1.07);
}

/* ================= 三栏布局 ================= */
.build-main {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 272px 1fr 300px;
  gap: 14px;
  padding: 14px 16px 16px;
  max-width: 1500px;
  width: 100%;
  margin: 0 auto;
}

.col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border: 1px solid var(--lab-glass-border);
  border-radius: 18px;
  background: var(--lab-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 16px;
}

/* ================= 左栏 ================= */
.col-left {
  gap: 14px;
}

.overview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}
.ov-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.ov-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 60%, transparent);
}
.ov-title {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 4px 6px;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  outline: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.ov-title:hover,
.ov-title:focus {
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}
.ov-desc {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 4px 6px;
  font-size: 12px;
  line-height: 1.6;
  font-family: inherit;
  color: var(--color-text-muted);
  outline: none;
  resize: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.ov-desc:hover,
.ov-desc:focus {
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}
.ov-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ov-tag {
  font-size: 10.5px;
  color: var(--color-text-muted);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
}
.ov-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ov-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ov-field span {
  font-size: 10.5px;
  color: var(--color-text-muted);
}
.ov-field select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rail-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-text);
}
.rail-title svg {
  width: 15px;
  height: 15px;
  color: var(--color-accent);
}
.rail-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 1px 9px;
}

.stage-rail {
  display: flex;
  flex-direction: column;
}
.stage-item {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 6px 6px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.stage-item:hover {
  background: var(--color-surface-alt);
}
.stage-item.active {
  background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface-alt));
}
.stage-item.drop-target {
  box-shadow: inset 0 2px 0 var(--color-accent);
}
.stage-item.dragging {
  opacity: 0.5;
}

.stage-rail-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}
.rail-line {
  width: 2px;
  flex: 1;
  min-height: 6px;
  background: var(--color-border);
}
.rail-line.hidden {
  visibility: hidden;
}
.stage-node {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
  transition: all var(--transition-normal);
}
.stage-node svg {
  width: 10px;
  height: 10px;
  color: #fff;
}

.stage-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 3px 0;
}
.stage-body-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.stage-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stage-num {
  font-size: 10.5px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.stage-bar {
  height: 3px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  overflow: hidden;
}
.stage-bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition-normal);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: grab;
  opacity: 0;
  align-self: center;
  font-size: 14px;
  transition: opacity var(--transition-fast), color var(--transition-fast);
  padding: 2px;
}
.stage-item:hover .drag-handle,
.event-card:hover .drag-handle {
  opacity: 0.75;
}
.drag-handle:hover {
  color: var(--color-accent);
}
.drag-handle:active {
  cursor: grabbing;
}

.rail-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 14px 8px;
  text-align: center;
}

.add-stage-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  border: 1px dashed var(--color-border);
  border-radius: 11px;
  background: transparent;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-top: 4px;
}
.add-stage-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}

/* ================= 中栏 ================= */
.col-center {
  gap: 16px;
}

.stage-head {
  display: flex;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}
.sh-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.sh-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sh-title {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  padding: 5px 8px;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
  outline: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.sh-title:hover,
.sh-title:focus {
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}
.sh-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  flex-shrink: 0;
}
.light .sh-badge {
  filter: brightness(0.62);
}
.sh-desc {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 3px 8px;
  font-size: 12.5px;
  line-height: 1.6;
  font-family: inherit;
  color: var(--color-text-muted);
  outline: none;
  resize: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.sh-desc:hover,
.sh-desc:focus {
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}
.sh-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
  flex-shrink: 0;
}
.sh-duration {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  font-size: 12px;
}
.sh-duration svg {
  width: 14px;
  height: 14px;
}
.sh-duration input {
  width: 46px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 12.5px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
.sh-colors {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.color-dot:hover {
  transform: scale(1.15);
}
.color-dot.active {
  box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent);
}

/* 执行模式进度 */
.exec-progress {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}
.exec-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
}
.exec-progress-head svg {
  width: 14px;
  height: 14px;
  color: var(--color-accent);
}
.exec-pct {
  font-variant-numeric: tabular-nums;
  color: var(--color-accent-ink);
  font-weight: 700;
}
.exec-track {
  height: 7px;
  border-radius: 999px;
  background: var(--color-surface-alt);
  overflow: hidden;
}
.exec-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--transition-normal);
}
.exec-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* 事件 */
.events-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.events-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event-card {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-alt);
  border-left: 3px solid var(--evt-color);
  transition: border-color var(--transition-fast), background-color var(--transition-fast), opacity var(--transition-normal);
}
.event-card:hover {
  border-color: var(--color-text-muted);
}
.event-card.done {
  opacity: 0.68;
}
.event-card.done .evt-title {
  text-decoration: line-through;
  text-decoration-color: var(--color-text-muted);
}
.event-card.drop-target {
  box-shadow: inset 0 2px 0 var(--color-accent);
}

.evt-handle {
  align-self: center;
}

.evt-check {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  margin-top: 2px;
  flex-shrink: 0;
}
.check-bg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: transparent;
  color: #fff;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}
.check-bg svg {
  width: 12px;
  height: 12px;
}
.evt-check:hover .check-bg {
  border-color: var(--evt-color);
  transform: scale(1.08);
}
.event-card.done .check-bg {
  background: var(--evt-color);
  border-color: var(--evt-color);
}

.evt-type {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 15px;
  flex-shrink: 0;
}

.evt-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.evt-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
}
.evt-title {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  padding: 3px 6px;
  font-size: 13.5px;
  font-weight: 650;
  color: var(--color-text);
  outline: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.evt-title:hover,
.evt-title:focus {
  border-color: var(--color-border);
  background: var(--color-surface);
}
.evt-type-label {
  font-size: 10.5px;
  font-weight: 600;
  flex-shrink: 0;
}
.evt-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
  padding: 0 6px;
}
.evt-params,
.evt-expected {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--color-text-muted);
  padding: 0 6px;
}
.evt-params span,
.evt-expected span {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.evt-edit {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 8px;
  padding: 11px;
  border: 1px dashed var(--color-border);
  border-radius: 11px;
  background: var(--color-surface);
}
.evt-edit label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.evt-edit label > span {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--color-text-muted);
}
.evt-edit input,
.evt-edit textarea {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 12.5px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.evt-edit input:focus,
.evt-edit textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 13%, transparent);
}
.evt-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.evt-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.evt-expand:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.evt-menu-wrap {
  position: relative;
  flex-shrink: 0;
}
.evt-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.evt-menu:hover {
  background: var(--color-surface);
  color: var(--color-text);
}
.menu-pop {
  position: absolute;
  right: 0;
  top: 28px;
  z-index: 30;
  min-width: 132px;
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
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.menu-pop button:hover {
  background: var(--color-surface-alt);
}
.menu-pop button.danger {
  color: var(--color-danger);
}
.menu-pop button.danger:hover {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}
.menu-pop button svg {
  width: 14px;
  height: 14px;
}

/* 添加事件 */
.add-event-row {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.add-event-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 42px;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.add-event-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}

.type-menu {
  position: absolute;
  left: 0;
  bottom: 48px;
  z-index: 30;
  width: min(340px, 100%);
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  animation: pop-in 0.16s ease;
}
.type-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.type-menu button:hover {
  background: var(--color-surface-alt);
}
.type-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  font-size: 14px;
  flex-shrink: 0;
}
.type-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
}
.type-desc {
  display: block;
  font-size: 10.5px;
  color: var(--color-text-muted);
  margin-top: 1px;
}

/* 列表过渡 */
.evt-enter-active,
.evt-leave-active {
  transition: all 0.28s ease;
}
.evt-enter-from,
.evt-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.evt-leave-active {
  position: absolute;
  width: calc(100% - 28px);
}

.center-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.center-empty-art {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  font-size: 26px;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
.center-empty h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}
.center-empty p {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0 0 8px;
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

/* ================= 右栏 ================= */
.col-right {
  gap: 18px;
}
.r-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.r-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.r-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-text);
}
.r-title svg {
  width: 15px;
  height: 15px;
  color: var(--color-accent);
}
.r-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.r-add:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  border: 1px solid transparent;
  border-radius: 11px;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
.member-row:hover {
  background: var(--color-surface-alt);
  border-color: var(--color-border);
}
.member-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background-image: linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.22));
  text-shadow: 0 1px 1px rgba(15, 23, 42, 0.4);
}
.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-text-muted);
  border: 2px solid var(--color-surface);
}
.online-dot.on {
  background: #22c55e;
}
.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.member-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.member-sub {
  font-size: 10.5px;
  color: var(--color-text-muted);
}
.role-select {
  height: 26px;
  padding: 0 5px;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 11px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}
.role-select:disabled {
  opacity: 0.6;
  cursor: default;
}
.member-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.member-remove:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

/* 小组 */
.group-empty {
  font-size: 12px;
  color: var(--color-text-muted);
  padding: 12px 8px;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: 11px;
}
.group-new {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-accent) 5%, transparent);
}
.group-new input {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.group-new input:focus {
  border-color: var(--color-accent);
}
.group-new-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}
.tiny-ghost,
.tiny-primary {
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tiny-ghost {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
}
.tiny-primary {
  border: none;
  color: #fff;
  background: var(--color-accent);
}

.group-box {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 11px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-alt);
}
.group-box-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.g-name {
  flex: 1;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  padding: 3px 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  outline: none;
}
.g-name:hover,
.g-name:focus {
  border-color: var(--color-border);
  background: var(--color-surface);
}
.g-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.g-del:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}
.g-desc {
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  padding: 3px 6px;
  font-size: 11.5px;
  color: var(--color-text-muted);
  outline: none;
}
.g-desc:hover,
.g-desc:focus {
  border-color: var(--color-border);
  background: var(--color-surface);
}
.g-members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.g-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  padding: 3px 7px 3px 4px;
  border-radius: 999px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.g-chip-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 9.5px;
  color: #fff;
  font-weight: 700;
  background-image: linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.22));
}
.g-chip button {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  padding: 0;
  cursor: pointer;
}
.g-chip button svg {
  width: 11px;
  height: 11px;
}
.g-chip button:hover {
  color: var(--color-danger);
}
.g-add {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px dashed var(--color-border);
  border-radius: 999px;
  background: transparent;
  font-size: 11px;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.g-add:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
.g-picker {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.g-picker button {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 9px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.g-picker button:hover {
  background: var(--color-surface-alt);
}
.g-picker button.in {
  color: var(--color-accent);
}
.g-picker button > svg {
  width: 13px;
  height: 13px;
  margin-left: auto;
}
.g-picker-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
  color: #fff;
  font-weight: 700;
  background-image: linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.22));
}

/* ================= Toast ================= */
.toast-layer {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toast {
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* ================= 响应式 ================= */
@media (max-width: 1240px) {
  .build-main {
    grid-template-columns: 250px 1fr 270px;
  }
}
@media (max-width: 1080px) {
  .build-main {
    grid-template-columns: 250px 1fr;
  }
  .col-right {
    display: none;
  }
}
@media (max-width: 780px) {
  .build-main {
    grid-template-columns: 1fr;
  }
  .col-left {
    display: none;
  }
  .mode-switch span,
  .status-chip {
    display: none;
  }
}
</style>
