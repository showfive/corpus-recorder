import { RecordingState } from '../../common/types'
import { blobToAudioBuffer, audioBufferToWav } from '../utils/audioUtils'

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

  // イベントハンドラー
  public onRecordingComplete: ((data: RecordingData) => void) | null = null
  public onRecordingError: ((error: string) => void) | null = null
  public onRecordingStart: (() => void) | null = null
  public onRecordingRetry: (() => void) | null = null
  public onTimeUpdate: ((seconds: number) => void) | null = null

  private state: RecordingState = RecordingState.IDLE
  /**
   * 録音を開始する
   */
  async startRecording(): Promise<void> {
    try {
      if (this.state !== RecordingState.IDLE) {
        throw new Error('録音は既に開始されています')
      }

      // マイクへのアクセス許可を取得
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // AudioContextの初期化
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(this.stream)
        // アナライザーの設定（波形表示用）
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      source.connect(this.analyser)
      
      console.log('Analyser created and connected:', {
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount
      })
      
      // MediaRecorderの設定
      this.mediaRecorder = new MediaRecorder(this.stream)
      this.audioChunks = []
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data)
      }
      
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        const duration = (Date.now() - this.startTime) / 1000
        
        try {
          // WebM/OggをAudioBufferに変換してからWAVに変換
          const audioBuffer = await blobToAudioBuffer(audioBlob, this.audioContext!)
          const wavArrayBuffer = audioBufferToWav(audioBuffer)
          
          // 録音完了通知
          if (this.onRecordingComplete) {
            this.onRecordingComplete({ arrayBuffer: wavArrayBuffer, duration })
          }
          
        } catch (error) {
          console.error('Failed to convert audio:', error)
          if (this.onRecordingError) {
            this.onRecordingError('音声の変換に失敗しました')
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
      
      console.log('Recording started:', {
        state: this.state,
        hasAnalyser: !!this.analyser,
        startTime: this.startTime
      })
      
      // 録音開始通知
      if (this.onRecordingStart) {
        this.onRecordingStart()
      }
      
      // タイマー開始
      this.startTimer()
      
    } catch (error) {
      console.error('Failed to start recording:', error)
      this.state = RecordingState.IDLE
      if (this.onRecordingError) {
        this.onRecordingError('マイクへのアクセスに失敗しました')
      }
    }
  }

  /**
   * 録音を停止する
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop()
      this.state = RecordingState.PROCESSING
      
      // タイマー停止
      this.stopTimer()
      
      // 波形描画停止
      if (this.animationId) {
        cancelAnimationFrame(this.animationId)
        this.animationId = null
      }
    }
  }
  /**
   * 録音をやり直す
   */
  retryRecording(): void {
    this.cleanup()
    if (this.onRecordingRetry) {
      this.onRecordingRetry()
    }
  }

  /**
   * 状態をリセットする（外部から呼び出し可能）
   */
  resetState(): void {
    this.state = RecordingState.IDLE
  }
  /**
   * 波形データを取得する（波形表示用）
   */
  getWaveformData(): Uint8Array | null {
    if (!this.analyser) return null
    
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteTimeDomainData(dataArray)
    return dataArray
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
  }
  /**
   * 波形描画を開始する
   */
  startWaveformDrawing(canvas: HTMLCanvasElement): void {
    console.log('startWaveformDrawing called:', {
      analyser: !!this.analyser,
      isRecording: this.isRecording(),
      state: this.state
    })
    
    if (!this.analyser) {
      console.warn('Analyser not available for waveform drawing')
      return
    }

    const canvasCtx = canvas.getContext('2d')!
    
    const draw = () => {
      if (!this.isRecording()) {
        console.log('Stopping waveform drawing - not recording')
        return
      }
      
      this.animationId = requestAnimationFrame(draw)
      
      const dataArray = this.getWaveformData()
      if (!dataArray) {
        console.warn('No waveform data available')
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
    
    console.log('Starting waveform animation loop')
    draw()
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
  }
  /**
   * リソースをクリーンアップする（状態は変更しない）
   */
  private cleanupResources(): void {
    this.stopTimer()
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.mediaRecorder = null
    this.analyser = null
    this.audioChunks = []
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