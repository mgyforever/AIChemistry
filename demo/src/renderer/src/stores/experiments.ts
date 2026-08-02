import { reactive } from 'vue'

/* ================= 类型定义 ================= */

export type EventType = 'operation' | 'observation' | 'measurement' | 'reagent' | 'record' | 'safety'

export type ExpStatus = 'draft' | 'running' | 'paused' | 'completed'

export type Role = 'owner' | 'experimenter' | 'observer' | 'recorder'

export interface EventItem {
  id: string
  type: EventType
  title: string
  description: string
  /** 关键参数，如「NaCl 5.0g · 60mL 去离子水」 */
  params: string
  /** 预期结果 */
  expected: string
  /** 执行备注 */
  note: string
  done: boolean
}

export interface Stage {
  id: string
  name: string
  description: string
  color: string
  expectedMinutes: number
  events: EventItem[]
}

export interface Member {
  id: string
  name: string
  avatarColor: string
  role: Role
  online: boolean
  /** 是否处于待接受邀请状态 */
  invited: boolean
}

export interface Group {
  id: string
  name: string
  description: string
  memberIds: string[]
}

export interface Experiment {
  id: string
  name: string
  description: string
  objective: string
  tags: string[]
  safetyLevel: 'low' | 'medium' | 'high'
  color: string
  estimatedMinutes: number
  status: ExpStatus
  createdAt: number
  ownerId: string
  stages: Stage[]
  groups: Group[]
  members: Member[]
}

/* ================= 事件类型元信息 ================= */

export const EVENT_TYPES: Record<
  EventType,
  { label: string; color: string; icon: string }
> = {
  operation: { label: '操作', color: 'var(--type-operation)', icon: 'hand' },
  observation: { label: '观察', color: 'var(--type-observation)', icon: 'eye' },
  measurement: { label: '测量', color: 'var(--type-measurement)', icon: 'ruler' },
  reagent: { label: '试剂', color: 'var(--type-reagent)', icon: 'flask' },
  record: { label: '记录', color: 'var(--type-record)', icon: 'pen' },
  safety: { label: '安全', color: 'var(--type-safety)', icon: 'shield' }
}

export const EVENT_TYPE_ORDER: EventType[] = ['operation', 'reagent', 'observation', 'measurement', 'record', 'safety']

/** 阶段可选的强调色板 */
export const STAGE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa', '#ec4899', '#14b8a6']

export const ROLE_META: Record<Role, { label: string }> = {
  owner: { label: '发起者' },
  experimenter: { label: '实验员' },
  observer: { label: '观察员' },
  recorder: { label: '记录员' }
}

export const STATUS_META: Record<ExpStatus, { label: string }> = {
  draft: { label: '草稿' },
  running: { label: '进行中' },
  paused: { label: '已暂停' },
  completed: { label: '已完成' }
}

/* ================= 工具函数 ================= */

function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

function now(): number {
  return Date.now()
}

const AVATAR_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa', '#ec4899', '#14b8a6']

/* ================= 可邀请的用户目录（模拟） ================= */

export const USER_DIRECTORY: { id: string; name: string; avatarColor: string }[] = [
  { id: 'u-lin', name: '林知夏', avatarColor: '#06b6d4' },
  { id: 'u-wang', name: '王语彤', avatarColor: '#a78bfa' },
  { id: 'u-zhao', name: '赵一鸣', avatarColor: '#f59e0b' },
  { id: 'u-li', name: '李慕白', avatarColor: '#10b981' },
  { id: 'u-sun', name: '孙晓雨', avatarColor: '#ec4899' }
]

const CURRENT_USER: Member = {
  id: 'u-me',
  name: '我',
  avatarColor: '#4f46e5',
  role: 'owner',
  online: true,
  invited: false
}

/* ================= 种子数据 ================= */

