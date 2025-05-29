<template>
  <div class="status-display">
    <el-tag 
      :type="statusTagType" 
      size="default"
      effect="dark"
      class="status-tag"
    >
      {{ statusText }}
    </el-tag>
    <span v-if="recordingState === RecordingState.RECORDING" class="recording-time">
      {{ formattedTime }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RecordingState } from '../../../common/types'

interface Props {
  recordingState: RecordingState
  recordingTime: number
}

const props = defineProps<Props>()

// ステータステキストの計算
const statusText = computed(() => {
  switch (props.recordingState) {
    case RecordingState.IDLE:
      return '待機中'
    case RecordingState.RECORDING:
      return '録音中'
    case RecordingState.PROCESSING:
      return '処理中'
    default:
      return ''
  }
})

// ステータスタグの種類計算
const statusTagType = computed(() => {
  switch (props.recordingState) {
    case RecordingState.IDLE:
      return 'info'
    case RecordingState.RECORDING:
      return 'danger'
    case RecordingState.PROCESSING:
      return 'warning'
    default:
      return 'info'
  }
})

// 時間フォーマット
const formattedTime = computed(() => {
  const minutes = Math.floor(props.recordingTime / 60)
  const secs = props.recordingTime % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
})
</script>

<style scoped>
.status-display {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.status-tag {
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.recording-time {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--error-color);
  font-variant-numeric: tabular-nums;
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .status-display {
    justify-content: center;
  }
}
</style> 