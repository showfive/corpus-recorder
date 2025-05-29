import { ref, computed, onUnmounted, readonly } from 'vue'
import { container } from '../../common/di/container'
import { RecordingService } from '../services/recordingService'
import { RecordingState, AudioQualitySettings } from '../../common/types'

export function useRecording() {
  // 状態管理
  const isRecording = ref(false)
  const recordingTime = ref(0)
  const recordingState = ref<RecordingState>(RecordingState.IDLE)
  const lastError = ref<string | null>(null)
  const waveformData = ref<Uint8Array | null>(null)

  // サービスインスタンス
  const recordingService = container.resolve<RecordingService>('recordingService')

  // Computed
  const formattedTime = computed(() => {
    const minutes = Math.floor(recordingTime.value / 60)
    const seconds = Math.floor(recordingTime.value % 60)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const canStartRecording = computed(() => recordingState.value === RecordingState.IDLE)
  const canStopRecording = computed(() => recordingState.value === RecordingState.RECORDING)

  // イベントハンドラー設定
  recordingService.onRecordingStart = () => {
    isRecording.value = true
    recordingState.value = RecordingState.RECORDING
    lastError.value = null
  }

  recordingService.onRecordingComplete = () => {
    isRecording.value = false
    recordingState.value = RecordingState.IDLE
    recordingTime.value = 0
  }

  recordingService.onRecordingError = (error: string) => {
    lastError.value = error
    isRecording.value = false
    recordingState.value = RecordingState.IDLE
    recordingTime.value = 0
  }

  recordingService.onTimeUpdate = (seconds: number) => {
    recordingTime.value = seconds
  }

  // メソッド
  const startRecording = async () => {
    lastError.value = null
    try {
      await recordingService.startRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = () => {
    recordingService.stopRecording()
  }

  const retryRecording = () => {
    recordingService.retryRecording()
  }

  const resetState = () => {
    recordingService.resetState()
    isRecording.value = false
    recordingTime.value = 0
    recordingState.value = RecordingState.IDLE
    lastError.value = null
  }

  const updateAudioSettings = (settings: AudioQualitySettings) => {
    recordingService.updateAudioSettings(settings)
  }

  const getWaveformData = () => {
    const data = recordingService.getWaveformData()
    waveformData.value = data
    return data
  }

  // クリーンアップ
  onUnmounted(() => {
    recordingService.destroy()
  })

  return {
    // 状態
    isRecording: readonly(isRecording),
    recordingTime: readonly(recordingTime),
    recordingState: readonly(recordingState),
    lastError: readonly(lastError),
    waveformData: readonly(waveformData),
    
    // Computed
    formattedTime,
    canStartRecording,
    canStopRecording,
    
    // メソッド
    startRecording,
    stopRecording,
    retryRecording,
    resetState,
    updateAudioSettings,
    getWaveformData
  }
} 