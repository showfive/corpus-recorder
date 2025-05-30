import { createLogger } from '../../common/logger'
import { 
  performanceOptimizer, 
  FPSMonitor, 
  MemoryPool,
  uint8ArrayPool,
  floatArrayPool 
} from '../../common/performance'
import { AudioWorkerService } from './audioWorkerService'
import { audioBufferToWav } from '../utils/audioUtils'

const logger = createLogger('OptimizedAudioService')

/**
 * 音声処理統計情報
 */
export interface AudioProcessingStats {
  totalProcessingTime: number
  workerUtilization: number
  memoryPoolUtilization: number
  processingQueue: number
  successRate: number
}

/**
 * 最適化された音声処理サービス
 */
export class OptimizedAudioService {
  private static instance: OptimizedAudioService
  private audioWorkerService: AudioWorkerService | null = null
  private processingQueue: Array<{ id: string; priority: number }> = []
  private stats: AudioProcessingStats = {
    totalProcessingTime: 0,
    workerUtilization: 0,
    memoryPoolUtilization: 0,
    processingQueue: 0,
    successRate: 0
  }
  private processingHistory: Array<{ success: boolean; duration: number }> = []
  private readonly maxHistorySize = 100

  constructor() {
    this.initializeWorkerService()
  }

  static getInstance(): OptimizedAudioService {
    if (!OptimizedAudioService.instance) {
      OptimizedAudioService.instance = new OptimizedAudioService()
    }
    return OptimizedAudioService.instance
  }

  private async initializeWorkerService(): Promise<void> {
    try {
      this.audioWorkerService = new AudioWorkerService()
      logger.info('Audio worker service initialized for optimization')
    } catch (error) {
      logger.warn('Failed to initialize audio worker service', { error })
    }
  }

  /**
   * 最適化されたWAV変換（プール使用、並列処理対応）
   */
  async convertToWavOptimized(audioBuffer: AudioBuffer): Promise<ArrayBuffer> {
    const startTime = performance.now()
    const taskId = `wav-convert-${Date.now()}`

    this.addToProcessingQueue(taskId, 1)

    try {
      let result: ArrayBuffer

      // Web Workerが利用可能で、バッファサイズが大きい場合は並列処理
      if (this.audioWorkerService && audioBuffer.length > 44100) { // 1秒以上の音声
        logger.debug('Using optimized worker conversion', {
          bufferLength: audioBuffer.length,
          duration: audioBuffer.duration
        })

        result = await this.audioWorkerService.convertToWav(audioBuffer)
      } else {
        // 小さなバッファや Worker 未対応時はメインスレッド処理
        logger.debug('Using optimized main thread conversion', {
          bufferLength: audioBuffer.length,
          reason: this.audioWorkerService ? 'small_buffer' : 'no_worker'
        })

        result = audioBufferToWav(audioBuffer)
      }

      const processingTime = performance.now() - startTime
      this.updateProcessingStats(true, processingTime)

      logger.info('Optimized WAV conversion completed', {
        taskId,
        processingTime: `${processingTime.toFixed(2)}ms`,
        outputSize: result.byteLength
      })

      return result

    } catch (error) {
      const processingTime = performance.now() - startTime
      this.updateProcessingStats(false, processingTime)

      logger.error('Optimized WAV conversion failed', {
        taskId,
        error: error instanceof Error ? error.message : error,
        processingTime: `${processingTime.toFixed(2)}ms`
      })

      throw error
    } finally {
      this.removeFromProcessingQueue(taskId)
    }
  }

  /**
   * バッチ音声処理（複数ファイルの効率的処理）
   */
  async processBatch(
    audioBuffers: AudioBuffer[],
    operations: ('wav' | 'volume' | 'waveform' | 'spectrum')[],
    batchSize: number = 3
  ): Promise<Array<{
    wav?: ArrayBuffer
    volume?: { peak: number; rms: number; averageVolume: number }
    waveform?: Float32Array
    spectrum?: Float32Array
  }>> {
    logger.info('Starting batch audio processing', {
      bufferCount: audioBuffers.length,
      operations,
      batchSize
    })

    const results: Array<any> = new Array(audioBuffers.length)

    // バッチ処理で効率化（修正版）
    for (let i = 0; i < audioBuffers.length; i += batchSize) {
      const batch = audioBuffers.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (buffer, batchIndex) => {
          const actualIndex = i + batchIndex
          const taskId = `batch-${actualIndex}`
          this.addToProcessingQueue(taskId, 2)

          try {
            const bufferResults: any = {}

            // 並列処理可能な操作をグループ化
            const promises: Promise<any>[] = []

            if (operations.includes('wav')) {
              promises.push(
                this.convertToWavOptimized(buffer).then(wav => {
                  bufferResults.wav = wav
                })
              )
            }

            if (this.audioWorkerService) {
              if (operations.includes('volume')) {
                promises.push(
                  this.audioWorkerService.analyzeVolume(buffer).then(volume => {
                    bufferResults.volume = volume
                  })
                )
              }

              if (operations.includes('waveform')) {
                promises.push(
                  this.audioWorkerService.generateWaveform(buffer).then(waveform => {
                    bufferResults.waveform = waveform
                  })
                )
              }

              if (operations.includes('spectrum')) {
                promises.push(
                  this.audioWorkerService.calculateSpectrum(buffer).then(spectrum => {
                    bufferResults.spectrum = spectrum
                  })
                )
              }
            }

            await Promise.allSettled(promises)
            results[actualIndex] = bufferResults

          } catch (error) {
            logger.error('Batch processing error', {
              index: actualIndex,
              error: error instanceof Error ? error.message : error
            })
            results[actualIndex] = {}
          } finally {
            this.removeFromProcessingQueue(taskId)
          }
        })
      )

