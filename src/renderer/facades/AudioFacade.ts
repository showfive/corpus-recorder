import { container } from '../../common/di/container'
import { RecordingService } from '../services/recordingService'
import { AudioQualitySettings, RecordingState } from '../../common/types'

export interface AudioRecordingData {
  arrayBuffer: ArrayBuffer
  duration: number
}

export interface AudioVisualizationData {
  waveformData: Uint8Array | null
  isAnalyserReady: boolean
}

/**
 * 音声関連機能への統一インターフェース
 * 複数のサービスを束ねてシンプルなAPIを提供
 */
export class AudioFacade {
  private recordingService: RecordingService

  constructor() {
    this.recordingService = container.resolve<RecordingService>('recordingService')
  }

  // ===== 録音制御 =====
  async startRecording(): Promise<void> {
    return this.recordingService.startRecording()
  }

  stopRecording(): void {
    this.recordingService.stopRecording()
  }

  retryRecording(): void {
    this.recordingService.retryRecording()
  }

  resetRecording(): void {
    this.recordingService.resetState()
  }

  // ===== 状態取得 =====
  getRecordingState(): RecordingState {
    return this.recordingService.getState()
  }

  isRecording(): boolean {
    return this.recordingService.isRecording()
  }

  // ===== 可視化 =====
  getVisualizationData(): AudioVisualizationData {
    return {
      waveformData: this.recordingService.getWaveformData(),
      isAnalyserReady: this.recordingService.isAnalyserReady()
    }
  }

  startWaveformDrawing(canvas: HTMLCanvasElement): void {
    this.recordingService.startWaveformDrawing(canvas)
  }

  stopWaveformDrawing(): void {
    this.recordingService.stopWaveformDrawing()
  }

  // ===== 設定 =====
  updateAudioSettings(settings: AudioQualitySettings): void {
    this.recordingService.updateAudioSettings(settings)
  }

  // ===== イベントハンドラー設定 =====
  setEventHandlers(handlers: {
    onRecordingStart?: () => void
    onRecordingComplete?: (data: AudioRecordingData) => void
    onRecordingError?: (error: string) => void
    onRecordingRetry?: () => void
    onTimeUpdate?: (seconds: number) => void
  }): void {
    if (handlers.onRecordingStart) {
      this.recordingService.onRecordingStart = handlers.onRecordingStart
    }
    if (handlers.onRecordingComplete) {
      this.recordingService.onRecordingComplete = handlers.onRecordingComplete
    }
    if (handlers.onRecordingError) {
      this.recordingService.onRecordingError = handlers.onRecordingError
    }
    if (handlers.onRecordingRetry) {
      this.recordingService.onRecordingRetry = handlers.onRecordingRetry
    }
    if (handlers.onTimeUpdate) {
      this.recordingService.onTimeUpdate = handlers.onTimeUpdate
    }
  }

  // ===== ライフサイクル =====
  destroy(): void {
    this.recordingService.destroy()
  }
}

// ファサードのファクトリー関数
export function createAudioFacade(): AudioFacade {
  return new AudioFacade()
} 