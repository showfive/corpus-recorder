<template>
  <div class="control-buttons">
    <el-button
      v-if="recordingState === RecordingState.IDLE"
      type="primary"
      size="default"
      :icon="Microphone"
      @click="emit('start-recording')"
      class="record-button"
    >
      録音開始
    </el-button>

    <el-button
      v-if="recordingState === RecordingState.RECORDING"
      type="danger"
      size="default"
      :icon="VideoPause"
      @click="emit('stop-recording')"
      class="stop-button pulse"
    >
      録音停止
    </el-button>

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

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'retry-recording'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped>
.control-buttons {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

/* ボタンスタイル */
.record-button {
  background: linear-gradient(135deg, var(--success-color), #059669);
  border: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.record-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.stop-button {
  background: linear-gradient(135deg, var(--error-color), #dc2626);
  border: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.stop-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.stop-button.pulse {
  animation: buttonPulse 2s ease-in-out infinite;
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

/* アニメーション */
@keyframes buttonPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .control-buttons {
    justify-content: center;
  }
}
</style> 