      // バッチ間でのインターバル
      if (i + batchSize < audioBuffers.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    logger.info('Batch audio processing completed', {
      processedCount: results.length,
      successCount: results.filter(r => Object.keys(r).length > 0).length
    })

    return results
  }

  /**
   * メモリプールを活用した音声データバッファリング
   */
  createOptimizedBuffer(size: number, type: 'uint8' | 'float32' = 'uint8'): Uint8Array | Float32Array {
    if (type === 'uint8') {
      const buffer = uint8ArrayPool.acquire()
      if (buffer.length < size) {
        return new Uint8Array(size)
      }
      return buffer.subarray(0, size)
    } else {
      const buffer = floatArrayPool.acquire()
      if (buffer.length < size) {
        return new Float32Array(size)
      }
      return buffer.subarray(0, size)
    }
  }

  /**
   * バッファの解放
   */
  releaseOptimizedBuffer(buffer: Uint8Array | Float32Array): void {
    if (buffer instanceof Uint8Array) {
      uint8ArrayPool.release(buffer)
    } else {
      floatArrayPool.release(buffer)
    }
  }

  /**
   * リアルタイム音声データの最適化処理
   */
  processRealtimeData = performanceOptimizer.throttleFrame(
    'realtime-audio',
    (data: Uint8Array, callback: (processedData: Uint8Array) => void) => {
      // メモリプールからバッファを取得
      const processedBuffer = this.createOptimizedBuffer(data.length, 'uint8') as Uint8Array

      // 高速データコピー
      processedBuffer.set(data)

      // コールバック実行
      callback(processedBuffer)

      // バッファを解放
      this.releaseOptimizedBuffer(processedBuffer)
    },
    60 // 60FPSで制限
  )

  /**
   * キューイング処理
   */
  private addToProcessingQueue(taskId: string, priority: number): void {
    this.processingQueue.push({ id: taskId, priority })
    this.processingQueue.sort((a, b) => b.priority - a.priority)
    this.updateStats()
  }

  private removeFromProcessingQueue(taskId: string): void {
    this.processingQueue = this.processingQueue.filter(task => task.id !== taskId)
    this.updateStats()
  }

  /**
   * 統計情報の更新
   */
  private updateProcessingStats(success: boolean, duration: number): void {
    this.processingHistory.push({ success, duration })

    // 履歴サイズ制限
    if (this.processingHistory.length > this.maxHistorySize) {
      this.processingHistory.shift()
    }

    this.updateStats()
  }

  private updateStats(): void {
    const totalDuration = this.processingHistory.reduce((sum, record) => sum + record.duration, 0)
    const successCount = this.processingHistory.filter(record => record.success).length

    this.stats = {
      totalProcessingTime: totalDuration,
      workerUtilization: this.audioWorkerService ? 0.8 : 0, // 仮の値
      memoryPoolUtilization: (uint8ArrayPool.getStats().utilization + floatArrayPool.getStats().utilization) / 2,
      processingQueue: this.processingQueue.length,
      successRate: this.processingHistory.length > 0 ? successCount / this.processingHistory.length : 1
    }
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceStats(): AudioProcessingStats {
    return { ...this.stats }
  }

  /**
   * 詳細な診断情報
   */
  getDiagnostics(): {
    stats: AudioProcessingStats
    poolStats: {
      uint8Array: ReturnType<typeof uint8ArrayPool.getStats>
      floatArray: ReturnType<typeof floatArrayPool.getStats>
    }
    queueInfo: Array<{ id: string; priority: number }>
    workerInfo: any
  } {
    return {
      stats: this.getPerformanceStats(),
      poolStats: {
        uint8Array: uint8ArrayPool.getStats(),
        floatArray: floatArrayPool.getStats()
      },
      queueInfo: [...this.processingQueue],
      workerInfo: this.audioWorkerService ? 'available' : 'unavailable'
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.audioWorkerService) {
      this.audioWorkerService.destroy()
    }

    this.processingQueue = []
    this.processingHistory = []

    // メモリプールをクリア
    uint8ArrayPool.clear()
    floatArrayPool.clear()

    logger.info('Optimized audio service cleaned up')
  }
}

// グローバルインスタンス
export const optimizedAudioService = OptimizedAudioService.getInstance() 