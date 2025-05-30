import { createLogger } from '../logger'

const logger = createLogger('Performance')

// ===========================================
// パフォーマンス監視システム
// ===========================================

/**
 * メモリ使用量情報
 */
export interface MemoryUsageInfo {
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
}

/**
 * パフォーマンス測定結果
 */
export interface PerformanceMetrics {
  readonly startTime: number
  readonly endTime: number
  readonly duration: number
  readonly memoryUsage?: MemoryUsageInfo
  readonly frameCount?: number
  readonly averageFPS?: number
}

/**
 * メモリプール管理
 */
export class MemoryPool<T> {
  private readonly pool: T[] = []
  private readonly factory: () => T
  private readonly reset: (item: T) => void
  private readonly maxSize: number

  constructor(
    factory: () => T,
    reset: (item: T) => void,
    maxSize: number = 100
  ) {
    this.factory = factory
    this.reset = reset
    this.maxSize = maxSize
  }

  acquire(): T {
    const item = this.pool.pop()
    if (item) {
      logger.debug('Memory pool item acquired from pool', {
        poolSize: this.pool.length,
        itemType: typeof item
      })
      return item
    }

    const newItem = this.factory()
    logger.debug('Memory pool item created (pool empty)', {
      poolSize: this.pool.length,
      itemType: typeof newItem
    })
    return newItem
  }

  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(item)
      this.pool.push(item)
      logger.debug('Memory pool item released to pool', {
        poolSize: this.pool.length
      })
    } else {
      logger.debug('Memory pool full, item discarded', {
        poolSize: this.pool.length,
        maxSize: this.maxSize
      })
    }
  }

  clear(): void {
    this.pool.length = 0
    logger.info('Memory pool cleared')
  }

  getStats(): { poolSize: number; maxSize: number; utilization: number } {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      utilization: (this.maxSize - this.pool.length) / this.maxSize
    }
  }
}

/**
 * フレームレート監視
 */
export class FPSMonitor {
  private frameCount = 0
  private lastTime = 0
  private frameTimestamps: number[] = []
  private readonly maxSamples: number
  private isRunning = false
  private lastDebugTime?: number
  private lastAvgDebugTime?: number

  constructor(maxSamples: number = 36000) {
    this.maxSamples = maxSamples
  }

  start(): void {
    this.isRunning = true
    this.lastTime = performance.now()
    this.frameCount = 0
    this.frameTimestamps = []
    logger.info('FPS monitoring started')
  }

  tick(): void {
    if (!this.isRunning) return

    const now = performance.now()
    this.frameTimestamps.push(now)
    this.frameCount++

    // 古いサンプルを削除（通常は全期間保持、メモリ制限時のみ適用）
    // maxSamples = 36000 (60FPSで10分間) で実質的に全録音期間をカバー
    while (this.frameTimestamps.length > this.maxSamples) {
      this.frameTimestamps.shift()
    }
  }

  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) return 0

    // 直近0.2秒間のフレームレートを計算（より敏感に変化）
    const now = this.frameTimestamps[this.frameTimestamps.length - 1]
    const recentTimestamps = this.frameTimestamps.filter(timestamp => now - timestamp <= 200)
    
    if (recentTimestamps.length < 2) return 0
    
    const timeSpan = recentTimestamps[recentTimestamps.length - 1] - recentTimestamps[0]
    const frameCount = recentTimestamps.length - 1
    const fps = frameCount > 0 ? (frameCount / timeSpan) * 1000 : 0
    
    // デバッグ: 計算詳細をログ出力（1秒間隔で制限）
    if (!this.lastDebugTime || now - this.lastDebugTime > 1000) {
      logger.debug('Current FPS calculation', {
        totalSamples: this.frameTimestamps.length,
        recentSamples: recentTimestamps.length,
        timeSpan: timeSpan.toFixed(2),
        frameCount,
        calculatedFPS: fps.toFixed(2)
      })
      this.lastDebugTime = now
    }
    
    return fps
  }

  getAverageFPS(): number {
    if (this.frameTimestamps.length < 2) return 0

    // 全期間の平均フレームレートを計算
    const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]
    const frameCount = this.frameTimestamps.length - 1
    const fps = frameCount > 0 ? (frameCount / timeSpan) * 1000 : 0
    
    // デバッグ: 平均FPS計算詳細
    if (!this.lastAvgDebugTime || Date.now() - this.lastAvgDebugTime > 1000) {
      const totalDurationSeconds = timeSpan / 1000
      logger.debug('Average FPS calculation (full session)', {
        totalSamples: this.frameTimestamps.length,
        maxSamples: this.maxSamples,
        sessionDuration: `${totalDurationSeconds.toFixed(2)}s`,
        isFullSession: this.frameTimestamps.length < this.maxSamples,
        frameCount,
        calculatedFPS: fps.toFixed(2)
      })
      this.lastAvgDebugTime = Date.now()
    }
    
    return fps
  }

  stop(): PerformanceMetrics {
    this.isRunning = false
    const endTime = performance.now()
    const duration = endTime - this.lastTime
    const averageFPS = this.getAverageFPS()

    logger.info('FPS monitoring stopped', {
      duration: `${duration.toFixed(2)}ms`,
      frameCount: this.frameCount,
      averageFPS: `${averageFPS.toFixed(2)} FPS`
    })

    return {
      startTime: this.lastTime,
      endTime,
      duration,
      frameCount: this.frameCount,
      averageFPS
    }
  }
}

