import { createLogger } from '../../common/logger'

// タスクの型定義
export interface AudioProcessingTask {
  id: string
  type: 'convert-to-wav' | 'analyze-volume' | 'generate-waveform' | 'calculate-spectrum'
  data: any
}

export interface AudioProcessingResult {
  id: string
  success: boolean
  result?: any
  error?: string
  processingTime: number
}

// タスクキューのアイテム
interface QueuedTask {
  task: AudioProcessingTask
  resolve: (result: AudioProcessingResult) => void
  reject: (error: Error) => void
  timestamp: number
}

/**
 * Audio Worker Service
 * Web Workerを使用した音声処理の管理
 */
export class AudioWorkerService {
  private workers: Worker[] = []
  private taskQueue: QueuedTask[] = []
  private pendingTasks: Map<string, QueuedTask> = new Map()
  private isInitialized = false
  private workerCount = 2 // CPUコア数に応じて調整
  private logger = createLogger('AudioWorkerService')

  constructor() {
    this.initializeWorkers()
  }

  /**
   * Web Workerを初期化
   */
  private async initializeWorkers(): Promise<void> {
    this.logger.info('Initializing audio workers...', { workerCount: this.workerCount })

    try {
      // 複数のワーカーを作成
      for (let i = 0; i < this.workerCount; i++) {
        const worker = new Worker(
          new URL('../workers/audioProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        )

        // ワーカーからのメッセージを処理
        worker.onmessage = (event: MessageEvent<AudioProcessingResult>) => {
          this.handleWorkerMessage(event.data, i)
        }

        // ワーカーエラーハンドリング
        worker.onerror = (error) => {
          this.logger.error(`Worker ${i} error:`, error)
        }

        this.workers.push(worker)
      }

      this.isInitialized = true
      this.logger.info('Audio workers initialized successfully')
      
      // キューに残っているタスクを処理
      this.processQueue()
      
    } catch (error) {
      this.logger.error('Failed to initialize workers:', error)
      throw new Error('Web Worker initialization failed')
    }
  }

  /**
   * ワーカーからのメッセージを処理
   */
  private handleWorkerMessage(result: AudioProcessingResult, workerIndex: number): void {
    if (result.id === 'worker-ready') {
      this.logger.debug(`Worker ${workerIndex} is ready`)
      return
    }

    const queuedTask = this.pendingTasks.get(result.id)
    if (!queuedTask) {
      this.logger.warn(`Received result for unknown task: ${result.id}`)
      return
    }

    this.pendingTasks.delete(result.id)

    if (result.success) {
      this.logger.debug(`Task ${result.id} completed in ${result.processingTime.toFixed(2)}ms`)
      queuedTask.resolve(result)
    } else {
      this.logger.error(`Task ${result.id} failed:`, result.error)
      queuedTask.reject(new Error(result.error || 'Unknown worker error'))
    }

    // 次のタスクを処理
    this.processQueue()
  }

  /**
   * キューからタスクを処理
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return

    // 利用可能なワーカーを見つける
    const availableWorkerIndex = this.findAvailableWorker()
    if (availableWorkerIndex === -1) return

    const queuedTask = this.taskQueue.shift()
    if (!queuedTask) return

    this.pendingTasks.set(queuedTask.task.id, queuedTask)
    this.workers[availableWorkerIndex].postMessage(queuedTask.task)

    this.logger.debug(`Task ${queuedTask.task.id} assigned to worker ${availableWorkerIndex}`)
  }

  /**
   * 利用可能なワーカーを見つける
   */
  private findAvailableWorker(): number {
    // 簡単な実装：ラウンドロビン方式
    for (let i = 0; i < this.workers.length; i++) {
      // 実際の実装では、各ワーカーの負荷を監視する必要がある
      return i % this.workers.length
    }
    return 0
  }

  /**
   * AudioBufferを転送可能な形式に変換
   */
  private serializeAudioBuffer(audioBuffer: AudioBuffer): {
    sampleRate: number
    numberOfChannels: number
    length: number
    channelData: Float32Array[]
  } {
    const channelData: Float32Array[] = []
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      channelData.push(new Float32Array(audioBuffer.getChannelData(channel)))
    }

    return {
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
      channelData
    }
  }

  /**
   * WAV変換タスクをワーカーに送信
   */
  async convertToWav(audioBuffer: AudioBuffer): Promise<ArrayBuffer> {
    const taskId = `wav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const task: AudioProcessingTask = {
      id: taskId,
      type: 'convert-to-wav',
      data: {
        bufferData: this.serializeAudioBuffer(audioBuffer)
      }
    }

    return this.executeTask(task)
  }

  /**
   * 音量解析タスクをワーカーに送信
   */
  async analyzeVolume(audioBuffer: AudioBuffer): Promise<{
    peak: number
    rms: number
    averageVolume: number
  }> {
    const taskId = `volume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const task: AudioProcessingTask = {
      id: taskId,
      type: 'analyze-volume',
      data: {
        bufferData: this.serializeAudioBuffer(audioBuffer)
      }
    }

    return this.executeTask(task)
  }

  /**
   * 波形生成タスクをワーカーに送信
   */
  async generateWaveform(audioBuffer: AudioBuffer, targetWidth: number = 1000): Promise<Float32Array> {
    const taskId = `waveform-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const task: AudioProcessingTask = {
      id: taskId,
      type: 'generate-waveform',
      data: {
        bufferData: this.serializeAudioBuffer(audioBuffer),
        targetWidth
      }
    }

    return this.executeTask(task)
  }

  /**
   * スペクトラム計算タスクをワーカーに送信
   */
  async calculateSpectrum(audioBuffer: AudioBuffer, fftSize: number = 2048): Promise<Float32Array> {
    const taskId = `spectrum-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const task: AudioProcessingTask = {
      id: taskId,
      type: 'calculate-spectrum',
      data: {
        bufferData: this.serializeAudioBuffer(audioBuffer),
        fftSize
      }
    }

    return this.executeTask(task)
  }

  /**
   * タスクを実行（キューまたは直接実行）
   */
  private executeTask<T = any>(task: AudioProcessingTask): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask = {
        task,
        resolve: (result) => resolve(result.result),
        reject,
        timestamp: Date.now()
      }

      if (this.isInitialized) {
        // 利用可能なワーカーがあれば即座に実行
        const availableWorkerIndex = this.findAvailableWorker()
        if (availableWorkerIndex !== -1 && this.pendingTasks.size < this.workers.length) {
          this.pendingTasks.set(task.id, queuedTask)
          this.workers[availableWorkerIndex].postMessage(task)
          this.logger.debug(`Task ${task.id} executed immediately on worker ${availableWorkerIndex}`)
        } else {
          // キューに追加
          this.taskQueue.push(queuedTask)
          this.logger.debug(`Task ${task.id} queued`)
        }
      } else {
        // ワーカーが初期化されていない場合はキューに追加
        this.taskQueue.push(queuedTask)
        this.logger.debug(`Task ${task.id} queued (workers not ready)`)
      }
    })
  }

  /**
   * サービスの破棄
   */
  destroy(): void {
    this.logger.info('Destroying audio worker service...')
    
    // 全ワーカーを終了
    this.workers.forEach((worker, index) => {
      this.logger.debug(`Terminating worker ${index}`)
      worker.terminate()
    })
    
    this.workers = []
    this.taskQueue = []
    this.pendingTasks.clear()
    this.isInitialized = false
    
    this.logger.info('Audio worker service destroyed')
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): {
    workerCount: number
    queueSize: number
    pendingTasks: number
    isInitialized: boolean
  } {
    return {
      workerCount: this.workers.length,
      queueSize: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
      isInitialized: this.isInitialized
    }
  }
} 