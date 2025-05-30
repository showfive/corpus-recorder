import { createLogger } from '../logger'
import { EventEmitter } from 'eventemitter3'
import type { PerformanceMetrics } from '../performance'

const logger = createLogger('DebugTools')

// ===========================================
// デバッグツール統合システム
// ===========================================

/**
 * デバッグイベント定義
 */
export interface DebugEvents {
  'state-changed': StateChangeEvent
  'performance-recorded': PerformanceEvent
  'error-occurred': ErrorEvent
  'memory-warning': MemoryWarningEvent
  'component-mounted': ComponentLifecycleEvent
  'component-unmounted': ComponentLifecycleEvent
}

/**
 * 状態変更イベント
 */
export interface StateChangeEvent {
  component: string
  property: string
  oldValue: any
  newValue: any
  timestamp: number
  stackTrace?: string
}

/**
 * パフォーマンスイベント
 */
export interface PerformanceEvent {
  operation: string
  duration: number
  metrics: PerformanceMetrics
  timestamp: number
  context?: Record<string, any>
}

/**
 * エラーイベント
 */
export interface ErrorEvent {
  message: string
  stack?: string
  component?: string
  context?: Record<string, any>
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * メモリ警告イベント
 */
export interface MemoryWarningEvent {
  usage: number
  threshold: number
  timestamp: number
  recommendations: string[]
}

/**
 * コンポーネントライフサイクルイベント
 */
export interface ComponentLifecycleEvent {
  component: string
  timestamp: number
  props?: Record<string, any>
  performance?: {
    mountTime?: number
    renderTime?: number
  }
}

/**
 * リアルタイム状態監視
 */
export class StateMonitor {
  private watchers = new Map<string, StateWatcher[]>()
  private history: StateChangeEvent[] = []
  private readonly maxHistorySize: number

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize
  }

  /**
   * 状態監視の追加
   */
  watch<T>(
    target: Record<string, any>,
    property: string,
    options: StateWatchOptions = {}
  ): StateWatcher {
    const watcher: StateWatcher = {
      id: `${target.constructor.name}-${property}-${Date.now()}`,
      target,
      property,
      options,
      isActive: true
    }

    // プロキシによる状態変更監視
    const descriptor = Object.getOwnPropertyDescriptor(target, property)
    let currentValue = target[property]

    Object.defineProperty(target, property, {
      get: () => currentValue,
      set: (newValue) => {
        if (watcher.isActive && newValue !== currentValue) {
          const event: StateChangeEvent = {
            component: target.constructor.name,
            property,
            oldValue: currentValue,
            newValue,
            timestamp: performance.now(),
            stackTrace: options.captureStackTrace ? new Error().stack : undefined
          }

          this.recordStateChange(event)
          currentValue = newValue

          // カスタムコールバック実行
          if (options.onChange) {
            options.onChange(event)
          }
        } else {
          currentValue = newValue
        }
      },
      enumerable: descriptor?.enumerable ?? true,
      configurable: true
    })

    // ウォッチャーを登録
    const watchers = this.watchers.get(property) || []
    watchers.push(watcher)
    this.watchers.set(property, watchers)

    return watcher
  }

  /**
   * 状態変更の記録
   */
  private recordStateChange(event: StateChangeEvent): void {
    this.history.push(event)

    // 履歴サイズ制限
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // デバッグイベントバスに通知
    debugEventBus.emit('state-changed', event)

    logger.debug('State change recorded', {
      component: event.component,
      property: event.property,
      oldValue: event.oldValue,
      newValue: event.newValue
    })
  }

  /**
   * 履歴の取得
   */
  getHistory(filter?: StateHistoryFilter): StateChangeEvent[] {
    if (!filter) return [...this.history]

    return this.history.filter(event => {
      if (filter.component && event.component !== filter.component) return false
      if (filter.property && event.property !== filter.property) return false
      if (filter.timeRange) {
        const [start, end] = filter.timeRange
        if (event.timestamp < start || event.timestamp > end) return false
      }
      return true
    })
  }

  /**
   * ウォッチャーの無効化
   */
  unwatch(watcherId: string): void {
    for (const [property, watchers] of this.watchers.entries()) {
      const index = watchers.findIndex(w => w.id === watcherId)
      if (index !== -1) {
        watchers[index].isActive = false
        watchers.splice(index, 1)
        
        if (watchers.length === 0) {
          this.watchers.delete(property)
        }
        break
      }
    }
  }

