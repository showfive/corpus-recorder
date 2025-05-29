import { RecordingState } from '../../common/types'
import { blobToAudioBuffer, audioBufferToWav } from '../utils/audioUtils'
import { createLogger } from '../../common/logger'
import { errorHandler, ErrorCategory } from '../../common/errorHandler'

/**
 * 録音データ
 */
export interface RecordingData {
  arrayBuffer: ArrayBuffer
  duration: number
}

/**
 * 録音サービスクラス
 * MediaRecorder APIの操作と録音状態の管理を担当
 */
export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private audioChunks: Blob[] = []
  private startTime: number = 0
  private timerInterval: number | null = null
  private animationId: number | null = null
  private stream: MediaStream | null = null
  private logger = createLogger('RecordingService')

  // イベントハンドラー
  public onRecordingComplete: ((data: RecordingData) => void) | null = null
  public onRecordingError: ((error: string) => void) | null = null
  public onRecordingStart: (() => void) | null = null
  public onRecordingRetry: (() => void) | null = null
  public onTimeUpdate: ((seconds: number) => void) | null = null

  private state: RecordingState = RecordingState.IDLE  /**
   * 録音を開始する
   */
  async startRecording(): Promise<void> {
    this.logger.info('Starting recording...')
    this.logger.startPerformance('recording-start')
    
    try {
      if (this.state !== RecordingState.IDLE) {
        const error = new Error('録音は既に開始されています')
        this.logger.warn('Recording start attempted while not idle', { currentState: this.state })
        throw error
      }

      // マイクへのアクセス許可を取得
      this.logger.debug('Requesting microphone access...')
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.logger.info('Microphone access granted')
      
      // AudioContextの初期化
      this.logger.debug('Initializing AudioContext...')
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(this.stream)
      
      // アナライザーの設定（波形表示用）
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      source.connect(this.analyser)
      
      this.logger.debug('Analyser created and connected', {
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount,
        sampleRate: this.audioContext.sampleRate
      })
      
      // MediaRecorderの設定
      this.logger.debug('Setting up MediaRecorder...')
      this.mediaRecorder = new MediaRecorder(this.stream)
      this.audioChunks = []
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data)
        this.logger.debug('Audio data chunk received', { size: event.data.size })
      }
      
      this.mediaRecorder.onstop = async () => {
        this.logger.info('MediaRecorder stopped, processing audio...')
        this.logger.startPerformance('audio-processing')
        
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        const duration = (Date.now() - this.startTime) / 1000
        
        this.logger.info('Audio blob created', { 
          size: audioBlob.size, 
          type: audioBlob.type, 
          duration: duration.toFixed(2) + 's' 
        })
        
        try {
          // WebM/OggをAudioBufferに変換してからWAVに変換
          const audioBuffer = await blobToAudioBuffer(audioBlob, this.audioContext!)
          this.logger.debug('Audio buffer created', {
            channels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
            length: audioBuffer.length,
            duration: audioBuffer.duration
          })
          
          const wavArrayBuffer = audioBufferToWav(audioBuffer)
          this.logger.info('Audio converted to WAV', { size: wavArrayBuffer.byteLength })
          
          const processingTime = this.logger.endPerformance('audio-processing')
          this.logger.info('Audio processing completed', { processingTime: processingTime?.toFixed(2) + 'ms' })
          
          // 録音完了通知
          if (this.onRecordingComplete) {
            this.onRecordingComplete({ arrayBuffer: wavArrayBuffer, duration })
          }
          
        } catch (error) {
          this.logger.error('Failed to convert audio', { 
            error: error instanceof Error ? error.message : error,
            blobSize: audioBlob.size,
            blobType: audioBlob.type 
          })
          
          const appError = errorHandler.handle(error, {
            category: ErrorCategory.AUDIO_CONVERSION,
            userMessage: '音声の変換に失敗しました',
            suggestions: ['マイクの設定を確認してください', '録音を再試行してください']
          })
          
          if (this.onRecordingError) {
            this.onRecordingError(appError.userMessage)
          }
        } finally {
          // クリーンアップは外部で状態管理が行われるため、ここでは行わない
          this.cleanupResources()
        }
      }
      
      // 録音開始
      this.mediaRecorder.start()
      this.startTime = Date.now()
      this.state = RecordingState.RECORDING
      
      const startupTime = this.logger.endPerformance('recording-start')
      this.logger.info('Recording started successfully', {
        state: this.state,
        hasAnalyser: !!this.analyser,
        startTime: this.startTime,
        startupTime: startupTime?.toFixed(2) + 'ms'
      })
      
      // 録音開始通知
      if (this.onRecordingStart) {
        this.onRecordingStart()
      }
      
      // タイマー開始
      this.startTimer()
        } catch (error) {
      this.logger.error('Failed to start recording', { 
        error: error instanceof Error ? error.message : error,
        state: this.state 
      })
      
      this.state = RecordingState.IDLE
      this.cleanupResources()
      
      const appError = errorHandler.handle(error, {
        category: ErrorCategory.RECORDING_START,
        userMessage: 'マイクへのアクセスに失敗しました',
        suggestions: ['マイクの設定を確認してください', 'ブラウザでマイクの許可を与えてください']
      })
      
      if (this.onRecordingError) {
        this.onRecordingError(appError.userMessage)
      }
    }
  }
  /**
   * 録音を停止する
   */
  stopRecording(): void {
    this.logger.info('Stopping recording...', { 
      state: this.state,
      recordingDuration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0
    })
    
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.logger.debug('MediaRecorder is recording, stopping...')
        this.mediaRecorder.stop()
        this.state = RecordingState.PROCESSING
        
        this.logger.info('Recording stopped, state changed to PROCESSING')
        
        // タイマー停止
        this.stopTimer()
        this.logger.debug('Timer stopped')
        
        // 波形描画停止
        if (this.animationId) {
          cancelAnimationFrame(this.animationId)
          this.animationId = null
          this.logger.debug('Waveform drawing stopped')
        }
      } else {
        this.logger.warn('Cannot stop recording - MediaRecorder not in recording state', {
          hasMediaRecorder: !!this.mediaRecorder,
          mediaRecorderState: this.mediaRecorder?.state,
          currentState: this.state
        })
      }
    } catch (error) {
      this.logger.error('Error during recording stop', { 
        error: error instanceof Error ? error.message : error 
      })
      
      errorHandler.handle(error, {
        category: ErrorCategory.RECORDING_STOP,
        userMessage: '録音の停止に失敗しました',
        suggestions: ['録音を再試行してください']
      })
    }
  }  /**
   * 録音をやり直す
   */
  retryRecording(): void {
    this.logger.info('Retrying recording...', { currentState: this.state })
    
    try {
      this.cleanup()
      this.logger.debug('Cleanup completed for retry')
      
      if (this.onRecordingRetry) {
        this.onRecordingRetry()
        this.logger.debug('Recording retry callback executed')
      }
      
      this.logger.info('Recording retry initiated successfully')
    } catch (error) {
      this.logger.error('Error during recording retry', { 
        error: error instanceof Error ? error.message : error 
      })
      
      errorHandler.handle(error, {
        category: ErrorCategory.RECORDING_PROCESS,
        userMessage: '録音のやり直しに失敗しました',
        suggestions: ['ページを再読み込みして再試行してください']
      })
    }
  }
  /**
   * 状態をリセットする（外部から呼び出し可能）
   */
  resetState(): void {
    this.logger.info('Resetting recording state', { previousState: this.state })
    this.state = RecordingState.IDLE
    this.logger.debug('State reset to IDLE')
  }  /**
   * 波形データを取得する（波形表示用）
   */
  getWaveformData(): Uint8Array | null {
    if (!this.analyser) {
      this.logger.debug('Waveform data requested but analyser not available')
      return null
    }
    
    try {
      const bufferLength = this.analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      this.analyser.getByteTimeDomainData(dataArray)
      return dataArray
    } catch (error) {
      this.logger.error('Failed to get waveform data', { 
        error: error instanceof Error ? error.message : error 
      })
      return null
    }
  }

  /**
   * アナライザーが利用可能かどうかをチェック
   */
  isAnalyserReady(): boolean {
    return this.analyser !== null
  }

  /**
   * 現在の録音状態を取得
   */
  getState(): RecordingState {
    return this.state
  }

  /**
   * 録音中かどうか
   */
  isRecording(): boolean {
    return this.state === RecordingState.RECORDING
  }  /**
   * 波形描画を開始する
   */
  startWaveformDrawing(canvas: HTMLCanvasElement): void {
    this.logger.debug('Starting waveform drawing', {
      analyser: !!this.analyser,
      isRecording: this.isRecording(),
      state: this.state,
      canvasSize: `${canvas.width}x${canvas.height}`
    })
    
    if (!this.analyser) {
      this.logger.warn('Analyser not available for waveform drawing')
      return
    }

    try {
      const canvasCtx = canvas.getContext('2d')!
      
      const draw = () => {
        if (!this.isRecording()) {
          this.logger.debug('Stopping waveform drawing - not recording')
          return
        }
        
        this.animationId = requestAnimationFrame(draw)
        
        const dataArray = this.getWaveformData()
        if (!dataArray) {
          this.logger.warn('No waveform data available for drawing')
          return
        }
        
        canvasCtx.fillStyle = 'rgb(245, 247, 250)'
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height)
        
        canvasCtx.lineWidth = 2
        canvasCtx.strokeStyle = 'rgb(64, 158, 255)'
        canvasCtx.beginPath()
        
        const sliceWidth = canvas.width / dataArray.length
        let x = 0
        
        for (let i = 0; i < dataArray.length; i++) {
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
      
      this.logger.debug('Starting waveform animation loop')
      draw()
    } catch (error) {
      this.logger.error('Error in waveform drawing', { 
        error: error instanceof Error ? error.message : error 
      })
      
      errorHandler.handle(error, {
        category: ErrorCategory.UI_INTERACTION,
        userMessage: '波形表示でエラーが発生しました'
      })
    }
  }

  /**
   * タイマーを開始する
   */
  private startTimer(): void {
    this.timerInterval = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - this.startTime) / 1000)
      if (this.onTimeUpdate) {
        this.onTimeUpdate(seconds)
      }
    }, 100)
  }

  /**
   * タイマーを停止する
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }  /**
   * リソースをクリーンアップする（状態は変更しない）
   */
  private cleanupResources(): void {
    this.logger.debug('Cleaning up recording resources...')
    
    this.stopTimer()
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
      this.logger.debug('Animation frame cancelled')
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
      this.logger.debug('Media stream stopped and released')
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
      this.logger.debug('AudioContext closed')
    }
    
    this.mediaRecorder = null
    this.analyser = null
    this.audioChunks = []
    
    this.logger.info('Recording resources cleaned up successfully')
  }

  /**
   * リソースをクリーンアップする
   */
  private cleanup(): void {
    this.cleanupResources()
    this.state = RecordingState.IDLE
  }

  /**
   * サービスを破棄する
   */
  destroy(): void {
    if (this.isRecording()) {
      this.stopRecording()
    }
    this.cleanup()
  }
}

// シングルトンインスタンスとしてエクスポート
export const recordingService = new RecordingService()