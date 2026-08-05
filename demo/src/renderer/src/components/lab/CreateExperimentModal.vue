<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div ref="panelRef" class="modal-panel" role="dialog" aria-modal="true" aria-label="新建实验">
      <div class="mp-head">
        <div>
          <h3 class="mp-title">新建化学实验</h3>
          <p class="mp-sub">自由搭建实验流程：先定义基本信息，之后在构建器中添加阶段与事件。</p>
        </div>
        <button class="mp-close" type="button" aria-label="关闭" @click="$emit('close')">
          <LabIcon name="x" />
        </button>
      </div>

      <form class="mp-form" @submit.prevent="submit">
        <div class="f-row">
          <label for="exp-name">实验名称</label>
          <input id="exp-name" v-model.trim="form.name" type="text" placeholder="例如：酸碱中和滴定实验" autofocus />
        </div>

        <div class="f-row">
          <label for="exp-desc">实验简介</label>
          <textarea id="exp-desc" v-model.trim="form.description" rows="2" placeholder="一句话说明本次实验要做什么…"></textarea>
        </div>

        <div class="f-row">
          <label for="exp-obj">实验目标</label>
          <textarea id="exp-obj" v-model.trim="form.objective" rows="2" placeholder="希望通过实验掌握的知识或技能…"></textarea>
        </div>

        <div class="f-row">
          <label for="exp-tags">标签（用逗号分隔）</label>
          <input id="exp-tags" v-model="tagsText" type="text" placeholder="滴定, 定量分析, 高中化学" />
        </div>

        <div class="f-row">
          <label>安全等级</label>
          <div class="segmented">
            <button
              v-for="opt in safetyOptions"
              :key="opt.value"
              type="button"
              :class="['seg-item', { active: form.safetyLevel === opt.value }]"
              @click="form.safetyLevel = opt.value"
            >
              <span class="seg-dot" :style="{ background: opt.color }"></span>
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="f-row">
          <label>主题色</label>
          <div class="swatches">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              :class="['swatch', { active: form.color === c }]"
              :style="{ background: c }"
              :aria-label="`主题色 ${c}`"
              @click="form.color = c"
            >
              <LabIcon v-if="form.color === c" name="check" />
            </button>
          </div>
        </div>

        <div class="f-row f-row-inline">
          <label for="exp-min">预计时长（分钟）</label>
          <input id="exp-min" v-model.number="form.estimatedMinutes" type="number" min="1" max="600" />
        </div>

        <p v-if="error" class="mp-error">{{ error }}</p>

        <div class="mp-actions">
          <button class="btn-ghost" type="button" @click="$emit('close')">取消</button>
          <button class="btn-primary" type="submit">创建并开始搭建</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import LabIcon from './LabIcon.vue'
import { experimentStore } from '../../stores/experiments'
import type { Experiment } from '../../stores/experiments'

const emit = defineEmits<{
  close: []
  created: [exp: Experiment]
}>()

const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a78bfa', '#ec4899', '#14b8a6']

const safetyOptions = [
  { value: 'low', label: '低风险', color: '#10b981' },
  { value: 'medium', label: '中风险', color: '#f59e0b' },
  { value: 'high', label: '高风险', color: '#f43f5e' }
] as const

const tagsText = ref('')
const error = ref('')

const form = reactive({
  name: '',
  description: '',
  objective: '',
  safetyLevel: 'low' as 'low' | 'medium' | 'high',
  color: colors[0],
  estimatedMinutes: 30
})

function submit(): void {
  if (!form.name) {
    error.value = '请填写实验名称'
    return
  }
  console.log('[Component] CreateExperimentModal 提交创建实验:', form.name.slice(0, 50))
  const tags = tagsText.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  const exp = experimentStore.createExperiment({ ...form, tags })
  console.log('[Component] CreateExperimentModal 实验创建完成:', exp.id)
  emit('created', exp)
}
</script>

<style scoped>
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

.modal-panel {
  width: min(560px, 100%);
  max-height: calc(100vh - 60px);
  overflow-y: auto;
  padding: 24px;
  border: 1px solid var(--lab-glass-border);
  border-radius: 20px;
  background: var(--color-surface);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
}

.mp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.mp-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  margin: 0 0 4px;
}

.mp-sub {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
}

.mp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 17px;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.mp-close:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.mp-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.f-row label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 7px;
}

.f-row input,
.f-row textarea {
  width: 100%;
  padding: 10px 13px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
  color: var(--color-text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.f-row input:focus,
.f-row textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.f-row input::placeholder,
.f-row textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.f-row-inline input {
  width: 120px;
}

.segmented {
  display: flex;
  gap: 8px;
}

.seg-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-alt);
  font-size: 12.5px;
  font-family: inherit;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.seg-item:hover {
  border-color: var(--color-text-muted);
}
.seg-item.active {
  border-color: var(--color-accent);
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.seg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.swatches {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 2px solid transparent;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.swatch:hover {
  transform: scale(1.1);
}
.swatch.active {
  box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent);
}

.mp-error {
  font-size: 12.5px;
  color: var(--color-danger);
  margin: 0;
}

.mp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.btn-ghost,
.btn-primary {
  height: 40px;
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

.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(120deg, var(--color-primary) 0%, var(--color-accent) 130%);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-primary) 35%, transparent);
}
.btn-primary:hover {
  filter: brightness(1.07);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.btn-primary:active {
  transform: scale(0.98);
}
</style>
