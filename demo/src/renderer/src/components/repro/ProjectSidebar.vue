<template>
  <aside class="proj-sidebar">
    <div class="ps-head">
      <button type="button" class="ps-new" @click="startCreate">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        <span>新建项目</span>
      </button>
    </div>

    <!-- 内联新建表单（Electron 不支持 window.prompt） -->
    <form v-if="creating" class="ps-create" @submit.prevent="confirmCreate">
      <input
        ref="nameInputRef"
        v-model="newName"
        class="ps-input"
        type="text"
        placeholder="项目名称"
        maxlength="40"
      />
      <div class="ps-create-actions">
        <button type="submit" class="ok" :disabled="!newName.trim()">创建</button>
        <button type="button" class="cancel" @click="cancelCreate">取消</button>
      </div>
    </form>

    <input
      v-model="keyword"
      type="text"
      placeholder="搜索项目…"
      class="ps-search"
    />
    <div class="ps-list">
      <div
        v-for="p in filtered"
        :key="p.id"
        class="ps-item"
        :class="{ active: p.id === currentId }"
      >
        <button type="button" class="ps-item-main" @click="$emit('select', p.id)">
          <span class="ps-name">{{ p.name }}</span>
          <span class="ps-status" :class="p.status">{{ statusLabel(p.status) }}</span>
        </button>
        <button
          type="button"
          class="ps-del"
          title="删除项目（含全部数据）"
          @click="pendingDeleteId = p.id"
        >×</button>
      </div>
      <p v-if="!filtered.length" class="ps-empty">暂无项目，点击上方新建</p>
    </div>

    <!-- 删除确认弹层 -->
    <div v-if="pendingDeleteId !== null" class="ps-del-mask" @click.self="pendingDeleteId = null">
      <div class="ps-del-box">
        <p class="ps-del-title">删除项目</p>
        <p class="ps-del-desc">
          将删除「{{ filtered.find((p) => p.id === pendingDeleteId)?.name }}」及其全部数据（文献关联、复现方案、阶段记录、预测实验、论文等），不可恢复。确认删除？
        </p>
        <div class="ps-del-actions">
          <button type="button" class="cancel" @click="pendingDeleteId = null">取消</button>
          <button type="button" class="ok" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import type { ProjectUI } from '../../stores/repro'

const props = defineProps<{
  projects: ProjectUI[]
  currentId: number | null
}>()
const emit = defineEmits<{ select: [id: number]; create: [name: string]; delete: [id: number] }>()

const keyword = ref('')
const creating = ref(false)
const newName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const pendingDeleteId = ref<number | null>(null)

onMounted(() => {
  console.log('[Component] ProjectSidebar 挂载, 项目数:', props.projects.length)
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.projects
  return props.projects.filter((p) => p.name.toLowerCase().includes(kw))
})

/** 项目状态 → 中文标签（ongoing 进行中 / paused 已暂停 / completed 已完成） */
function statusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'paused') return '已暂停'
  return '进行中'
}

function startCreate(): void {
  creating.value = true
  newName.value = ''
  nextTick(() => nameInputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
  newName.value = ''
}

function confirmCreate(): void {
  const name = newName.value.trim()
  if (!name) return
  console.log('[Component] ProjectSidebar 提交创建项目:', name.slice(0, 50))
  creating.value = false
  newName.value = ''
  emit('create', name)
}

function doDelete(): void {
  if (pendingDeleteId.value === null) return
  console.log('[Component] ProjectSidebar 确认删除项目:', pendingDeleteId.value)
  emit('delete', pendingDeleteId.value)
  pendingDeleteId.value = null
}
</script>

<style scoped>
.proj-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 200px;
  padding: 10px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 16px;
  background: var(--lab-glass);
  backdrop-filter: blur(14px);
  overflow: hidden;
}
.ps-head {
  display: flex;
}
.ps-new {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ps-new:hover {
  border-color: var(--color-primary-light);
  color: var(--color-primary-light);
}
.ps-search {
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12.5px;
  outline: none;
}
.ps-create {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.ps-input {
  padding: 7px 9px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 12.5px;
  outline: none;
}
.ps-input:focus {
  border-color: var(--color-primary-light);
}
.ps-create-actions {
  display: flex;
  gap: 6px;
}
.ps-create-actions button {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.ps-create-actions .ok {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  color: #fff;
  font-weight: 600;
}
.ps-create-actions .ok:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ps-create-actions .cancel {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.ps-create-actions .cancel:hover {
  color: var(--color-text);
}
.ps-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}
.ps-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  transition: all var(--transition-fast);
}
.ps-item:hover {
  background: var(--color-surface-alt);
}
.ps-item.active {
  border-color: var(--color-primary-light);
  background: rgba(99, 102, 241, 0.12);
}
.ps-item-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 0 8px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
.ps-item-main:focus-visible {
  outline: 1px solid var(--color-primary-light);
  border-radius: 8px;
}
.ps-del {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-right: 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ps-del:hover {
  background: rgba(244, 63, 94, 0.14);
  color: var(--color-danger);
}
.ps-del-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}
.ps-del-box {
  width: 320px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}
.ps-del-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-danger);
}
.ps-del-desc {
  margin: 0 0 14px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--color-text-muted);
}
.ps-del-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.ps-del-actions button {
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.ps-del-actions .cancel {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.ps-del-actions .cancel:hover {
  color: var(--color-text);
}
.ps-del-actions .ok {
  background: linear-gradient(135deg, #f43f5e, #e11d48);
  color: #fff;
  font-weight: 600;
}
.ps-del-actions .ok:hover {
  opacity: 0.9;
}
.ps-name {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ps-status {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10.5px;
}
.ps-status.ongoing {
  color: var(--color-accent-ink);
  background: rgba(6, 182, 212, 0.12);
}
.ps-status.paused {
  color: var(--color-warning);
  background: rgba(249, 226, 175, 0.14);
}
.ps-status.completed {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.12);
}
.ps-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
