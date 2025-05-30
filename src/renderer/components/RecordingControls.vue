<template>
  <div class="recording-controls">
    <div class="controls-card">      <!-- ヘッダー：ボタン（中央）とステータス（右端） -->
      <div class="card-header">
        <div class="header-spacer"></div>
        
        <div class="control-buttons">
          <el-button
            v-if="recordingState === RecordingState.IDLE"
            type="primary"
            size="default"
            :icon="Microphone"
            @click="startRecording"
            class="record-button"
          >
            録音開始
          </el-button>

          <el-button
            v-if="recordingState === RecordingState.RECORDING"
            type="danger"
            size="default"
            :icon="VideoPause"
            @click="stopRecording"
            class="stop-button pulse"
          >
            録音停止
          </el-button>

          <el-button
            v-if="recordingState === RecordingState.IDLE && hasRecordings"
            size="default"
            :icon="Refresh"
            @click="retryRecording"
            class="retry-button"
          >
            録音し直し
          </el-button>
        </div>

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
            {{ formatTime(recordingTime) }}
          </span>
        </div>
      </div>

      <!-- メインエリア：波形とスペクトログラム表示 -->
      <div class="card-content">
        <!-- 録音中：波形表示 -->
        <div 
          v-if="recordingState === RecordingState.RECORDING"
          class="visualization-container recording-visualization"
        >          <canvas 
            ref="waveformCanvas" 
            class="waveform-canvas"
          ></canvas>
          <div class="recording-overlay">
            <span class="recording-indicator">●</span>
            <span class="recording-label">録音中...</span>
          </div>
        </div>

        <!-- 録音停止後：波形＋スペクトログラム表示（将来実装） -->
        <div 
          v-else-if="recordingState === RecordingState.IDLE && hasRecordings"
          class="visualization-container analysis-visualization"
        >
          <div class="placeholder-content">
            <div class="placeholder-waveform">
              <div class="waveform-placeholder"></div>
              <span class="placeholder-label">波形データ</span>
            </div>
            <div class="placeholder-spectrogram">
              <div class="spectrogram-placeholder"></div>
              <span class="placeholder-label">スペクトログラム</span>
            </div>
          </div>
          <div class="analysis-overlay">
            <span class="analysis-label">録音完了 - 解析データ表示予定</span>
          </div>
        </div>

        <!-- 待機中：ヒント表示 -->
        <div 
          v-else
          class="visualization-container idle-state"
        >
          <div class="recording-hints">
            <div class="hint-item">
              <span class="hint-icon">💡</span>
              <span class="hint-text">静かな環境で録音することを推奨します</span>
            </div>
            <div class="hint-item">
              <span class="hint-icon">🎯</span>
              <span class="hint-text">マイクから15-20cm程度の距離を保ってください</span>
            </div>
            <div class="hint-item">
              <span class="hint-icon">🎤</span>
              <span class="hint-text">録音開始ボタンまたはスペースキーで開始できます</span>
            </div>
          </div>
        </div>
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
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, VideoPause, Refresh, VideoPlay, VideoPause as PauseIcon, CaretRight } from '@element-plus/icons-vue'
import { RecordingState, Recording } from '../../common/types'
import { recordingService } from '../services/recordingService'

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
const waveformCanvas = ref<HTMLCanvasElement>()
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
onMounted(() => {
  // 時間更新のイベントハンドラーのみ設定（UI表示用）
  recordingService.onTimeUpdate = (seconds) => {
    recordingTime.value = seconds
  }
  
  // リサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize)
  
  // キャンバスの基本初期化（録音開始前の準備）
  nextTick(() => {
    if (waveformCanvas.value) {
      console.log('Initial canvas setup on mount')
      setupCanvas()
    }
  })
  
  console.log('RecordingControls mounted, canvas will be initialized when recording starts')
})

// キャンバスの基本設定
const setupCanvas = () => {
  const canvas = waveformCanvas.value
  if (!canvas) {
    console.warn('Canvas element not available for setup')
    return
  }
  
  // キャンバスサイズを親要素に合わせる
  const container = canvas.parentElement
  if (container) {
    const rect = container.getBoundingClientRect()
    console.log('Container rect:', rect)
    
    // 親要素のサイズが0の場合は少し待ってから再試行
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Container size is 0, retrying in 50ms...')
      setTimeout(() => setupCanvas(), 50)
      return
    }
    
    // 最小サイズを確保
    const width = Math.max(rect.width, 400)
    const height = Math.max(rect.height, 200)
    
    canvas.width = width
    canvas.height = height
    console.log('Canvas size set to:', canvas.width, 'x', canvas.height)
    
    // 高DPI対応
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const devicePixelRatio = window.devicePixelRatio || 1
      if (devicePixelRatio > 1) {
        canvas.width = width * devicePixelRatio
        canvas.height = height * devicePixelRatio
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'
        ctx.scale(devicePixelRatio, devicePixelRatio)
        console.log('High DPI scaling applied:', devicePixelRatio)
      }
    }
  } else {
    console.warn('Canvas container not found')
  }
  
  // 基本的な背景を描画（無音時の中央線）
  drawBasicWaveform()
}