function seedExperiments(): Experiment[] {
  return [
    {
      id: 'exp-01',
      name: '酸碱中和滴定实验',
      description: '使用已知浓度的盐酸标准溶液测定氢氧化钠待测液的浓度，掌握中和滴定操作要领。',
      objective: '测定 NaOH 待测液浓度，相对偏差 ≤ 0.5%；熟练使用酸式滴定管与移液管。',
      tags: ['滴定', '定量分析', '高中化学'],
      safetyLevel: 'medium',
      color: '#6366f1',
      estimatedMinutes: 45,
      status: 'running',
      createdAt: now() - 1000 * 60 * 60 * 26,
      ownerId: 'u-me',
      stages: [
        {
          id: 'stg-01',
          name: '准备与配制',
          description: '检查仪器并配制盐酸标准溶液。',
          color: '#06b6d4',
          expectedMinutes: 10,
          events: [
            {
              id: 'evt-01',
              type: 'safety',
              title: '安全着装检查',
              description: '穿戴实验服、护目镜与手套。',
              params: '实验服 / 护目镜 / 丁腈手套',
              expected: '着装规范无暴露',
              note: '',
              done: true
            },
            {
              id: 'evt-02',
              type: 'operation',
              title: '滴定管检漏与润洗',
              description: '检查酸式滴定管是否漏水，并用标准液润洗 2~3 次。',
              params: '0.1000 mol/L HCl',
              expected: '旋转活塞无渗漏',
              note: '',
              done: true
            },
            {
              id: 'evt-03',
              type: 'measurement',
              title: '配制盐酸标准溶液',
              description: '量取浓盐酸稀释定容至 250mL，摇匀后备用。',
              params: '浓 HCl → 250mL 容量瓶',
              expected: '标定浓度 0.1000 mol/L',
              note: '',
              done: false
            }
          ]
        },
        {
          id: 'stg-02',
          name: '取样与滴定',
          description: '移取待测液并完成三次平行滴定。',
          color: '#6366f1',
          expectedMinutes: 20,
          events: [
            {
              id: 'evt-04',
              type: 'operation',
              title: '移取待测液',
              description: '用移液管准确移取 20.00mL NaOH 待测液至锥形瓶。',
              params: '20.00 mL NaOH',
              expected: '无外溢，读数准确',
              note: '',
              done: false
            },
            {
              id: 'evt-05',
              type: 'reagent',
              title: '加入指示剂',
              description: '滴加 2~3 滴酚酞指示剂，摇匀。',
              params: '酚酞 2~3 滴',
              expected: '溶液呈浅红色',
              note: '',
              done: false
            },
            {
              id: 'evt-06',
              type: 'observation',
              title: '滴定至终点',
              description: '控制滴定速度，观察颜色变化，半分钟内不褪色即达终点。',
              params: '边滴边摇',
              expected: '浅红色持续 30s',
              note: '终点前需用洗瓶冲洗锥形瓶内壁',
              done: false
            },
            {
              id: 'evt-07',
              type: 'record',
              title: '记录滴定读数',
              description: '记录初读数和末读数，计算消耗体积，重复三次平行实验。',
              params: 'V初 / V末',
              expected: '极差 < 0.1mL',
              note: '',
              done: false
            }
          ]
        },
        {
          id: 'stg-03',
          name: '数据处理',
          description: '计算浓度并分析误差来源。',
          color: '#f59e0b',
          expectedMinutes: 10,
          events: [
            {
              id: 'evt-08',
              type: 'record',
              title: '计算 NaOH 浓度',
              description: '根据 c₁V₁ = c₂V₂ 计算待测液浓度。',
              params: 'c(HCl)·V(HCl) = c(NaOH)·V(NaOH)',
              expected: '约 0.0950 mol/L',
              note: '',
              done: false
            },
            {
              id: 'evt-09',
              type: 'observation',
              title: '误差分析讨论',
              description: '分析润洗、气泡、读数等操作对结果的影响。',
              params: '小组讨论',
              expected: '能指出 ≥ 2 个误差来源',
              note: '',
              done: false
            }
          ]
        },
        {
          id: 'stg-04',
          name: '收尾与整理',
          description: '清洗仪器、规范废液处理并完成实验报告。',
          color: '#10b981',
          expectedMinutes: 5,
          events: [
            {
              id: 'evt-10',
              type: 'operation',
              title: '清洗与归位',
              description: '清洗所有玻璃仪器，废液倒入指定废液缸。',
              params: '去离子水 ×3 次',
              expected: '台面整洁、仪器归位',
              note: '',
              done: false
            },
            {
              id: 'evt-11',
              type: 'record',
              title: '提交实验报告',
              description: '上传数据记录与结论，提交小组报告。',
              params: '电子报告',
              expected: '记录员提交',
              note: '',
              done: false
            }
          ]
        }
      ],
      groups: [
        {
          id: 'grp-01',
          name: '滴定小组 A',
          description: '负责平行滴定与数据处理',
          memberIds: ['u-me', 'u-lin', 'u-wang']
        },
        {
          id: 'grp-02',
          name: '滴定小组 B',
          description: '负责标准液配制与复核',
          memberIds: ['u-zhao', 'u-li']
        }
      ],
      members: [
        CURRENT_USER,
        { id: 'u-lin', name: '林知夏', avatarColor: '#06b6d4', role: 'experimenter', online: true, invited: false },
        { id: 'u-wang', name: '王语彤', avatarColor: '#a78bfa', role: 'observer', online: false, invited: false },
        { id: 'u-zhao', name: '赵一鸣', avatarColor: '#f59e0b', role: 'recorder', online: true, invited: false },
        { id: 'u-li', name: '李慕白', avatarColor: '#10b981', role: 'experimenter', online: false, invited: true }
      ]
    },
    {
      id: 'exp-02',
      name: '高锰酸钾制取氧气',
      description: '通过加热高锰酸钾分解制取氧气，学习固体加热装置与排水集气法。',
      objective: '验证 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑；掌握排水集气操作。',
      tags: ['气体制备', '分解反应'],
      safetyLevel: 'high',
      color: '#f43f5e',
      estimatedMinutes: 30,
      status: 'draft',
      createdAt: now() - 1000 * 60 * 60 * 5,
      ownerId: 'u-me',
      stages: [
        {
          id: 'stg-21',
          name: '组装与检查',
          description: '搭建固体加热装置并检查气密性。',
          color: '#f43f5e',
          expectedMinutes: 8,
          events: [
            {
              id: 'evt-21',
              type: 'safety',
              title: '酒精灯安全检查',
              description: '检查酒精灯灯芯、酒精量，确认周围无易燃物。',
              params: '酒精灯',
              expected: '灯芯干燥完好',
              note: '',
              done: false
            },
            {
              id: 'evt-22',
              type: 'operation',
              title: '连接装置',
              description: '试管口略向下倾斜，导管伸入水槽。',
              params: '铁架台 / 试管 / 导管',
              expected: '装置稳固',
              note: '',
              done: false
            }
          ]
        },
        {
          id: 'stg-22',
          name: '加热分解',
          description: '均匀预热后集中加热，收集氧气。',
          color: '#f59e0b',
          expectedMinutes: 12,
          events: [
            {
              id: 'evt-23',
              type: 'operation',
              title: '均匀预热',
              description: '先移动酒精灯使试管均匀受热，再集中加热药品部位。',
              params: '外焰加热',
              expected: '无炸裂',
              note: '',
              done: false
            },
            {
              id: 'evt-24',
              type: 'observation',
              title: '收集氧气',
              description: '待气泡连续均匀后，用排水法收集。',
              params: '排水集气',
              expected: '集满后瓶口留余水',
              note: '',
              done: false
            }
          ]
        },
        {
          id: 'stg-23',
          name: '检验与收尾',
          description: '验满、停止加热并整理。',
          color: '#10b981',
          expectedMinutes: 6,
          events: [
            {
              id: 'evt-25',
              type: 'observation',
              title: '氧气验满',
              description: '将带火星木条伸入瓶口。',
              params: '带火星木条',
              expected: '木条复燃',
              note: '',
              done: false
            },
            {
              id: 'evt-26',
              type: 'operation',
              title: '先撤导管再熄灯',
              description: '先将导管移出水面，再熄灭酒精灯，防止倒吸。',
              params: '',
              expected: '无倒吸现象',
              note: '',
              done: false
            }
          ]
        }
      ],
      groups: [],
      members: [CURRENT_USER]
    },
    {
      id: 'exp-03',
      name: '焰色反应与光谱观察',
      description: '灼烧不同金属盐观察特征焰色，结合光谱进行元素鉴定。',
      objective: '认识常见金属元素的特征焰色并完成记录。',
      tags: ['焰色反应', '元素鉴定'],
      safetyLevel: 'medium',
      color: '#a78bfa',
      estimatedMinutes: 25,
      status: 'completed',
      createdAt: now() - 1000 * 60 * 60 * 48,
      ownerId: 'u-me',
      stages: [
        {
          id: 'stg-31',
          name: '灼烧金属盐',
          description: '用铂丝蘸取不同盐溶液灼烧。',
          color: '#a78bfa',
          expectedMinutes: 12,
          events: [
            {
              id: 'evt-31',
              type: 'reagent',
              title: '蘸取盐溶液',
              description: '铂丝先灼烧至无色，再蘸取待测溶液。',
              params: 'NaCl / KCl / CaCl₂ / CuSO₄',
              expected: '铂丝无杂质焰',
              note: '',
              done: true
            },
            {
              id: 'evt-32',
              type: 'observation',
              title: '观察焰色',
              description: '在外焰灼烧，透过蓝色钴玻璃观察钾元素焰色。',
              params: '外焰灼烧',
              expected: '记录各元素特征色',
              note: '',
              done: true
            }
          ]
        },
        {
          id: 'stg-32',
          name: '记录与报告',
          description: '整理观察表并完成鉴定报告。',
          color: '#10b981',
          expectedMinutes: 10,
          events: [
            {
              id: 'evt-33',
              type: 'record',
              title: '整理焰色观察表',
              description: '汇总钠黄、钾紫（钴玻璃）、钙砖红、铜绿。',
              params: '观察表',
              expected: '表格完整',
              note: '',
              done: true
            }
          ]
        }
      ],
      groups: [],
      members: [CURRENT_USER, { id: 'u-sun', name: '孙晓雨', avatarColor: '#ec4899', role: 'observer', online: true, invited: false }]
    }
  ]
}

