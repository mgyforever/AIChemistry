<template>
  <header class="lab-topbar">
    <div class="tb-left">
      <button
        v-if="backTo"
        class="tb-icon-btn"
        type="button"
        aria-label="返回"
        @click="router.push(backTo)"
      >
        <LabIcon name="arrowLeft" />
      </button>

      <button class="tb-logo" type="button" aria-label="返回实验台" @click="router.push('/lab')">
        <span class="tb-logo-badge">
          <LabIcon name="atom" />
        </span>
        <span class="tb-brand">AIChemistry</span>
      </button>

      <span v-if="title" class="tb-divider"></span>
      <span class="tb-title">{{ title }}</span>
    </div>

    <div class="tb-right">
      <slot name="actions"></slot>
      <button
        class="tb-icon-btn"
        type="button"
        :aria-label="themeStore.mode === 'dark' ? '切换到亮色' : '切换到暗色'"
        :title="themeStore.mode === 'dark' ? '切换到亮色' : '切换到暗色'"
        @click="themeStore.toggle()"
      >
        <LabIcon :name="themeStore.mode === 'dark' ? 'sun' : 'moon'" />
      </button>
      <div class="tb-avatar" title="当前用户">我</div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import LabIcon from './LabIcon.vue'
import { themeStore } from '../../stores/theme'

defineProps<{
  title?: string
  backTo?: string
}>()

const router = useRouter()
</script>

<style scoped>
.lab-topbar {
  position: relative;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 58px;
  padding: 0 14px;
  margin: 12px 16px 0;
  border: 1px solid var(--lab-glass-border);
  border-radius: 16px;
  background: var(--lab-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.16);
}

.tb-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tb-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 17px;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), background-color var(--transition-fast);
}
.tb-icon-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface-alt);
}

.tb-logo {
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.tb-logo-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: #fff;
  font-size: 17px;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
}
.tb-brand {
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border);
}

.tb-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tb-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(79, 70, 229, 0.35);
}
</style>