  /**
   * 全ての監視を停止
   */
  clear(): void {
    for (const watchers of this.watchers.values()) {
      watchers.forEach(watcher => {
        watcher.isActive = false
      })
    }
    this.watchers.clear()
    this.history = []
  }
}

/**
 * パフォーマンス分析ツール
 */
export class PerformanceAnalyzer {
  private measurements = new Map<string, PerformanceMeasurement[]>()
  private readonly maxMeasurements: number

  constructor(maxMeasurements: number = 1000) {
    this.maxMeasurements = maxMeasurements
  }

  /**
   * 関数のパフォーマンス測定
   */
  profile<T>(
    operation: string,
    fn: () => T | Promise<T>,
    context?: Record<string, any>
  ): Promise<ProfiledResult<T>> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now()
      const startMemory = this.getCurrentMemoryUsage()

      try {
        const result = await fn()
        const endTime = performance.now()
        const endMemory = this.getCurrentMemoryUsage()

        const measurement: PerformanceMeasurement = {
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryDelta: endMemory - startMemory,
          context,
          success: true
        }

        this.recordMeasurement(measurement)

        const profiledResult: ProfiledResult<T> = {
          result,
          performance: {
            duration: measurement.duration,
            memoryDelta: measurement.memoryDelta,
            timestamp: startTime
          }
        }

        resolve(profiledResult)

      } catch (error) {
        const endTime = performance.now()
        
        const measurement: PerformanceMeasurement = {
          operation,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryDelta: 0,
          context,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }

        this.recordMeasurement(measurement)
        reject(error)
      }
    })
  }

  /**
   * メモリ使用量取得
   */
  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  /**
   * 測定結果の記録
   */
  private recordMeasurement(measurement: PerformanceMeasurement): void {
    const measurements = this.measurements.get(measurement.operation) || []
    measurements.push(measurement)

    // 測定数制限
    if (measurements.length > this.maxMeasurements) {
      measurements.shift()
    }

    this.measurements.set(measurement.operation, measurements)

    // パフォーマンスイベント発行
    const event: PerformanceEvent = {
      operation: measurement.operation,
      duration: measurement.duration,
      metrics: {
        startTime: measurement.startTime,
        endTime: measurement.endTime,
        duration: measurement.duration
      },
      timestamp: measurement.startTime,
      context: measurement.context
    }

    debugEventBus.emit('performance-recorded', event)

    logger.debug('Performance measurement recorded', {
      operation: measurement.operation,
      duration: `${measurement.duration.toFixed(2)}ms`,
      memoryDelta: `${measurement.memoryDelta}B`,
      success: measurement.success
    })
  }

  /**
   * パフォーマンス統計の取得
   */
  getStats(operation?: string): PerformanceStats | Map<string, PerformanceStats> {
    if (operation) {
      const measurements = this.measurements.get(operation) || []
      return this.calculateStats(measurements)
    }

    const allStats = new Map<string, PerformanceStats>()
    for (const [op, measurements] of this.measurements.entries()) {
      allStats.set(op, this.calculateStats(measurements))
    }
    return allStats
  }

  /**
   * 統計計算
   */
  private calculateStats(measurements: PerformanceMeasurement[]): PerformanceStats {
    if (measurements.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        totalMemoryDelta: 0
      }
    }

    const durations = measurements.map(m => m.duration)
    const successCount = measurements.filter(m => m.success).length

    return {
      count: measurements.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successCount / measurements.length,
      totalMemoryDelta: measurements.reduce((sum, m) => sum + m.memoryDelta, 0)
    }
  }
}

/**
 * エラー追跡システム
 */
export class ErrorTracker {
  private errors: DetailedError[] = []
  private readonly maxErrors: number