// 基本的な波形（無音時）を描画
const drawBasicWaveform = () => {
  const canvas = waveformCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // キャンバスをクリア
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 背景色を設定
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // 中央線を描画（無音時の基準線）
  ctx.strokeStyle = '#4ade80'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, canvas.height / 2)
  ctx.lineTo(canvas.width, canvas.height / 2)
  ctx.stroke()
  
  console.log('Basic waveform drawn')
}

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
    console.error('Failed to play recording:', error)
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
      console.error('Failed to resume playback:', error)
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

// 録音状態の監視
watch(() => props.recordingState, (newState, oldState) => {
  console.log('Recording state changed:', oldState, '->', newState)
  
  if (newState === RecordingState.IDLE) {
    recordingTime.value = 0
    // 録音停止時に波形描画を停止
    recordingService.stopWaveformDrawing()
  }
  
  // 録音開始時に波形描画を開始
  if (newState === RecordingState.RECORDING && oldState === RecordingState.IDLE) {
    console.log('Recording state changed to RECORDING, starting waveform')
    
    // nextTickでDOMの更新を待ってからキャンバスを設定
    nextTick(() => {
      if (waveformCanvas.value) {
        console.log('Canvas element found, setting up...')
        // キャンバスサイズを設定
        setupCanvas()
        
        // analyserの準備完了を待ってから波形描画を開始
        const waitForAnalyser = () => {
          if (waveformCanvas.value && recordingService.isAnalyserReady() && recordingService.isRecording()) {
            console.log('Analyser ready, starting waveform drawing')
            recordingService.startWaveformDrawing(waveformCanvas.value)
          } else if (recordingService.isRecording()) {
            // まだ準備ができていない場合は50ms後に再試行
            console.log('Analyser not ready yet, retrying in 50ms...')
            setTimeout(waitForAnalyser, 50)
          } else {
            console.warn('Recording stopped before analyser was ready')
          }
        }
        
        // 少し待ってからanalyserの準備確認を開始
        setTimeout(waitForAnalyser, 100)
      } else {
        console.warn('Waveform canvas not available after nextTick')
      }
    })
  }
})

// ウィンドウリサイズ時の処理
const handleResize = () => {
  if (waveformCanvas.value && props.recordingState === RecordingState.RECORDING) {
    setupCanvas()
  }
}

onUnmounted(() => {
  // 音声再生のクリーンアップ
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  
  window.removeEventListener('resize', handleResize)
  recordingService.stopWaveformDrawing()
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

.visualization-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 録音中の波形表示 */
.recording-visualization {
  background: linear-gradient(135deg, var(--gray-900), #1a1a1a);
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-md);
  background: transparent;
}

.recording-overlay {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--error-color);
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: rgba(0, 0, 0, 0.7);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
}

.recording-indicator {
  font-size: var(--font-size-lg);
  animation: pulse 1s ease-in-out infinite;
}

.recording-label {
  color: white;
}

/* 解析表示（将来実装用） */
.analysis-visualization {
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  flex-direction: column;
}

.placeholder-content {
  display: flex;
  width: 100%;
  height: 100%;
  gap: var(--space-xs);
}

.placeholder-waveform,
.placeholder-spectrogram {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.waveform-placeholder {
  width: 100%;
  height: 60px;
  background: repeating-linear-gradient(
    90deg,
    var(--primary-color)20 0px,
    var(--primary-color)20 2px,
    transparent 2px,
    transparent 8px
  );
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

.waveform-placeholder::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 2s infinite;
}

.spectrogram-placeholder {
  width: 100%;
  height: 60px;
  background: linear-gradient(
    to bottom,
    var(--warning-color)30 0%,
    var(--success-color)30 50%,
    var(--info-color)30 100%
  );
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

.spectrogram-placeholder::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite 0.5s;
}

.placeholder-label {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  font-weight: 500;
}

.analysis-overlay {
  position: absolute;
  bottom: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

/* 待機状態 */
.idle-state {
  background: var(--bg-primary);
  padding: var(--space-lg);
}

.recording-hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 100%;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--gray-50);
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
}

.hint-icon {
  font-size: var(--font-size-base);
  flex-shrink: 0;
}

.hint-text {
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  font-weight: 500;
  line-height: 1.4;
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
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes buttonPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
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
  
  .placeholder-content {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .recording-hints {
    gap: var(--space-sm);
  }
  
  .hint-text {
    font-size: var(--font-size-xs);
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
</style>