/* ================= Store ================= */

const STORAGE_KEY = 'aichemistry-lab-v1'

function loadState(): { experiments: Experiment[]; initialized: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return { experiments: parsed, initialized: true }
    }
  } catch {
    /* 数据损坏时回退到种子数据 */
  }
  return { experiments: seedExperiments(), initialized: false }
}

const loaded = loadState()

export const experimentStore = reactive({
  experiments: loaded.experiments,
  initialized: loaded.initialized,

  /* ---------- 持久化 ---------- */
  persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.experiments))
  },

  /** 重置为种子示例数据（演示用） */
  resetDemo(): void {
    this.experiments = seedExperiments()
    this.persist()
  },

  /* ---------- 查询辅助 ---------- */
  getById(id: string): Experiment | undefined {
    return this.experiments.find((e) => e.id === id)
  },

  countDone(exp: Experiment): number {
    return exp.stages.reduce(
      (sum, s) => sum + s.events.filter((e) => e.done).length,
      0
    )
  },

  countEvents(exp: Experiment): number {
    return exp.stages.reduce((sum, s) => sum + s.events.length, 0)
  },

  /** 取实验成员中在线人数（模拟） */
  onlineCount(exp: Experiment): number {
    return exp.members.filter((m) => m.online).length
  },

  /* ---------- 实验 ---------- */
  createExperiment(data: {
    name: string
    description: string
    objective: string
    tags: string[]
    safetyLevel: 'low' | 'medium' | 'high'
    color: string
    estimatedMinutes: number
  }): Experiment {
    const exp: Experiment = {
      id: uid(),
      name: data.name,
      description: data.description,
      objective: data.objective,
      tags: data.tags,
      safetyLevel: data.safetyLevel,
      color: data.color,
      estimatedMinutes: data.estimatedMinutes,
      status: 'draft',
      createdAt: now(),
      ownerId: 'u-me',
      stages: [
        {
          id: uid(),
          name: '初始阶段',
          description: '双击标题即可重命名，添加第一个事件开始搭建实验。',
          color: STAGE_COLORS[0],
          expectedMinutes: 10,
          events: []
        }
      ],
      groups: [],
      members: [CURRENT_USER]
    }
    this.experiments.unshift(exp)
    this.persist()
    return exp
  },

  updateExperiment(id: string, patch: Partial<Experiment>): void {
    const exp = this.getById(id)
    if (!exp) return
    Object.assign(exp, patch)
    this.persist()
  },

  deleteExperiment(id: string): void {
    this.experiments = this.experiments.filter((e) => e.id !== id)
    this.persist()
  },

  setStatus(id: string, status: ExpStatus): void {
    this.updateExperiment(id, { status })
  },

  /* ---------- 阶段 ---------- */
  addStage(expId: string): Stage {
    const exp = this.getById(expId)
    if (!exp) return null as unknown as Stage
    const stage: Stage = {
      id: uid(),
      name: '新阶段',
      description: '描述这个阶段的目的与注意事项…',
      color: STAGE_COLORS[exp.stages.length % STAGE_COLORS.length],
      expectedMinutes: 10,
      events: []
    }
    exp.stages.push(stage)
    this.persist()
    return stage
  },

  updateStage(expId: string, stageId: string, patch: Partial<Stage>): void {
    const exp = this.getById(expId)
    const stage = exp?.stages.find((s) => s.id === stageId)
    if (!stage) return
    Object.assign(stage, patch)
    this.persist()
  },

  removeStage(expId: string, stageId: string): void {
    const exp = this.getById(expId)
    if (!exp) return
    exp.stages = exp.stages.filter((s) => s.id !== stageId)
    this.persist()
  },

  duplicateStage(expId: string, stageId: string): void {
    const exp = this.getById(expId)
    const index = exp?.stages.findIndex((s) => s.id === stageId)
    if (!exp || index === undefined || index < 0) return
    const source = exp.stages[index]
    const clone: Stage = {
      ...source,
      id: uid(),
      name: source.name + '（副本）',
      events: source.events.map((e) => ({ ...e, id: uid(), done: false }))
    }
    exp.stages.splice(index + 1, 0, clone)
    this.persist()
  },

  moveStage(expId: string, from: number, to: number): void {
    const exp = this.getById(expId)
    if (!exp || from === to) return
    const clamped = Math.max(0, Math.min(exp.stages.length - 1, to))
    const [item] = exp.stages.splice(from, 1)
    exp.stages.splice(clamped, 0, item)
    this.persist()
  },

  /* ---------- 事件 ---------- */
  addEvent(expId: string, stageId: string, type: EventType): EventItem {
    const exp = this.getById(expId)
    const stage = exp?.stages.find((s) => s.id === stageId)
    if (!stage) return null as unknown as EventItem
    const item: EventItem = {
      id: uid(),
      type,
      title: EVENT_TYPES[type].label + '事件',
      description: '点击展开，自由编辑事件内容…',
      params: '',
      expected: '',
      note: '',
      done: false
    }
    stage.events.push(item)
    this.persist()
    return item
  },

  updateEvent(expId: string, stageId: string, eventId: string, patch: Partial<EventItem>): void {
    const exp = this.getById(expId)
    const ev = exp?.stages.find((s) => s.id === stageId)?.events.find((e) => e.id === eventId)
    if (!ev) return
    Object.assign(ev, patch)
    this.persist()
  },

  removeEvent(expId: string, stageId: string, eventId: string): void {
    const exp = this.getById(expId)
    const stage = exp?.stages.find((s) => s.id === stageId)
    if (!stage) return
    stage.events = stage.events.filter((e) => e.id !== eventId)
    this.persist()
  },

  duplicateEvent(expId: string, stageId: string, eventId: string): void {
    const exp = this.getById(expId)
    const stage = exp?.stages.find((s) => s.id === stageId)
    const index = stage?.events.findIndex((e) => e.id === eventId)
    if (!stage || index === undefined || index < 0) return
    const source = stage.events[index]
    const clone: EventItem = { ...source, id: uid(), title: source.title + '（副本）', done: false }
    stage.events.splice(index + 1, 0, clone)
    this.persist()
  },

  moveEvent(expId: string, stageId: string, from: number, to: number): void {
    const exp = this.getById(expId)
    const stage = exp?.stages.find((s) => s.id === stageId)
    if (!stage || from === to) return
    const clamped = Math.max(0, Math.min(stage.events.length - 1, to))
    const [item] = stage.events.splice(from, 1)
    stage.events.splice(clamped, 0, item)
    this.persist()
  },

  toggleEvent(expId: string, stageId: string, eventId: string): void {
    const exp = this.getById(expId)
    const ev = exp?.stages.find((s) => s.id === stageId)?.events.find((e) => e.id === eventId)
    if (!ev) return
    ev.done = !ev.done
    this.persist()
  },

  /* ---------- 小组 ---------- */
  addGroup(expId: string, name: string, description: string, memberIds: string[] = []): Group {
    const exp = this.getById(expId)
    if (!exp) return null as unknown as Group
    const group: Group = { id: uid(), name, description, memberIds }
    exp.groups.push(group)
    this.persist()
    return group
  },

  updateGroup(expId: string, groupId: string, patch: Partial<Group>): void {
    const exp = this.getById(expId)
    const group = exp?.groups.find((g) => g.id === groupId)
    if (!group) return
    Object.assign(group, patch)
    this.persist()
  },

  removeGroup(expId: string, groupId: string): void {
    const exp = this.getById(expId)
    if (!exp) return
    exp.groups = exp.groups.filter((g) => g.id !== groupId)
    this.persist()
  },

  toggleGroupMember(expId: string, groupId: string, memberId: string): void {
    const exp = this.getById(expId)
    const group = exp?.groups.find((g) => g.id === groupId)
    if (!group) return
    group.memberIds = group.memberIds.includes(memberId)
      ? group.memberIds.filter((m) => m !== memberId)
      : [...group.memberIds, memberId]
    this.persist()
  },

  /* ---------- 成员与邀请 ---------- */
  getMember(exp: Experiment, memberId: string): Member | undefined {
    return exp.members.find((m) => m.id === memberId)
  },

  /** 邀请用户目录中的用户加入实验（模拟邀请流程） */
  inviteMember(expId: string, userId: string): void {
    const exp = this.getById(expId)
    if (!exp) return
    const user = USER_DIRECTORY.find((u) => u.id === userId)
    if (!user) return
    if (exp.members.some((m) => m.id === user.id)) return
    exp.members.push({
      id: user.id,
      name: user.name,
      avatarColor: user.avatarColor,
      role: 'observer',
      online: false,
      invited: true
    })
    this.persist()
  },

  removeMember(expId: string, memberId: string): void {
    const exp = this.getById(expId)
    if (!exp || memberId === 'u-me') return
    exp.members = exp.members.filter((m) => m.id !== memberId)
    exp.groups.forEach((g) => {
      g.memberIds = g.memberIds.filter((m) => m !== memberId)
    })
    this.persist()
  },

  setMemberRole(expId: string, memberId: string, role: Role): void {
    const exp = this.getById(expId)
    const member = exp?.members.find((m) => m.id === memberId)
    if (!member || member.id === 'u-me') return
    member.role = role
    this.persist()
  },

  acceptInvite(expId: string, memberId: string): void {
    const exp = this.getById(expId)
    const member = exp?.members.find((m) => m.id === memberId)
    if (!member) return
    member.invited = false
    member.online = true
    this.persist()
  },

  /* ---------- 小组视图 ---------- */
  groupMemberNames(exp: Experiment, group: Group): string[] {
    return group.memberIds
      .map((id) => this.getMember(exp, id)?.name)
      .filter((n): n is string => Boolean(n))
  }
})

export function pickAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