  constructor(maxErrors: number = 500) {
    this.maxErrors = maxErrors

    // グローバルエラーハンドラー
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.captureError(event.error, {
          type: 'javascript',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.captureError(event.reason, {
          type: 'promise',
          promise: true
        })
      })
    }
  }

  /**
   * エラーの捕捉
   */
  captureError(
    error: Error | string,
    context?: Record<string, any>,
    severity: ErrorEvent['severity'] = 'medium'
  ): void {
    const detailedError: DetailedError = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: performance.now(),
      context,
      severity,
      frequency: 1
    }

    // 重複エラーのチェック
    const existingError = this.errors.find(e => 
      e.message === detailedError.message && 
      e.stack === detailedError.stack
    )

    if (existingError) {
      existingError.frequency++
      existingError.timestamp = detailedError.timestamp
    } else {
      this.errors.push(detailedError)

      // エラー数制限
      if (this.errors.length > this.maxErrors) {
        this.errors.shift()
      }
    }

    // エラーイベント発行
    const errorEvent: ErrorEvent = {
      message: detailedError.message,
      stack: detailedError.stack,
      timestamp: detailedError.timestamp,
      context: detailedError.context,
      severity: detailedError.severity
    }

    debugEventBus.emit('error-occurred', errorEvent)

    logger.error('Error captured by tracker', {
      message: detailedError.message,
      severity: detailedError.severity,
      context: detailedError.context
    })
  }

  /**
   * エラー統計の取得
   */
  getErrorStats(): ErrorStats {
    const now = performance.now()
    const recent = this.errors.filter(e => now - e.timestamp < 300000) // 5分以内

    const bySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + error.frequency
      return acc
    }, {} as Record<string, number>)

    return {
      total: this.errors.reduce((sum, e) => sum + e.frequency, 0),
      recent: recent.reduce((sum, e) => sum + e.frequency, 0),
      bySeverity,
      mostFrequent: this.errors
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
        .map(e => ({
          message: e.message,
          frequency: e.frequency,
          severity: e.severity
        }))
    }
  }

  /**
   * エラー履歴の取得
   */
  getErrors(filter?: ErrorFilter): DetailedError[] {
    let filtered = [...this.errors]

    if (filter) {
      if (filter.severity) {
        filtered = filtered.filter(e => e.severity === filter.severity)
      }
      if (filter.timeRange) {
        const [start, end] = filter.timeRange
        filtered = filtered.filter(e => e.timestamp >= start && e.timestamp <= end)
      }
      if (filter.messagePattern) {
        const regex = new RegExp(filter.messagePattern, 'i')
        filtered = filtered.filter(e => regex.test(e.message))
      }
    }

    return filtered
  }
}

// ===========================================
// メモリ監視システム
// ===========================================

/**
 * メモリ使用量監視
 */
export class MemoryMonitor {
  private isMonitoring = false
  private monitoringInterval: number | null = null
  private threshold: number
  private samples: MemorySample[] = []
  private readonly maxSamples: number

  constructor(threshold: number = 100 * 1024 * 1024, maxSamples: number = 300) { // 100MB threshold
    this.threshold = threshold
    this.maxSamples = maxSamples
  }

  /**
   * 監視開始
   */
  startMonitoring(interval: number = 5000): void { // 5秒間隔
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.monitoringInterval = window.setInterval(() => {
      this.takeSample()
    }, interval)

    logger.info('Memory monitoring started', {
      interval: `${interval}ms`,
      threshold: `${(this.threshold / 1024 / 1024).toFixed(2)}MB`
    })
  }

  /**
   * 監視停止
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    logger.info('Memory monitoring stopped')
  }

  /**
   * メモリサンプル取得
   */
  private takeSample(): void {
    if (typeof performance === 'undefined' || !('memory' in performance)) return

    const memory = (performance as any).memory
    const sample: MemorySample = {
      timestamp: performance.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }

    this.samples.push(sample)

    // サンプル数制限
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }

