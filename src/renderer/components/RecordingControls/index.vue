<template>
  <div class="recording-controls">
    <div class="controls-card">
      <!-- ヘッダー：ボタン（中央）とステータス（右端） -->
      <div class="card-header">
        <div class="header-spacer"></div>
        
        <!-- 録音制御ボタン -->
        <RecordingButton
          :recording-state="recordingState"
          :has-recordings="hasRecordings"
          @start-recording="emit('start-recording')"
          @stop-recording="emit('stop-recording')"
          @retry-recording="emit('retry-recording')"
        />

        <!-- ステータス表示 -->
        <RecordingStatus
          :recording-state="recordingState"
          :recording-time="recordingTime"
        />
      </div>

      <!-- メインエリア：波形と可視化表示 -->
      <div class="card-content">
        <WaveformDisplay
          :recording-state="recordingState"
          :has-recordings="hasRecordings"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RecordingState } from '../../../common/types'
import { useRecording } from '../../composables/useRecording'
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts'
import RecordingButton from './RecordingButton.vue'
import RecordingStatus from './RecordingStatus.vue'
import WaveformDisplay from './WaveformDisplay.vue'

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'retry-recording'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 録音関連の状態管理
const {
  recordingTime,
  startRecording: startRecordingComposable,
  stopRecording: stopRecordingComposable,
  retryRecording: retryRecordingComposable
} = useRecording()

// キーボードショートカットの設定
const { setupDefaultShortcuts } = useKeyboardShortcuts()

// イベントハンドラー（親コンポーネントに委譲）
const handleStartRecording = () => {
  emit('start-recording')
}

const handleStopRecording = () => {
  emit('stop-recording')
}

const handleRetryRecording = async () => {
  emit('retry-recording')
}

onMounted(() => {
  console.log('RecordingControls mounted')
  
  // キーボードショートカットを設定
  setupDefaultShortcuts({
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
    reset: handleRetryRecording
  })
})

onUnmounted(() => {
  console.log('RecordingControls unmounted')
})
</script>

<style scoped>
.recording-controls {
  width: 100%;
}

.controls-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  transition: all 0.2s ease;
  height: min(560px, 40vh);
  max-height: 650px;
  display: flex;
  flex-direction: column;
}

.controls-card:hover {
  box-shadow: var(--shadow-lg);
}

/* ヘッダー：3列レイアウト（左：空白、中央：ボタン、右：ステータス） */
.card-header {
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  padding: var(--space-md);
  border-bottom: 1px solid var(--gray-200);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

.header-spacer {
  /* 左側の空白領域（グリッドレイアウト用） */
  min-width: 0;
}

/* メインエリア */
.card-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .controls-card {
    height: min(480px, 45vh);
    max-height: 550px;
  }
  
  .card-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .header-spacer {
    display: none;
  }
}
</style> 