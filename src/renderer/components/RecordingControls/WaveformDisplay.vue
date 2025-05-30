<template>
  <div class="waveform-display">
    <!-- 録音中：波形表示 -->
    <div 
      v-if="recordingState === RecordingState.RECORDING"
      class="visualization-container recording-visualization"
    >
      <canvas 
        ref="waveformCanvas" 
        class="waveform-canvas"
      ></canvas>
      <div class="recording-overlay">
        <span class="recording-indicator">●</span>
        <span class="recording-label">録音中...</span>
      </div>
    </div>

    <!-- 録音停止後：プレースホルダー表示（将来の拡張用） -->
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
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { RecordingState } from '../../../common/types'
import { useAudioVisualization } from '../../composables/useAudioVisualization'

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
}

const props = defineProps<Props>()

// 波形可視化Composable
const { startVisualization, stopVisualization, isAnalyserReady } = useAudioVisualization()

// キャンバス要素のref
const waveformCanvas = ref<HTMLCanvasElement>()

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

// ウィンドウリサイズ時の処理
const handleResize = () => {
  if (waveformCanvas.value && props.recordingState === RecordingState.RECORDING) {
    setupCanvas()
  }
}

// 録音状態の監視
watch(() => props.recordingState, (newState, oldState) => {
  console.log('Recording state changed:', oldState, '->', newState)
  
  if (newState === RecordingState.IDLE) {
    // 録音停止時に波形描画を停止
    stopVisualization()
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
          if (waveformCanvas.value) {
            if (isAnalyserReady.value) {
              console.log('Analyser ready, starting waveform drawing')
              startVisualization(waveformCanvas.value)
            } else {
              // まだ準備ができていない場合は50ms後に再試行
              console.log('Analyser not ready yet, retrying in 50ms...')
              setTimeout(waitForAnalyser, 50)
            }
          } else {
            console.warn('Canvas not available for waveform')
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

onMounted(() => {
  // リサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize)
  console.log('WaveformDisplay mounted')
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopVisualization()
})
</script>

<style scoped>
.waveform-display {
  width: 100%;
  height: 100%;
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

/* アニメーション */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
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
}
</style> 