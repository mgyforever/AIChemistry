<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="邀请成员">
      <div class="mp-head">
        <div>
          <h3 class="mp-title">邀请成员加入实验</h3>
          <p class="mp-sub">从实验室通讯录中选择同学，被邀请者将收到加入请求。</p>
        </div>
        <button class="mp-close" type="button" aria-label="关闭" @click="$emit('close')">
          <LabIcon name="x" />
        </button>
      </div>

      <div class="user-list">
        <div v-for="user in USER_DIRECTORY" :key="user.id" class="user-row">
          <span class="avatar" :style="{ background: user.avatarColor }">{{ user.name.charAt(0) }}</span>
          <div class="u-info">
            <span class="u-name">{{ user.name }}</span>
            <span class="u-status">{{ statusText(user.id) }}</span>
          </div>
          <button
            class="invite-btn"
            :class="{ disabled: isMember(user.id) }"
            type="button"
            :disabled="isMember(user.id)"
            @click="invite(user.id)"
          >
            <LabIcon :name="inviteIcon(user.id)" />
            {{ inviteText(user.id) }}
          </button>
        </div>
      </div>

      <p class="mp-hint">提示：发起者可邀请成员加入后，再为成员分配角色、组建实验小组。刚受邀的用户处于「待接受」状态。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import LabIcon from './LabIcon.vue'
import { experimentStore, USER_DIRECTORY } from '../../stores/experiments'
import type { Experiment } from '../../stores/experiments'

const props = defineProps<{ exp: Experiment }>()

const emit = defineEmits<{ close: [] }>()

function isMember(userId: string): boolean {
  return props.exp.members.some((m) => m.id === userId)
}

function isPending(userId: string): boolean {
  return props.exp.members.some((m) => m.id === userId && m.invited)
}

function statusText(userId: string): string {
  if (isMember(userId)) return isPending(userId) ? '已发出邀请，待接受' : '已在实验中'
  return '可邀请'
}

function inviteIcon(userId: string): string {
  if (isMember(userId)) return isPending(userId) ? 'clock' : 'check'
  return 'userPlus'
}

function inviteText(userId: string): string {
  if (isMember(userId)) return isPending(userId) ? '邀请中' : '已加入'
  return '邀请'
}

function invite(userId: string): void {
  experimentStore.inviteMember(props.exp.id, userId)
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
  width: min(460px, 100%);
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
  margin-bottom: 18px;
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

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-alt);
  transition: border-color var(--transition-fast);
}
.user-row:hover {
  border-color: var(--color-text-muted);
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background-image: linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.22));
}

.u-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.u-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text);
}

.u-status {
  font-size: 11.5px;
  color: var(--color-text-muted);
}

.invite-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.invite-btn:hover:not(.disabled) {
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
}
.invite-btn.disabled {
  border-color: var(--color-border);
  background: var(--color-surface-alt);
  color: var(--color-text-muted);
  cursor: default;
}

.mp-hint {
  margin-top: 16px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.7;
}
</style>
