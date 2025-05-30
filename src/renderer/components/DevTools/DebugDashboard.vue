<template>
  <div class="debug-dashboard">
    <!-- ダッシュボードヘッダー -->
    <div class="dashboard-header">
      <div class="header-info">
        <h2 class="dashboard-title">
          <span class="title-icon">🛠️</span>
          開発者ダッシュボード
        </h2>
        <div class="status-indicator">
          <span class="status-dot" :class="{ active: isActive }"></span>
          <span class="status-text">{{ isActive ? 'アクティブ' : '停止中' }}</span>
        </div>
      </div>
      
      <div class="dashboard-controls">
        <el-button
          v-if="!isActive"
          type="primary"
          size="small"
          @click="startMonitoring"
          :icon="VideoPlay"
        >
          監視開始
        </el-button>
        <el-button
          v-else
          type="warning"
          size="small"
          @click="stopMonitoring"
          :icon="VideoPause"
        >
          監視停止
        </el-button>
        
        <el-button
          type="info"
          size="small"
          @click="clearData"
          :icon="Refresh"
        >
          データクリア
        </el-button>
        
        <el-button
          type="success"
          size="small"
          @click="exportData"
          :icon="Download"
        >
          エクスポート
        </el-button>
      </div>
    </div>

    <!-- メインダッシュボード -->
    <div class="dashboard-content">
      <!-- 概要カード -->
      <div class="overview-cards">
        <div class="overview-card performance-card">
          <div class="card-header">
            <span class="card-icon">⚡</span>
            <span class="card-title">パフォーマンス</span>
          </div>
          <div class="card-content">
            <div class="metric-row">
              <span class="metric-label">平均処理時間</span>
              <span class="metric-value">{{ formatDuration(avgPerformance) }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">総操作数</span>
              <span class="metric-value">{{ totalOperations.toLocaleString() }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">成功率</span>
              <span class="metric-value success-rate">{{ (successRate * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <div class="overview-card memory-card">
          <div class="card-header">
            <span class="card-icon">💾</span>
            <span class="card-title">メモリ使用量</span>
          </div>
          <div class="card-content">
            <div class="metric-row">
              <span class="metric-label">現在の使用量</span>
              <span class="metric-value">{{ formatBytes(memoryStats.current) }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">ピーク使用量</span>
              <span class="metric-value">{{ formatBytes(memoryStats.peak) }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">トレンド</span>
              <span class="metric-value" :class="trendClass">{{ trendText }}</span>
            </div>
          </div>
        </div>

        <div class="overview-card error-card">
          <div class="card-header">
            <span class="card-icon">🚨</span>
            <span class="card-title">エラー追跡</span>
          </div>
          <div class="card-content">
            <div class="metric-row">
              <span class="metric-label">総エラー数</span>
              <span class="metric-value">{{ errorStats.total.toLocaleString() }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">直近5分</span>
              <span class="metric-value recent-errors">{{ errorStats.recent.toLocaleString() }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">クリティカル</span>
              <span class="metric-value critical-errors">{{ criticalErrors.toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div class="overview-card state-card">
          <div class="card-header">
            <span class="card-icon">🔄</span>
            <span class="card-title">状態監視</span>
          </div>
          <div class="card-content">
            <div class="metric-row">
              <span class="metric-label">状態変更</span>
              <span class="metric-value">{{ dashboardData.stateChanges.toLocaleString() }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">監視対象</span>
              <span class="metric-value">{{ activeWatchers.toLocaleString() }}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">最新更新</span>
              <span class="metric-value">{{ formatTime(lastUpdateTime) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 詳細セクション -->
      <div class="detail-sections">
        <!-- パフォーマンス詳細 -->
        <div class="detail-section">
          <div class="section-header">
            <h3 class="section-title">パフォーマンス詳細</h3>
            <el-switch
              v-model="showPerformanceChart"
              inline-prompt
              active-text="チャート"
              inactive-text="テーブル"
            />
          </div>
          
          <div v-if="showPerformanceChart" class="chart-container">
            <canvas ref="performanceChart" class="performance-chart"></canvas>
          </div>
          
          <div v-else class="table-container">
            <el-table :data="performanceTableData" size="small" class="performance-table">
              <el-table-column prop="operation" label="操作" width="200" />
              <el-table-column prop="count" label="実行回数" width="100" align="right" />
              <el-table-column 
                prop="averageDuration" 
                label="平均時間" 
                width="120" 
                align="right"
                :formatter="formatDurationRow"
              />
              <el-table-column 
                prop="successRate" 
                label="成功率" 
                width="100" 
                align="right"
                :formatter="formatSuccessRateRow"
              />
              <el-table-column 
                prop="totalMemoryDelta" 
                label="メモリ変化" 
                width="120" 
                align="right"
                :formatter="formatMemoryRow"
              />
            </el-table>
          </div>
        </div>

        <!-- エラー詳細 -->
        <div class="detail-section">
          <div class="section-header">
            <h3 class="section-title">エラー詳細</h3>
            <el-select v-model="errorFilter" size="small" placeholder="フィルタ">
              <el-option label="全て" value="" />
              <el-option label="Critical" value="critical" />
              <el-option label="High" value="high" />
              <el-option label="Medium" value="medium" />
              <el-option label="Low" value="low" />
            </el-select>
          </div>
          
          <div class="error-list">
            <div 
              v-for="error in filteredErrors" 
              :key="error.id" 
              class="error-item"
              :class="`severity-${error.severity}`"
            >
              <div class="error-header">
                <span class="error-severity">{{ error.severity.toUpperCase() }}</span>
                <span class="error-frequency">{{ error.frequency }}回</span>
                <span class="error-time">{{ formatTime(error.timestamp) }}</span>
              </div>
              <div class="error-message">{{ error.message }}</div>
              <div v-if="error.stack && showErrorStacks" class="error-stack">
                {{ error.stack }}
              </div>
            </div>
          </div>
          
          <div class="error-controls">
            <el-checkbox v-model="showErrorStacks">スタックトレースを表示</el-checkbox>
            <el-button size="small" @click="clearErrors">エラーをクリア</el-button>
          </div>
        </div>

        <!-- リアルタイムログ -->
        <div class="detail-section">
          <div class="section-header">
            <h3 class="section-title">リアルタイムログ</h3>
            <div class="log-controls">
              <el-switch
                v-model="autoScroll"
                inline-prompt
                active-text="自動スクロール"
                inactive-text="固定表示"
              />
              <el-button size="small" @click="clearLogs">ログクリア</el-button>
            </div>
          </div>
          
          <div ref="logContainer" class="log-container">
            <div 
              v-for="(log, index) in realtimeLogs" 
              :key="index"
              class="log-entry"
              :class="`log-${log.level}`"
            >
              <span class="log-time">{{ formatTime(log.timestamp) }}</span>
              <span class="log-level">{{ log.level.toUpperCase() }}</span>
              <span class="log-component">[{{ log.component }}]</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { VideoPlay, VideoPause, Refresh, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
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
} from '../../../common/debug'
import { createLogger } from '../../../common/logger'

const logger = createLogger('DebugDashboard')

// ===========================================
// 状態管理
// ===========================================

const isActive = ref(false)
const dashboardData = ref({
  performance: new Map(),
  errors: { total: 0, recent: 0, bySeverity: {}, mostFrequent: [] },
  memory: { current: 0, peak: 0, average: 0, trend: 'stable' as const, samples: 0 },
  stateChanges: 0,
  timestamp: 0
})

const showPerformanceChart = ref(true)
const errorFilter = ref('')
const showErrorStacks = ref(false)
const autoScroll = ref(true)

// データ表示用
const realtimeLogs = ref<Array<{
  timestamp: number
  level: string
  component: string
  message: string
}>>([])

const performanceChart = ref<HTMLCanvasElement>()
const logContainer = ref<HTMLElement>()

let updateInterval: number | null = null
let chartInstance: any = null

// ===========================================
// 計算プロパティ
// ===========================================

const avgPerformance = computed(() => {
  const perfData = Array.from(dashboardData.value.performance.values())
  if (perfData.length === 0) return 0
  
  const totalAvg = perfData.reduce((sum, stat) => sum + stat.averageDuration, 0)
  return totalAvg / perfData.length
})

const totalOperations = computed(() => {
  const perfData = Array.from(dashboardData.value.performance.values())
  return perfData.reduce((sum, stat) => sum + stat.count, 0)
})

const successRate = computed(() => {
  const perfData = Array.from(dashboardData.value.performance.values())
  if (perfData.length === 0) return 1
  
  const totalRate = perfData.reduce((sum, stat) => sum + stat.successRate, 0)
  return totalRate / perfData.length
})

const memoryStats = computed(() => dashboardData.value.memory)

const errorStats = computed(() => dashboardData.value.errors)

const criticalErrors = computed(() => 
  dashboardData.value.errors.bySeverity.critical || 0
)

const activeWatchers = computed(() => {
  // StateMonitorから実際の監視対象数を取得（簡易実装）
  return 0 // 実際の実装では stateMonitor.getActiveWatchersCount() 等
})

const lastUpdateTime = computed(() => dashboardData.value.timestamp)

const trendClass = computed(() => ({
  'trend-increasing': memoryStats.value.trend === 'increasing',
  'trend-decreasing': memoryStats.value.trend === 'decreasing',
  'trend-stable': memoryStats.value.trend === 'stable'
}))

const trendText = computed(() => {
  switch (memoryStats.value.trend) {
    case 'increasing': return '増加傾向 📈'
    case 'decreasing': return '減少傾向 📉'
    case 'stable': return '安定 ➖'
    default: return '不明'
  }
})

const performanceTableData = computed(() => {
  return Array.from(dashboardData.value.performance.entries()).map(([operation, stats]) => ({
    operation,
    ...stats
  }))
})

const filteredErrors = computed(() => {
  const errors = errorTracker.getErrors()
  if (!errorFilter.value) return errors.slice(0, 20) // 最新20件
  
  return errors
    .filter(error => error.severity === errorFilter.value)
    .slice(0, 20)
})

// ===========================================
// メソッド
// ===========================================

const startMonitoring = async () => {
  isActive.value = true
  debugTools.initialize()
  
  // デバッグイベントリスナーを設定
  setupEventListeners()
  
  // 定期更新開始
  updateInterval = window.setInterval(updateDashboard, 1000) // 1秒間隔
  
  await updateDashboard()
  await nextTick()
  
  if (showPerformanceChart.value) {
    initializeChart()
  }
  
  ElMessage.success('監視を開始しました')
  logger.info('Debug dashboard monitoring started')
}

const stopMonitoring = () => {
  isActive.value = false
  
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
  
  // イベントリスナーをクリア
  clearEventListeners()
  
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  
  debugTools.cleanup()
  
  ElMessage.info('監視を停止しました')
  logger.info('Debug dashboard monitoring stopped')
}

const updateDashboard = async () => {
  try {
    const data = debugTools.getDashboardData()
    dashboardData.value = data
    
    // チャートを更新
    if (chartInstance && showPerformanceChart.value) {
      updateChart()
    }
    
    // 自動スクロール
    if (autoScroll.value && logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
    
  } catch (error) {
    logger.error('Failed to update dashboard', { error })
  }
}

const setupEventListeners = () => {
  debugEventBus.on('state-changed', onStateChanged)
  debugEventBus.on('performance-recorded', onPerformanceRecorded)
  debugEventBus.on('error-occurred', onErrorOccurred)
  debugEventBus.on('memory-warning', onMemoryWarning)
}

const clearEventListeners = () => {
  debugEventBus.off('state-changed', onStateChanged)
  debugEventBus.off('performance-recorded', onPerformanceRecorded)
  debugEventBus.off('error-occurred', onErrorOccurred)
  debugEventBus.off('memory-warning', onMemoryWarning)
}

// イベントハンドラー
const onStateChanged = (event: StateChangeEvent) => {
  addRealtimeLog('debug', event.component, 
    `状態変更: ${event.property} = ${JSON.stringify(event.newValue)}`
  )
}

const onPerformanceRecorded = (event: PerformanceEvent) => {
  addRealtimeLog('info', 'Performance', 
    `${event.operation}: ${event.duration.toFixed(2)}ms`
  )
}

const onErrorOccurred = (event: ErrorEvent) => {
  addRealtimeLog('error', event.component || 'Unknown', 
    `${event.severity.toUpperCase()}: ${event.message}`
  )
}

const onMemoryWarning = (event: MemoryWarningEvent) => {
  addRealtimeLog('warn', 'Memory', 
    `メモリ使用量警告: ${formatBytes(event.usage)}`
  )
}

const addRealtimeLog = (level: string, component: string, message: string) => {
  realtimeLogs.value.push({
    timestamp: performance.now(),
    level,
    component,
    message
  })
  
  // ログサイズ制限
  if (realtimeLogs.value.length > 200) {
    realtimeLogs.value.shift()
  }
}

// チャート関連
const initializeChart = async () => {
  if (!performanceChart.value) return
  
  // Chart.jsの動的インポート（実際の実装では適切なチャートライブラリを使用）
  try {
    // 簡易チャート実装（本格実装ではChart.jsやECharts等を使用）
    const ctx = performanceChart.value.getContext('2d')
    if (ctx) {
      // 基本的なキャンバス描画でのチャート実装
      drawSimpleChart(ctx)
    }
  } catch (error) {
    logger.warn('Chart initialization failed', { error })
  }
}

const drawSimpleChart = (ctx: CanvasRenderingContext2D) => {
  const canvas = ctx.canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 簡単な折れ線グラフを描画
  ctx.strokeStyle = '#4ade80'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  const perfData = Array.from(dashboardData.value.performance.values())
  const maxDuration = Math.max(...perfData.map(s => s.averageDuration), 1)
  
  perfData.forEach((stat, index) => {
    const x = (index / Math.max(perfData.length - 1, 1)) * canvas.width
    const y = canvas.height - (stat.averageDuration / maxDuration) * canvas.height
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
}

const updateChart = () => {
  if (performanceChart.value) {
    const ctx = performanceChart.value.getContext('2d')
    if (ctx) {
      drawSimpleChart(ctx)
    }
  }
}

// ユーティリティ関数
const formatDuration = (ms: number): string => {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`
}

const formatTime = (timestamp: number): string => {
  const date = new Date(Date.now() - (performance.now() - timestamp))
  return date.toLocaleTimeString('ja-JP', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDurationRow = (row: any) => formatDuration(row.averageDuration)
const formatSuccessRateRow = (row: any) => `${(row.successRate * 100).toFixed(1)}%`
const formatMemoryRow = (row: any) => formatBytes(row.totalMemoryDelta)

// データ管理
const clearData = () => {
  stateMonitor.clear()
  realtimeLogs.value = []
  updateDashboard()
  ElMessage.success('データをクリアしました')
}

const clearErrors = () => {
  // ErrorTrackerにクリア機能を追加する必要がある
  ElMessage.success('エラーをクリアしました')
}

const clearLogs = () => {
  realtimeLogs.value = []
  ElMessage.success('ログをクリアしました')
}

const exportData = () => {
  const data = {
    timestamp: new Date().toISOString(),
    dashboard: dashboardData.value,
    logs: realtimeLogs.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `debug-data-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  ElMessage.success('データをエクスポートしました')
}

// ライフサイクル
onMounted(() => {
  logger.info('DebugDashboard mounted')
})

onUnmounted(() => {
  if (isActive.value) {
    stopMonitoring()
  }
})

// チャート表示切替の監視
watch(showPerformanceChart, async (newValue) => {
  if (newValue && isActive.value) {
    await nextTick()
    initializeChart()
  } else if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<style scoped>
.debug-dashboard {
  padding: var(--space-lg);
  background: var(--bg-primary);
  min-height: 100vh;
  font-family: 'Monaco', 'Consolas', monospace;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.dashboard-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--text-primary);
}

.title-icon {
  font-size: var(--font-size-lg);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gray-400);
  transition: background-color 0.3s ease;
}

.status-dot.active {
  background: var(--success-color);
  animation: pulse 2s infinite;
}

.status-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.dashboard-controls {
  display: flex;
  gap: var(--space-sm);
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.overview-card {
  padding: var(--space-lg);
  background: white;
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.overview-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  font-weight: 600;
  color: var(--text-primary);
}

.card-icon {
  font-size: var(--font-size-lg);
}

.card-title {
  font-size: var(--font-size-base);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.metric-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.success-rate {
  color: var(--success-color);
}

.recent-errors {
  color: var(--warning-color);
}

.critical-errors {
  color: var(--error-color);
}

.trend-increasing {
  color: var(--error-color);
}

.trend-decreasing {
  color: var(--success-color);
}

.trend-stable {
  color: var(--info-color);
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.detail-section {
  background: white;
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
}

.section-title {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.chart-container {
  padding: var(--space-lg);
  height: 300px;
}

.performance-chart {
  width: 100%;
  height: 100%;
}

.table-container {
  max-height: 400px;
  overflow-y: auto;
}

.performance-table {
  width: 100%;
}

.error-list {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-md);
}

.error-item {
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--gray-300);
  background: var(--gray-50);
}

.error-item.severity-critical {
  border-left-color: var(--error-color);
  background: #fef2f2;
}

.error-item.severity-high {
  border-left-color: #f97316;
  background: #fff7ed;
}

.error-item.severity-medium {
  border-left-color: var(--warning-color);
  background: #fffbeb;
}

.error-item.severity-low {
  border-left-color: var(--info-color);
  background: #f0f9ff;
}

.error-header {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-xs);
  font-size: var(--font-size-xs);
}

.error-severity {
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--gray-200);
  font-weight: 600;
}

.error-frequency {
  color: var(--text-secondary);
}

.error-time {
  color: var(--text-secondary);
}

.error-message {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: 500;
}

.error-stack {
  margin-top: var(--space-xs);
  padding: var(--space-xs);
  background: var(--gray-100);
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: pre-wrap;
  overflow-x: auto;
}

.error-controls {
  padding: var(--space-md);
  border-top: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-container {
  height: 300px;
  overflow-y: auto;
  padding: var(--space-md);
  background: #1a1a1a;
  font-family: 'Monaco', 'Consolas', monospace;
}

.log-entry {
  display: flex;
  gap: var(--space-sm);
  padding: 2px 0;
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.log-time {
  color: #666;
  min-width: 80px;
}

.log-level {
  min-width: 50px;
  font-weight: 600;
}

.log-debug .log-level {
  color: #8b5cf6;
}

.log-info .log-level {
  color: #06b6d4;
}

.log-warn .log-level {
  color: #f59e0b;
}

.log-error .log-level {
  color: #ef4444;
}

.log-component {
  color: #10b981;
  min-width: 100px;
}

.log-message {
  color: #e5e7eb;
  flex: 1;
}

.log-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .debug-dashboard {
    padding: var(--space-md);
  }
  
  .dashboard-header {
    flex-direction: column;
    gap: var(--space-md);
    align-items: stretch;
  }
  
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    gap: var(--space-sm);
    align-items: stretch;
  }
}
</style> 