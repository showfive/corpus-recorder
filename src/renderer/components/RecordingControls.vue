<template>
  <div class="recording-controls">
    <el-card>
      <div class="controls-container">
        <!-- 録音状態表示 -->
        <div class="status-display">
          <el-tag 
            :type="statusTagType" 
            size="large"
            effect="dark"
          >
            {{ statusText }}
          </el-tag>
          <span v-if="recordingState === RecordingState.RECORDING" class="recording-time">
            {{ formatTime(recordingTime) }}
          </span>
        </div>

        <!-- 波形表示 -->
        <canvas 
          v-show="recordingState === RecordingState.RECORDING"
          ref="waveformCanvas" 
          class="waveform"
          width="600"
          height="100"
        ></canvas>

        <!-- コントロールボタン -->
        <div class="button-group">
          <el-button
            v-if="recordingState === RecordingState.IDLE"
            type="primary"
            size="large"
            :icon="Microphone"
            @click="startRecording"
          >
            録音開始
          </el-button>

          <el-button
            v-if="recordingState === RecordingState.RECORDING"
            type="danger"
            size="large"
            :icon="VideoPause"
            @click="stopRecording"
          >
            録音停止
          </el-button>          <el-button
            v-if="recordingState === RecordingState.IDLE && hasRecordings"
            size="large"
            :icon="Refresh"
            @click="retryRecording"
          >
            やり直し
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, VideoPause, Refresh } from '@element-plus/icons-vue'
import { RecordingState } from '../../common/types'
import { recordingService } from '../services/recordingService'

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

// 録音関連の状態
const waveformCanvas = ref<HTMLCanvasElement>()
const recordingTime = ref(0)

// recordingServiceのセットアップ
onMounted(() => {
  // 時間更新のイベントハンドラーのみ設定（UI表示用）
  recordingService.onTimeUpdate = (seconds) => {
    recordingTime.value = seconds
  }
  
  // 録音開始時の波形描画設定 - 削除して状態監視で処理
  // recordingService.onRecordingStart = () => {
  //   if (waveformCanvas.value) {
  //     recordingService.startWaveformDrawing(waveformCanvas.value)
  //   }
  // }
})

// 状態表示
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

// 録音開始
const startRecording = () => {
  emit('start-recording')
}

// 録音停止
const stopRecording = () => {
  emit('stop-recording')
}

// やり直し
const retryRecording = () => {
  emit('retry-recording')
}

// 時間フォーマット
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// クリーンアップ
onUnmounted(() => {
  // recordingServiceのイベントハンドラーをクリア（UI関連のみ）
  recordingService.onTimeUpdate = null
  // recordingService.onRecordingStart = null // 削除
})

// 録音状態の監視
watch(() => props.recordingState, (newState, oldState) => {
  if (newState === RecordingState.IDLE) {
    recordingTime.value = 0
  }
  
  // 録音開始時に波形描画を開始
  if (newState === RecordingState.RECORDING && oldState === RecordingState.IDLE) {
    if (waveformCanvas.value) {
      // 波形描画開始の試行（最大3回までリトライ）
      let retryCount = 0
      const maxRetries = 3
        const startWaveform = () => {
        if (waveformCanvas.value && recordingService.isRecording()) {
          if (recordingService.isAnalyserReady()) {
            console.log('Starting waveform drawing - analyser available')
            recordingService.startWaveformDrawing(waveformCanvas.value)
          } else {
            retryCount++
            if (retryCount < maxRetries) {
              console.log(`Waveform analyser not ready, retrying (${retryCount}/${maxRetries})...`)
              setTimeout(startWaveform, 150)
            } else {
              console.warn('Failed to start waveform drawing - analyser not available after retries')
            }
          }
        }
      }
      
      // 初回試行
      setTimeout(startWaveform, 100)
    }
  }
})
</script>

<style scoped>
.recording-controls {
  width: 100%;
}

.controls-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.status-display {
  display: flex;
  align-items: center;
  gap: 20px;
}

.recording-time {
  font-size: 18px;
  font-weight: bold;
  color: #f56c6c;
}

.waveform {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.button-group {
  display: flex;
  gap: 10px;
}
</style> 