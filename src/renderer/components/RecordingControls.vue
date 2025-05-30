<template>
  <div class="recording-controls">
    <div class="controls-card">      <!-- ヘッダー：ボタン（中央）とステータス（右端） -->
      <div class="card-header">
        <div class="header-spacer"></div>
        
        <div class="control-buttons">
          <RecordingButton
            :recording-state="recordingState"
            :has-recordings="hasRecordings"
            size="large"
            @start-recording="startRecording"
            @stop-recording="stopRecording"
            @retry-recording="retryRecording"
          />
        </div>

        <div class="status-display">
          <el-tag 
            :type="statusTagType" 
            effect="dark"
            class="status-tag"
          >
            {{ statusText }}
          </el-tag>
          <div 
            v-if="recordingState === RecordingState.RECORDING" 
            class="recording-time"
          >
            {{ formatTime(recordingTime) }}
          </div>
        </div>
      </div>

      <!-- メインエリア：波形表示 -->
      <div class="card-content">
        <WaveformDisplay
          :recording-state="recordingState"
          :has-recordings="hasRecordings"
        />
      </div>

      <!-- 音声再生コントロール（カード下部） -->
      <div v-if="hasRecordings && latestRecording" class="audio-controls">
        <el-button-group class="audio-action-group">
          <el-button
            v-if="!isPlaying"
            type="primary"
            size="default"
            :icon="CaretRight"
            @click="playRecording"
            class="play-btn"
          >
            再生
          </el-button>
          <el-button
            v-else
            type="warning"
            size="default"
            :icon="PauseIcon"
            @click="pauseResumeRecording"
            class="pause-btn"
          >
            一時停止
          </el-button>
          <el-button
            type="info"
            size="default"
            @click="stopAudioPlayback"
            class="stop-btn"
          >
            ⏹ 停止
          </el-button>
        </el-button-group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, VideoPause, Refresh, VideoPlay, VideoPause as PauseIcon, CaretRight } from '@element-plus/icons-vue'
import { RecordingState, Recording } from '../../common/types'
import { recordingService } from '../services/recordingService'
import { createLogger } from '../../common/logger'
import RecordingButton from './RecordingControls/RecordingButton.vue'
import WaveformDisplay from './RecordingControls/WaveformDisplay.vue'

const logger = createLogger('RecordingControls')

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
  currentRecordings: Recording[]
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'retry-recording'): void
  (e: 'play-recording', recording: Recording): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 録音関連の状態
const recordingTime = ref(0)

// 音声再生関連の状態
const isPlaying = ref(false)
const currentAudio = ref<HTMLAudioElement | null>(null)
const playbackPosition = ref(0)
const playbackDuration = ref(0)

// 最新の録音を取得
const latestRecording = computed((): Recording | null => {
  if (props.currentRecordings.length === 0) return null
  return props.currentRecordings[props.currentRecordings.length - 1]
})

// recordingServiceのセットアップ
onMounted(async () => {
  // 時間更新のイベントハンドラーのみ設定（UI表示用）
  recordingService.onTimeUpdate = (seconds) => {
    recordingTime.value = seconds
  }
  
  // リサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize)
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
const retryRecording = async () => {
  await emit('retry-recording')
}

// 時間フォーマット
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 音声再生機能
const playRecording = async () => {
  const recording = latestRecording.value
  if (!recording) return

  try {
    // 既存の音声を停止（ローカルとグローバル両方）
    if (currentAudio.value) {
      currentAudio.value.pause()
      currentAudio.value = null
    }

    if (window.currentAudio) {
      window.currentAudio.pause()
      window.currentAudio.currentTime = 0
      window.currentAudio = null
    }

    const timestamp = Date.now()
    const audioUrl = `file://${recording.filePath}?t=${timestamp}`
    
    const audio = new Audio(audioUrl)
    currentAudio.value = audio
    window.currentAudio = audio

    // 音声の時間更新
    audio.ontimeupdate = () => {
      playbackPosition.value = audio.currentTime
      playbackDuration.value = audio.duration || 0
    }

    // 再生完了時
    audio.onended = () => {
      isPlaying.value = false
      currentAudio.value = null
      window.currentAudio = null
      playbackPosition.value = 0
    }

    // エラーハンドリング
    audio.onerror = () => {
      ElMessage.error('音声ファイルが見つかりません。削除されている可能性があります。')
      isPlaying.value = false
      currentAudio.value = null
      window.currentAudio = null
    }

    // 保存された位置から再生開始
    audio.onloadedmetadata = () => {
      if (playbackPosition.value > 0 && playbackPosition.value < audio.duration) {
        audio.currentTime = playbackPosition.value
      }
    }

    await audio.play()
    isPlaying.value = true
    ElMessage.success('再生を開始しました')

  } catch (error) {
    logger.error('Failed to play recording', {
      error: error instanceof Error ? error.message : error,
      recordingPath: recording.filePath,
      component: 'RecordingControls',
      method: 'playRecording'
    })
    ElMessage.error('音声の再生に失敗しました')
    isPlaying.value = false
  }
}

// 音声一時停止/再開
const pauseResumeRecording = () => {
  if (!currentAudio.value) return

  if (isPlaying.value) {
    currentAudio.value.pause()
    isPlaying.value = false
  } else {
    currentAudio.value.play().then(() => {
      isPlaying.value = true
    }).catch((error) => {
      logger.error('Failed to resume playback', {
        error: error instanceof Error ? error.message : error,
        component: 'RecordingControls',
        method: 'pauseResumeRecording'
      })
      ElMessage.error('再生の再開に失敗しました')
      isPlaying.value = false
    })
  }
}

// 音声停止（先頭に戻る）
const stopAudioPlayback = () => {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value.currentTime = 0
    isPlaying.value = false
    playbackPosition.value = 0
  }
  
  if (window.currentAudio) {
    window.currentAudio.pause()
    window.currentAudio.currentTime = 0
    window.currentAudio = null
  }
}

// 録音状態監視（波形表示はWaveformDisplayコンポーネントに委譲）
watch(() => props.recordingState, async (newState, oldState) => {
  logger.info('Recording state changed', { 
    oldState, 
    newState,
    component: 'RecordingControls'
  })
  
  if (newState === RecordingState.IDLE) {
    recordingTime.value = 0
  }
})

// ウィンドウリサイズ時の処理
const handleResize = () => {
  // WaveformDisplayコンポーネントが自動的にリサイズを処理
}

onUnmounted(() => {
  // 音声再生のクリーンアップ
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  
  window.removeEventListener('resize', handleResize)
  recordingService.onTimeUpdate = null
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

.control-buttons {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

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
  
  .control-buttons {
    justify-content: center;
  }
  
  .status-display {
    justify-content: center;
  }
  
  .audio-controls {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
  
  .audio-buttons {
    justify-content: center;
  }
}

/* 音声再生コントロール */
.audio-controls {
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  border-top: 1px solid var(--gray-200);
  padding: var(--space-sm) var(--space-xs);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.audio-action-group {
  display: flex;
}

.play-btn,
.pause-btn,
.stop-btn {
  font-weight: 600;
  transition: all 0.2s ease;
}

.play-btn {
  background: linear-gradient(135deg, var(--success-color), #059669);
  border: none;
  color: white;
}

.play-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

.pause-btn {
  background: linear-gradient(135deg, var(--warning-color), #d97706);
  border: none;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

.pause-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

.stop-btn {
  background: linear-gradient(135deg, var(--gray-500), #6b7280);
  border: none;
  color: white;
}

.stop-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>