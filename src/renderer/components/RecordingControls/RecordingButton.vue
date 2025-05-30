<template>
  <div class="control-buttons">
    <ToggleButton
      :is-active="recordingState === RecordingState.RECORDING"
      active-text="録音停止"
      inactive-text="録音開始"
      :active-icon="VideoPause"
      :inactive-icon="Microphone"
      active-button-type="danger"
      inactive-button-type="primary"
      :size="size"
      :loading="recordingState === RecordingState.PROCESSING"
      :disabled="recordingState === RecordingState.PROCESSING"
      :pulse="true"
      @toggle="handleToggle"
      class="recording-toggle-button"
    />

    <el-button
      v-if="recordingState === RecordingState.IDLE && hasRecordings"
      size="default"
      :icon="Refresh"
      @click="emit('retry-recording')"
      class="retry-button"
    >
      やり直し
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Microphone, VideoPause, Refresh } from '@element-plus/icons-vue'
import { RecordingState } from '../../../common/types'
import ToggleButton from '../common/ToggleButton.vue'

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
  size?: 'large' | 'default' | 'small'
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'retry-recording'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default'
})

const emit = defineEmits<Emits>()

const handleToggle = (isActive: boolean) => {
  if (isActive) {
    emit('start-recording')
  } else {
    emit('stop-recording')
  }
}
</script>

<style scoped>
.control-buttons {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  align-items: center;
}

.recording-toggle-button {
  min-width: 120px;
}

.retry-button {
  background: linear-gradient(135deg, var(--warning-color), #d97706);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.2s ease;
}

.retry-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .control-buttons {
    justify-content: center;
  }
  
  .recording-toggle-button {
    min-width: 100px;
  }
}
</style> 