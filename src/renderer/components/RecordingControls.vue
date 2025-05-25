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
          </el-button>

          <el-button
            v-if="recordingState === RecordingState.IDLE && hasRecorded"
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
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Microphone, VideoPause, Refresh } from '@element-plus/icons-vue'
import { RecordingState } from '../../common/types'
import { audioBufferToWav, blobToAudioBuffer } from '../utils/audioUtils'

interface Props {
  recordingState: RecordingState
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording', data: { arrayBuffer: ArrayBuffer; duration: number }): void
  (e: 'retry-recording'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 録音関連の状態
const hasRecorded = ref(false)
const recordingTime = ref(0)
const waveformCanvas = ref<HTMLCanvasElement>()

// Web Audio API関連
let audioContext: AudioContext | null = null
let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let analyser: AnalyserNode | null = null
let animationId: number | null = null
let startTime: number = 0
let timerInterval: number | null = null

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
const startRecording = async () => {
  try {
    // マイクへのアクセス許可を取得
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    
    // AudioContextの初期化
    audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    
    // アナライザーの設定（波形表示用）
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    
    // MediaRecorderの設定
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data)
    }
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const duration = (Date.now() - startTime) / 1000
      
      try {
        // WebM/OggをAudioBufferに変換してからWAVに変換
        const audioBuffer = await blobToAudioBuffer(audioBlob, audioContext!)
        const wavArrayBuffer = audioBufferToWav(audioBuffer)
        
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop())
        
        emit('stop-recording', { arrayBuffer: wavArrayBuffer, duration })
        hasRecorded.value = true
      } catch (error) {
        console.error('Failed to convert audio:', error)
        ElMessage.error('音声の変換に失敗しました')
        // ストリームを停止
        stream.getTracks().forEach(track => track.stop())
      } finally {
        // AudioContext停止（最後に実行）
        if (audioContext) {
          audioContext.close()
          audioContext = null
        }
      }
    }
    
    // 録音開始
    mediaRecorder.start()
    startTime = Date.now()
    emit('start-recording')
    
    // タイマー開始
    timerInterval = window.setInterval(() => {
      recordingTime.value = Math.floor((Date.now() - startTime) / 1000)
    }, 100)
    
    // 波形描画開始
    drawWaveform()
    
  } catch (error) {
    console.error('Failed to start recording:', error)
    ElMessage.error('マイクへのアクセスに失敗しました')
  }
}

// 録音停止
const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
    
    // タイマー停止
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    
    // 波形描画停止
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    
    // AudioContextのクリーンアップはonstopイベントで行う
  }
}

// やり直し
const retryRecording = () => {
  hasRecorded.value = false
  recordingTime.value = 0
  emit('retry-recording')
}

// 波形描画
const drawWaveform = () => {
  if (!analyser || !waveformCanvas.value) return
  
  const canvas = waveformCanvas.value
  const canvasCtx = canvas.getContext('2d')!
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
    const draw = () => {
    animationId = requestAnimationFrame(draw)
    
    if (!analyser) return
    analyser.getByteTimeDomainData(dataArray)
    
    canvasCtx.fillStyle = 'rgb(245, 247, 250)'
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height)
    
    canvasCtx.lineWidth = 2
    canvasCtx.strokeStyle = 'rgb(64, 158, 255)'
    canvasCtx.beginPath()
    
    const sliceWidth = canvas.width / bufferLength
    let x = 0
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = v * canvas.height / 2
      
      if (i === 0) {
        canvasCtx.moveTo(x, y)
      } else {
        canvasCtx.lineTo(x, y)
      }
      
      x += sliceWidth
    }
    
    canvasCtx.lineTo(canvas.width, canvas.height / 2)
    canvasCtx.stroke()
  }
  
  draw()
}

// 時間フォーマット
const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// クリーンアップ
onUnmounted(() => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording()
  }
})

// 録音状態の監視
watch(() => props.recordingState, (newState) => {
  if (newState === RecordingState.IDLE) {
    recordingTime.value = 0
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