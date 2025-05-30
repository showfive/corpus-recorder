<template>
  <el-button
    :type="isActive ? activeButtonType : inactiveButtonType"
    :size="size"
    :icon="isActive ? activeIcon : inactiveIcon"
    :loading="loading"
    :disabled="disabled"
    @click="handleClick"
    :class="[
      'toggle-button',
      { 
        'toggle-active': isActive,
        'toggle-pulse': isActive && pulse 
      }
    ]"
  >
    {{ isActive ? activeText : inactiveText }}
  </el-button>
</template>

<script setup lang="ts">
import { Component } from 'vue'

interface Props {
  isActive: boolean
  activeText: string
  inactiveText: string
  activeIcon?: Component
  inactiveIcon?: Component
  activeButtonType?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'text' | 'default'
  inactiveButtonType?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'text' | 'default'
  size?: 'large' | 'default' | 'small'
  loading?: boolean
  disabled?: boolean
  pulse?: boolean
}

interface Emits {
  (e: 'toggle', active: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  activeButtonType: 'danger',
  inactiveButtonType: 'primary',
  size: 'default',
  loading: false,
  disabled: false,
  pulse: false
})

const emit = defineEmits<Emits>()

const handleClick = () => {
  emit('toggle', !props.isActive)
}
</script>

<style scoped>
.toggle-button {
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
}

.toggle-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.toggle-active.toggle-pulse {
  animation: togglePulse 2s ease-in-out infinite;
}

/* アニメーション */
@keyframes togglePulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); 
  }
  50% { 
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); 
  }
}

/* カスタマイズ可能なスタイル */
.toggle-button.el-button--primary {
  background: linear-gradient(135deg, var(--primary-color), #1d4ed8);
}

.toggle-button.el-button--success {
  background: linear-gradient(135deg, var(--success-color), #059669);
}

.toggle-button.el-button--warning {
  background: linear-gradient(135deg, var(--warning-color), #d97706);
}

.toggle-button.el-button--danger {
  background: linear-gradient(135deg, var(--error-color), #dc2626);
}

.toggle-button.el-button--info {
  background: linear-gradient(135deg, var(--info-color), #0369a1);
}
</style> 