/**
 * パフォーマンス最適化ユーティリティ
 */
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer
  private frameThrottles = new Map<string, number>()
  private debounceTimers = new Map<string, number>()

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer()
    }
    return PerformanceOptimizer.instance
  }

  /**
   * フレームレート制限付きの関数実行
   */
  throttleFrame<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    targetFPS: number = 60
  ): T {
    const minInterval = 1000 / targetFPS

    return ((...args: any[]) => {
      const now = performance.now()
      const lastTime = this.frameThrottles.get(key) || 0

      if (now - lastTime >= minInterval) {
        this.frameThrottles.set(key, now)
        return fn(...args)
      }
    }) as T
  }

  /**
   * デバウンス機能
   */
  debounce<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay: number
  ): T {
    return ((...args: any[]) => {
      const existingTimer = this.debounceTimers.get(key)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const timer = window.setTimeout(() => {
        this.debounceTimers.delete(key)
        fn(...args)
      }, delay)

      this.debounceTimers.set(key, timer)
    }) as T
  }

  /**
   * バッチ処理
   */
  batch<T>(
    items: T[],
    processor: (item: T) => void,
    batchSize: number = 10,
    interval: number = 0
  ): Promise<void> {
    return new Promise((resolve) => {
      let index = 0

      const processBatch = () => {
        const endIndex = Math.min(index + batchSize, items.length)
        
        for (let i = index; i < endIndex; i++) {
          processor(items[i])
        }

        index = endIndex

        if (index < items.length) {
          if (interval > 0) {
            setTimeout(processBatch, interval)
          } else {
            requestAnimationFrame(processBatch)
          }
        } else {
          resolve()
        }
      }

      processBatch()
    })
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()
    this.frameThrottles.clear()
    logger.info('Performance optimizer cleaned up')
  }
}

/**
 * オブジェクトプール管理
 */
export class ObjectPool<T> {
  private readonly available: T[] = []
  private readonly inUse = new Set<T>()
  private readonly factory: () => T
  private readonly validator: (item: T) => boolean
  private readonly maxSize: number

  constructor(
    factory: () => T,
    validator: (item: T) => boolean = () => true,
    maxSize: number = 50
  ) {
    this.factory = factory
    this.validator = validator
    this.maxSize = maxSize
  }

  acquire(): T {
    // 利用可能なオブジェクトから取得
    let item = this.available.pop()
    
    // バリデーションが失敗した場合は新しいオブジェクトを作成
    while (item && !this.validator(item)) {
      item = this.available.pop()
    }

    if (!item) {
      item = this.factory()
    }

    this.inUse.add(item)
    return item
  }

  release(item: T): void {
    if (this.inUse.has(item)) {
      this.inUse.delete(item)
      
      if (this.available.length < this.maxSize && this.validator(item)) {
        this.available.push(item)
      }
    }
  }

  getStats(): {
    available: number
    inUse: number
    total: number
    utilization: number
  } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      utilization: this.inUse.size / (this.available.length + this.inUse.size)
    }
  }

  clear(): void {
    this.available.length = 0
    this.inUse.clear()
  }
}

// ===========================================
// Canvas最適化ユーティリティ
// ===========================================

/**
 * Canvas描画最適化
 */
export class CanvasOptimizer {
  private offscreenCanvas: OffscreenCanvas | null = null
  private imageBitmapCache = new Map<string, ImageBitmap>()

  /**
   * OffscreenCanvasの作成（WebWorker対応）
   */
  createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height)
      }
    } catch (error) {
      logger.warn('OffscreenCanvas not supported, falling back to regular canvas')
    }

    // フォールバック
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }

  /**
   * ImageBitmapキャッシュ
   */
  async cacheImageBitmap(key: string, imageSource: ImageBitmapSource): Promise<ImageBitmap> {
    if (this.imageBitmapCache.has(key)) {
      return this.imageBitmapCache.get(key)!
    }

    const bitmap = await createImageBitmap(imageSource)
    this.imageBitmapCache.set(key, bitmap)
    return bitmap
  }

  /**
   * 効率的な描画バッチ処理
   */
  batchDraw(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    operations: Array<() => void>
  ): void {
    ctx.save()
    
    try {
      // バッチで描画操作を実行
      for (const operation of operations) {
        operation()
      }
    } finally {
      ctx.restore()
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.imageBitmapCache.forEach(bitmap => bitmap.close())
    this.imageBitmapCache.clear()
    this.offscreenCanvas = null
  }
}

// ===========================================
// グローバルインスタンス
// ===========================================

export const performanceOptimizer = PerformanceOptimizer.getInstance()
export const canvasOptimizer = new CanvasOptimizer()

// プリミティブ型のメモリプール
export const floatArrayPool = new MemoryPool<Float32Array>(
  () => new Float32Array(1024),
  (arr) => arr.fill(0),
  20
)

export const uint8ArrayPool = new MemoryPool<Uint8Array>(
  () => new Uint8Array(1024),
  (arr) => arr.fill(0),
  20
) 