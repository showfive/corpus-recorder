import { ref, onMounted, onUnmounted, computed } from 'vue'
import { createLogger } from '../../common/logger'
import {
  debugTools,
  debugEventBus,
  stateMonitor,
  performanceAnalyzer,
  errorTracker,
  memoryMonitor,
  type StateChangeEvent,
  type PerformanceEvent,
  type ErrorEvent,
  type MemoryWarningEvent
} from '../../common/debug'
import {
  developmentTools,
  codeQualityAnalyzer,
  apiDocGenerator,
  testRunner,
  type ComprehensiveReport,
  type CodeQualityReport,
  type APIDocumentation,
  type TestResults
} from '../../common/dev-tools'

const logger = createLogger('useDebugTools')

// ===========================================
// 型定義
// ===========================================

interface ErrorStatsState {
  total: number
  recent: number
  bySeverity: Record<string, number>
  mostFrequent: Array<{
    message: string
    frequency: number
    severity: string
  }>
}

interface MemoryStatsState {
  current: number
  peak: number
  average: number
  trend: 'stable' | 'increasing' | 'decreasing'
  samples: number
}

/**
 * デバッグツール統合Composable
 */
export function useDebugTools() {
  // ===========================================
  // 状態管理
  // ===========================================

  const isDebugMode = ref(process.env.NODE_ENV === 'development')
  const isMonitoring = ref(false)
  const dashboardVisible = ref(false)

  // 統計データ
  const performanceStats = ref(new Map())
  const errorStats = ref<ErrorStatsState>({ 
    total: 0, 
    recent: 0, 
    bySeverity: {}, 
    mostFrequent: [] 
  })
  const memoryStats = ref<MemoryStatsState>({ 
    current: 0, 
    peak: 0, 
    average: 0, 
    trend: 'stable', 
    samples: 0 
  })
  const stateChangeCount = ref(0)

  // レポートデータ
  const comprehensiveReport = ref<ComprehensiveReport | null>(null)
  const isGeneratingReport = ref(false)

  // イベント履歴
  const recentEvents = ref<Array<{
    type: string
    timestamp: number
    data: any
  }>>([])

  // ===========================================
  // 計算プロパティ
  // ===========================================

  const debugSummary = computed(() => ({
    isActive: isMonitoring.value,
    performance: {
      operationCount: Array.from(performanceStats.value.values())
        .reduce((sum: number, stat: any) => sum + stat.count, 0),
      averageDuration: Array.from(performanceStats.value.values())
        .reduce((sum: number, stat: any, _, arr) => 
          sum + stat.averageDuration / arr.length, 0),
      successRate: Array.from(performanceStats.value.values())
        .reduce((sum: number, stat: any, _, arr) => 
          sum + stat.successRate / arr.length, 0)
    },
    errors: {
      total: errorStats.value.total,
      recent: errorStats.value.recent,
      critical: (errorStats.value.bySeverity.critical as number) || 0
    },
    memory: {
      current: memoryStats.value.current,
      trend: memoryStats.value.trend
    },
    stateChanges: stateChangeCount.value
  }))

  const healthScore = computed(() => {
    let score = 100

    // パフォーマンススコア
    if (debugSummary.value.performance.averageDuration > 100) {
      score -= 20 // 平均処理時間が100ms超
    }
    if (debugSummary.value.performance.successRate < 0.95) {
      score -= 15 // 成功率95%未満
    }

    // エラースコア
    if (debugSummary.value.errors.critical > 0) {
      score -= 30 // クリティカルエラーあり
    }
    if (debugSummary.value.errors.recent > 10) {
      score -= 10 // 直近エラーが多い
    }

    // メモリスコア
    if (memoryStats.value.trend === 'increasing') {
      score -= 15 // メモリ増加傾向
    }

    return Math.max(0, score)
  })

  const healthStatus = computed(() => {
    const score = healthScore.value
    if (score >= 90) return { status: 'excellent', color: '#10b981', icon: '🟢' }
    if (score >= 75) return { status: 'good', color: '#3b82f6', icon: '🔵' }
    if (score >= 60) return { status: 'warning', color: '#f59e0b', icon: '🟡' }
    if (score >= 40) return { status: 'poor', color: '#ef4444', icon: '🟠' }
    return { status: 'critical', color: '#dc2626', icon: '🔴' }
  })

  // ===========================================
  // デバッグツール管理
  // ===========================================

  /**
   * デバッグツールの初期化
   */
  const initializeDebugTools = async () => {
    if (!isDebugMode.value) {
      logger.info('Debug tools disabled in production mode')
      return
    }

    try {
      // デバッグツールとデベロップメントツールを初期化
      await Promise.all([
        debugTools.initialize(),
        developmentTools.initialize()
      ])

      setupEventListeners()
      isMonitoring.value = true

      logger.info('Debug tools initialized successfully')

      // グローバルデバッグオブジェクトに追加情報を付与
      if (typeof window !== 'undefined') {
        (window as any).__CORPUS_DEBUG__ = {
          ...(window as any).__CORPUS_DEBUG__,
          useDebugTools: {
            summary: debugSummary,
            healthScore,
            healthStatus,
            generateReport: generateComprehensiveReport,
            exportReport: exportReportAsJSON
          }
        }
      }

    } catch (error) {
      logger.error('Failed to initialize debug tools', { error })
    }
  }

  /**
   * デバッグツールのクリーンアップ
   */
  const cleanupDebugTools = () => {
    if (!isDebugMode.value) return

    clearEventListeners()
    debugTools.cleanup()
    developmentTools.cleanup()
    isMonitoring.value = false

    logger.info('Debug tools cleaned up')
  }

  // ===========================================
  // イベント処理
  // ===========================================

  /**
   * イベントリスナーの設定
   */
  const setupEventListeners = () => {
    debugEventBus.on('state-changed', onStateChanged)
    debugEventBus.on('performance-recorded', onPerformanceRecorded)
    debugEventBus.on('error-occurred', onErrorOccurred)
    debugEventBus.on('memory-warning', onMemoryWarning)

    // 定期的な統計更新
    const updateInterval = setInterval(updateStats, 2000)
    
    // クリーンアップ用にインターバルIDを保存
    ;(window as any).__DEBUG_UPDATE_INTERVAL__ = updateInterval
  }

  /**
   * イベントリスナーのクリア
   */
  const clearEventListeners = () => {
    debugEventBus.off('state-changed', onStateChanged)
    debugEventBus.off('performance-recorded', onPerformanceRecorded)
    debugEventBus.off('error-occurred', onErrorOccurred)
    debugEventBus.off('memory-warning', onMemoryWarning)

    const interval = (window as any).__DEBUG_UPDATE_INTERVAL__
    if (interval) {
      clearInterval(interval)
      delete (window as any).__DEBUG_UPDATE_INTERVAL__
    }
  }

  // イベントハンドラー
  const onStateChanged = (event: StateChangeEvent) => {
    stateChangeCount.value++
    addRecentEvent('state-change', event)
  }

  const onPerformanceRecorded = (event: PerformanceEvent) => {
    addRecentEvent('performance', event)
  }

  const onErrorOccurred = (event: ErrorEvent) => {
    addRecentEvent('error', event)
  }

  const onMemoryWarning = (event: MemoryWarningEvent) => {
    addRecentEvent('memory-warning', event)
  }

  /**
   * 最近のイベントを追加
   */
  const addRecentEvent = (type: string, data: any) => {
    recentEvents.value.unshift({
      type,
      timestamp: performance.now(),
      data
    })

    // イベント履歴を制限
    if (recentEvents.value.length > 100) {
      recentEvents.value = recentEvents.value.slice(0, 100)
    }
  }

  /**
   * 統計データの更新
   */
  const updateStats = () => {
    try {
      // パフォーマンス統計の更新
      const perfStats = performanceAnalyzer.getStats()
      if (perfStats instanceof Map) {
        performanceStats.value = perfStats
      }

      // エラー統計の更新
      const newErrorStats = errorTracker.getErrorStats()
      errorStats.value = {
        total: newErrorStats.total,
        recent: newErrorStats.recent,
        bySeverity: newErrorStats.bySeverity,
        mostFrequent: newErrorStats.mostFrequent
      }

      // メモリ統計の更新
      const newMemoryStats = memoryMonitor.getMemoryStats()
      memoryStats.value = {
        current: newMemoryStats.current,
        peak: newMemoryStats.peak,
        average: newMemoryStats.average,
        trend: newMemoryStats.trend,
        samples: newMemoryStats.samples
      }

    } catch (error) {
      logger.warn('Failed to update debug stats', { error })
    }
  }

  // ===========================================
  // 状態監視機能
  // ===========================================

  /**
   * オブジェクトの状態監視を開始
   */
  const watchState = (
    target: Record<string, any>,
    property: string,
    options?: {
      onChange?: (oldValue: any, newValue: any) => void
      captureStackTrace?: boolean
    }
  ) => {
    if (!isDebugMode.value || !isMonitoring.value) return null

    const watcher = stateMonitor.watch(target, property, {
      onChange: (event) => {
        if (options?.onChange) {
          options.onChange(event.oldValue, event.newValue)
        }
      },
      captureStackTrace: options?.captureStackTrace
    })

    logger.debug('State watching started', {
      target: target.constructor.name,
      property,
      watcherId: watcher.id
    })

    return watcher
  }

  /**
   * 関数のパフォーマンス測定
   */
  const profileFunction = async <T>(
    name: string,
    fn: () => T | Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    if (!isDebugMode.value || !isMonitoring.value) {
      return await fn()
    }

    const result = await performanceAnalyzer.profile(name, fn, context)
    return result.result
  }

  // ===========================================
  // レポート生成機能
  // ===========================================

  /**
   * 総合レポートの生成
   */
  const generateComprehensiveReport = async (): Promise<ComprehensiveReport | null> => {
    if (!isDebugMode.value) {
      logger.warn('Comprehensive report generation is only available in debug mode')
      return null
    }

    isGeneratingReport.value = true

    try {
      logger.info('Generating comprehensive development report')
      const report = await developmentTools.generateComprehensiveReport()
      comprehensiveReport.value = report

      logger.info('Comprehensive report generated successfully', {
        overallScore: report.summary.overallScore,
        generationTime: `${report.generationTime.toFixed(2)}ms`
      })

      return report

    } catch (error) {
      logger.error('Failed to generate comprehensive report', { error })
      return null
    } finally {
      isGeneratingReport.value = false
    }
  }

  /**
   * 品質レポートの生成
   */
  const generateQualityReport = async (): Promise<CodeQualityReport | null> => {
    if (!isDebugMode.value) return null

    try {
      logger.info('Generating code quality report')
      const report = await codeQualityAnalyzer.analyzeProject()
      logger.info('Code quality report generated', {
        filesAnalyzed: report.files.length,
        totalIssues: report.summary.totalIssues
      })
      return report
    } catch (error) {
      logger.error('Failed to generate quality report', { error })
      return null
    }
  }

  /**
   * API仕様書の生成
   */
  const generateAPIDocumentation = async (): Promise<APIDocumentation | null> => {
    if (!isDebugMode.value) return null

    try {
      logger.info('Generating API documentation')
      const docs = await apiDocGenerator.generateDocumentation()
      logger.info('API documentation generated', {
        endpoints: docs.endpoints.length,
        types: docs.types.length
      })
      return docs
    } catch (error) {
      logger.error('Failed to generate API documentation', { error })
      return null
    }
  }

  /**
   * テスト実行
   */
  const runTests = async (): Promise<TestResults | null> => {
    if (!isDebugMode.value) return null

    try {
      logger.info('Running automated tests')
      const results = await testRunner.runAllTests()
      logger.info('Tests completed', {
        total: results.total,
        passed: results.passed,
        failed: results.failed
      })
      return results
    } catch (error) {
      logger.error('Failed to run tests', { error })
      return null
    }
  }

  // ===========================================
  // エクスポート機能
  // ===========================================

  /**
   * レポートをJSONでエクスポート
   */
  const exportReportAsJSON = (report?: ComprehensiveReport) => {
    const exportData = report || comprehensiveReport.value
    if (!exportData) {
      logger.warn('No report data to export')
      return
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `corpus-recorder-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('Report exported as JSON')
  }

  /**
   * API仕様書をMarkdownでエクスポート
   */
  const exportAPIDocsAsMarkdown = async (docs?: APIDocumentation) => {
    try {
      const documentation = docs || await generateAPIDocumentation()
      if (!documentation) return

      const markdown = await apiDocGenerator.exportToMarkdown(documentation)
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `corpus-recorder-api-docs-${Date.now()}.md`
      a.click()
      URL.revokeObjectURL(url)

      logger.info('API documentation exported as Markdown')
    } catch (error) {
      logger.error('Failed to export API docs as Markdown', { error })
    }
  }

  // ===========================================
  // ダッシュボード制御
  // ===========================================

  /**
   * デバッグダッシュボードの表示/非表示
   */
  const toggleDashboard = () => {
    if (!isDebugMode.value) {
      logger.warn('Debug dashboard is only available in debug mode')
      return
    }

    dashboardVisible.value = !dashboardVisible.value
    logger.info(`Debug dashboard ${dashboardVisible.value ? 'shown' : 'hidden'}`)
  }

  // ===========================================
  // ライフサイクル
  // ===========================================

  onMounted(() => {
    if (isDebugMode.value) {
      initializeDebugTools()
    }
  })

  onUnmounted(() => {
    if (isDebugMode.value) {
      cleanupDebugTools()
    }
  })

  // ===========================================
  // 公開API
  // ===========================================

  return {
    // 状態
    isDebugMode: readonly(isDebugMode),
    isMonitoring: readonly(isMonitoring),
    dashboardVisible,
    debugSummary: readonly(debugSummary),
    healthScore: readonly(healthScore),
    healthStatus: readonly(healthStatus),
    comprehensiveReport: readonly(comprehensiveReport),
    isGeneratingReport: readonly(isGeneratingReport),
    recentEvents: readonly(recentEvents),

    // デバッグツール管理
    initializeDebugTools,
    cleanupDebugTools,

    // 監視機能
    watchState,
    profileFunction,

    // レポート生成
    generateComprehensiveReport,
    generateQualityReport,
    generateAPIDocumentation,
    runTests,

    // エクスポート
    exportReportAsJSON,
    exportAPIDocsAsMarkdown,

    // ダッシュボード制御
    toggleDashboard,

    // 統計データ（読み取り専用）
    performanceStats: readonly(performanceStats),
    errorStats: readonly(errorStats),
    memoryStats: readonly(memoryStats),
    stateChangeCount: readonly(stateChangeCount)
  }
}

// グローバル型定義を拡張してデバッグオブジェクトを含める
declare global {
  interface Window {
    __CORPUS_DEBUG__?: {
      stateMonitor: any
      performanceAnalyzer: any
      errorTracker: any
      memoryMonitor: any
      eventBus: any
      useDebugTools: {
        summary: any
        healthScore: any
        healthStatus: any
        generateReport: () => Promise<any>
        exportReport: (report?: any) => void
      }
    }
    __DEBUG_UPDATE_INTERVAL__?: number
  }
}

// ユーティリティ関数
function readonly<T>(ref: any): Readonly<T> {
  return ref as Readonly<T>
} 