    // 閾値チェック
    if (sample.usedJSHeapSize > this.threshold) {
      const recommendations = this.generateRecommendations(sample)
      
      const warningEvent: MemoryWarningEvent = {
        usage: sample.usedJSHeapSize,
        threshold: this.threshold,
        timestamp: sample.timestamp,
        recommendations
      }

      debugEventBus.emit('memory-warning', warningEvent)

      logger.warn('Memory usage threshold exceeded', {
        usage: `${(sample.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        threshold: `${(this.threshold / 1024 / 1024).toFixed(2)}MB`,
        recommendations
      })
    }
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(sample: MemorySample): string[] {
    const recommendations: string[] = []

    const usagePercent = (sample.usedJSHeapSize / sample.jsHeapSizeLimit) * 100

    if (usagePercent > 80) {
      recommendations.push('メモリ使用量が限界に近づいています。不要なオブジェクトを解放してください。')
    }

    if (usagePercent > 60) {
      recommendations.push('メモリプールの活用を検討してください。')
    }

    recommendations.push('ガベージコレクションの実行を検討してください。')
    recommendations.push('大きなオブジェクトの参照を確認してください。')

    return recommendations
  }

  /**
   * メモリ使用量統計
   */
  getMemoryStats(): MemoryStats {
    if (this.samples.length === 0) {
      return {
        current: 0,
        peak: 0,
        average: 0,
        trend: 'stable',
        samples: 0
      }
    }

    const current = this.samples[this.samples.length - 1].usedJSHeapSize
    const peak = Math.max(...this.samples.map(s => s.usedJSHeapSize))
    const average = this.samples.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / this.samples.length

    // トレンド分析（直近10サンプル）
    const recentSamples = this.samples.slice(-10)
    const trend = this.calculateTrend(recentSamples)

    return {
      current,
      peak,
      average,
      trend,
      samples: this.samples.length
    }
  }

  /**
   * トレンド計算
   */
  private calculateTrend(samples: MemorySample[]): 'increasing' | 'decreasing' | 'stable' {
    if (samples.length < 2) return 'stable'

    const first = samples[0].usedJSHeapSize
    const last = samples[samples.length - 1].usedJSHeapSize
    const diff = last - first
    const threshold = first * 0.1 // 10%の変化を閾値とする

    if (diff > threshold) return 'increasing'
    if (diff < -threshold) return 'decreasing'
    return 'stable'
  }
}

// ===========================================
// 型定義
// ===========================================

interface StateWatchOptions {
  onChange?: (event: StateChangeEvent) => void
  captureStackTrace?: boolean
}

interface StateWatcher {
  id: string
  target: Record<string, any>
  property: string
  options: StateWatchOptions
  isActive: boolean
}

interface StateHistoryFilter {
  component?: string
  property?: string
  timeRange?: [number, number]
}

interface PerformanceMeasurement {
  operation: string
  startTime: number
  endTime: number
  duration: number
  memoryDelta: number
  context?: Record<string, any>
  success: boolean
  error?: string
}

interface ProfiledResult<T> {
  result: T
  performance: {
    duration: number
    memoryDelta: number
    timestamp: number
  }
}

interface PerformanceStats {
  count: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  successRate: number
  totalMemoryDelta: number
}

interface DetailedError {
  id: string
  message: string
  stack?: string
  timestamp: number
  context?: Record<string, any>
  severity: ErrorEvent['severity']
  frequency: number
}

interface ErrorStats {
  total: number
  recent: number
  bySeverity: Record<string, number>
  mostFrequent: Array<{
    message: string
    frequency: number
    severity: string
  }>
}

interface ErrorFilter {
  severity?: ErrorEvent['severity']
  timeRange?: [number, number]
  messagePattern?: string
}

interface MemorySample {
  timestamp: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface MemoryStats {
  current: number
  peak: number
  average: number
  trend: 'increasing' | 'decreasing' | 'stable'
  samples: number
}

// ===========================================
// グローバルインスタンス
// ===========================================

export const debugEventBus = new EventEmitter<DebugEvents>()
export const stateMonitor = new StateMonitor()
export const performanceAnalyzer = new PerformanceAnalyzer()
export const errorTracker = new ErrorTracker()
export const memoryMonitor = new MemoryMonitor()

// ===========================================
// 統合デバッグサービス
// ===========================================

/**
 * デバッグツールの統合管理
 */
export class DebugToolsService {
  private isInitialized = false

  /**
   * デバッグツールの初期化
   */
  initialize(): void {
    if (this.isInitialized) return

    // 開発環境でのみ有効化
    if (process.env.NODE_ENV === 'development') {
      memoryMonitor.startMonitoring()
      
      // グローバルデバッグオブジェクトを作成
      if (typeof window !== 'undefined') {
        (window as any).__CORPUS_DEBUG__ = {
          stateMonitor,
          performanceAnalyzer,
          errorTracker,
          memoryMonitor,
          eventBus: debugEventBus
        }
      }

      logger.info('Debug tools initialized in development mode')
    }

    this.isInitialized = true
  }

  /**
   * デバッグツールのクリーンアップ
   */
  cleanup(): void {
    if (!this.isInitialized) return

    memoryMonitor.stopMonitoring()
    stateMonitor.clear()
    debugEventBus.removeAllListeners()

    if (typeof window !== 'undefined') {
      delete (window as any).__CORPUS_DEBUG__
    }

    this.isInitialized = false
    logger.info('Debug tools cleaned up')
  }

  /**
   * 統合ダッシュボードデータ
   */
  getDashboardData(): DebugDashboardData {
    return {
      performance: performanceAnalyzer.getStats() as Map<string, PerformanceStats>,
      errors: errorTracker.getErrorStats(),
      memory: memoryMonitor.getMemoryStats(),
      stateChanges: stateMonitor.getHistory().length,
      timestamp: performance.now()
    }
  }
}

interface DebugDashboardData {
  performance: Map<string, PerformanceStats>
  errors: ErrorStats
  memory: MemoryStats
  stateChanges: number
  timestamp: number
}

export const debugTools = new DebugToolsService() 