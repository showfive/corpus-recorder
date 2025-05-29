<template>
  <el-drawer
    v-model="visible"
    title="デバッグパネル"
    size="60%"
    direction="rtl"
  >
    <el-tabs v-model="activeTab" type="card">
      <!-- ログタブ -->
      <el-tab-pane label="ログ" name="logs">
        <div class="debug-section">
          <!-- ログフィルター -->
          <div class="log-filters">
            <el-row :gutter="16">
              <el-col :span="6">
                <el-select v-model="logLevelFilter" placeholder="ログレベル" clearable>
                  <el-option label="すべて" value="" />
                  <el-option label="DEBUG" value="DEBUG" />
                  <el-option label="INFO" value="INFO" />
                  <el-option label="WARN" value="WARN" />
                  <el-option label="ERROR" value="ERROR" />
                </el-select>
              </el-col>
              <el-col :span="6">
                <el-select v-model="logCategoryFilter" placeholder="カテゴリ" clearable>
                  <el-option label="すべて" value="" />
                  <el-option v-for="category in logCategories" :key="category" :label="category" :value="category" />
                </el-select>
              </el-col>
              <el-col :span="6">
                <el-button @click="clearLogs" type="danger" size="small">ログクリア</el-button>
              </el-col>
              <el-col :span="6">
                <el-button @click="exportLogs" type="primary" size="small">ログエクスポート</el-button>
              </el-col>
            </el-row>
          </div>

          <!-- ログエントリ表示 -->
          <div class="log-entries">
            <div 
              v-for="log in filteredLogs" 
              :key="`${log.timestamp}-${log.category}-${log.message}`"
              :class="['log-entry', `level-${log.level.toLowerCase()}`]"
            >
              <div class="log-header">
                <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
                <span :class="['log-level', `level-${log.level.toLowerCase()}`]">{{ log.level }}</span>
                <span class="log-category">{{ log.category }}</span>
              </div>
              <div class="log-message">{{ log.message }}</div>
              <div v-if="log.data" class="log-data">
                <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- エラー履歴タブ -->
      <el-tab-pane label="エラー履歴" name="errors">
        <div class="debug-section">
          <!-- エラー統計 -->
          <div class="error-stats">
            <h4>エラー統計</h4>
            <el-row :gutter="16">
              <el-col :span="6">
                <el-statistic title="総エラー数" :value="errorStats.total" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="24時間以内" :value="errorStats.recent24h" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="高重要度" :value="errorStats.bySeverity.HIGH || 0" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="致命的" :value="errorStats.bySeverity.CRITICAL || 0" />
              </el-col>
            </el-row>
          </div>

          <div class="error-history">
            <div 
              v-for="error in errorHistory" 
              :key="error.id"
              :class="['error-entry', `severity-${error.severity.toLowerCase()}`]"
            >
              <div class="error-header">
                <span class="error-timestamp">{{ formatTimestamp(error.timestamp) }}</span>
                <span :class="['error-severity', `severity-${error.severity.toLowerCase()}`]">
                  {{ error.severity }}
                </span>
                <span class="error-category">{{ error.category }}</span>
                <span class="error-id">ID: {{ error.id }}</span>
              </div>
              <div class="error-message">{{ error.userMessage }}</div>
              <div v-if="error.technicalMessage" class="error-technical">
                技術的詳細: {{ error.technicalMessage }}
              </div>
              <div v-if="error.suggestions && error.suggestions.length" class="error-suggestions">
                推奨対応:
                <ul>
                  <li v-for="suggestion in error.suggestions" :key="suggestion">{{ suggestion }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- システム情報タブ -->
      <el-tab-pane label="システム情報" name="system">
        <div class="debug-section">
          <div class="system-info">
            <el-descriptions title="ブラウザ情報" :column="1" border>
              <el-descriptions-item label="User Agent">{{ systemInfo.userAgent }}</el-descriptions-item>
              <el-descriptions-item label="プラットフォーム">{{ systemInfo.platform }}</el-descriptions-item>
              <el-descriptions-item label="言語">{{ systemInfo.language }}</el-descriptions-item>
              <el-descriptions-item label="オンライン状態">{{ systemInfo.onLine ? 'オンライン' : 'オフライン' }}</el-descriptions-item>
            </el-descriptions>

            <el-descriptions v-if="systemInfo.memoryInfo" title="メモリ情報" :column="1" border style="margin-top: 20px;">
              <el-descriptions-item label="使用中JSヒープ">
                {{ formatBytes(systemInfo.memoryInfo.usedJSHeapSize) }}
              </el-descriptions-item>
              <el-descriptions-item label="総JSヒープ">
                {{ formatBytes(systemInfo.memoryInfo.totalJSHeapSize) }}
              </el-descriptions-item>
              <el-descriptions-item label="JSヒープ制限">
                {{ formatBytes(systemInfo.memoryInfo.jsHeapSizeLimit) }}
              </el-descriptions-item>
            </el-descriptions>

            <el-descriptions title="画面情報" :column="1" border style="margin-top: 20px;">
              <el-descriptions-item label="解像度">{{ systemInfo.screen.width }} × {{ systemInfo.screen.height }}</el-descriptions-item>
              <el-descriptions-item label="色深度">{{ systemInfo.screen.colorDepth }} bit</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </el-tab-pane>

      <!-- 録音サービス状態タブ -->
      <el-tab-pane label="録音状態" name="recording">
        <div class="debug-section">
          <div class="recording-status">
            <el-descriptions title="録音サービス状態" :column="2" border>
              <el-descriptions-item label="現在の状態">{{ recordingState }}</el-descriptions-item>
              <el-descriptions-item label="マイクの状態">{{ microphoneStatus }}</el-descriptions-item>
              <el-descriptions-item label="現在のテキスト">{{ currentTextInfo }}</el-descriptions-item>
              <el-descriptions-item label="録音ディレクトリ">{{ recordingDirectory || '未設定' }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </el-tab-pane>

      <!-- 設定タブ -->
      <el-tab-pane label="設定" name="settings">
        <div class="debug-section">
          <div class="debug-settings">
            <h4>デバッグ設定</h4>
            <el-form label-width="150px">
              <el-form-item label="コンソール出力">
                <el-switch v-model="debugConfig.enableConsole" @change="updateLoggerConfig" />
              </el-form-item>
              <el-form-item label="パフォーマンス測定">
                <el-switch v-model="debugConfig.enablePerformance" @change="updateLoggerConfig" />
              </el-form-item>
              <el-form-item label="ログレベル">
                <el-select v-model="debugConfig.logLevel" @change="updateLoggerConfig">
                  <el-option label="DEBUG" value="DEBUG" />
                  <el-option label="INFO" value="INFO" />
                  <el-option label="WARN" value="WARN" />
                  <el-option label="ERROR" value="ERROR" />
                </el-select>
              </el-form-item>
              <el-form-item label="最大ログエントリ数">
                <el-input-number 
                  v-model="debugConfig.maxLogEntries" 
                  :min="100" 
                  :max="5000" 
                  @change="updateLoggerConfig"
                />
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { logger, type LogEntry, type LoggerConfig } from '../../common/logger'
import { errorHandler, type AppError } from '../../common/errorHandler'
import { useRecordingStore } from '../stores/recordingStore'

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// リアクティブデータ
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const activeTab = ref('logs')
const logLevelFilter = ref('')
const logCategoryFilter = ref('')
const logEntries = ref<LogEntry[]>([])
const errorHistory = ref<AppError[]>([])
const errorStats = ref<any>({})
const systemInfo = ref<any>({})
const debugConfig = ref<LoggerConfig>({
  enableConsole: true,
  enablePerformance: true,
  maxLogEntries: 1000,
  logLevel: 'INFO' as any
})

// ストア
const recordingStore = useRecordingStore()

// 計算されたプロパティ
const filteredLogs = computed(() => {
  return logEntries.value.filter(log => {
    const levelMatch = !logLevelFilter.value || log.level === logLevelFilter.value
    const categoryMatch = !logCategoryFilter.value || log.category === logCategoryFilter.value
    return levelMatch && categoryMatch
  }).slice(-100) // 最新100件のみ表示
})

const logCategories = computed(() => {
  const categories = new Set(logEntries.value.map(log => log.category))
  return Array.from(categories).sort()
})

const recordingState = computed(() => recordingStore.recordingState)
const recordingDirectory = computed(() => recordingStore.recordingDirectory)
const currentTextInfo = computed(() => {
  const current = recordingStore.currentTextObject
  return current ? `${current.index}: ${current.text.substring(0, 50)}...` : '選択されていません'
})

const microphoneStatus = ref('不明')

// メソッド
const updateData = () => {
  logEntries.value = logger.getLogEntries()
  errorHistory.value = errorHandler.getErrorHistory()
  errorStats.value = errorHandler.getErrorStats()
  systemInfo.value = logger.collectSystemInfo()
  debugConfig.value = logger.getConfig()
}

const clearLogs = () => {
  logger.clearLogs()
  updateData()
}

const exportLogs = () => {
  const data = logger.exportLogs()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const updateLoggerConfig = () => {
  logger.updateConfig(debugConfig.value)
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const checkMicrophoneStatus = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter(device => device.kind === 'audioinput')
    microphoneStatus.value = audioInputs.length > 0 ? `利用可能（${audioInputs.length}台）` : '利用不可'
  } catch (error) {
    microphoneStatus.value = 'アクセス権限なし'
  }
}

// ライフサイクル
onMounted(() => {
  updateData()
  checkMicrophoneStatus()
  
  // 定期的にデータを更新
  const interval = setInterval(updateData, 2000)
  
  // クリーンアップ
  return () => clearInterval(interval)
})

// ウォッチャー
watch(visible, (newVisible) => {
  if (newVisible) {
    updateData()
  }
})
</script>

<style scoped>
.debug-section {
  padding: 16px;
}

.log-filters {
  margin-bottom: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 4px;
}

.log-entries {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.log-entry {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-entry.level-debug {
  background: #f0f9ff;
}

.log-entry.level-info {
  background: #f0f9ff;
}

.log-entry.level-warn {
  background: #fffbf0;
}

.log-entry.level-error {
  background: #fef0f0;
}

.log-header {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}

.log-timestamp {
  color: #666;
}

.log-level {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.log-level.level-debug {
  background: #e3f2fd;
  color: #1976d2;
}

.log-level.level-info {
  background: #e8f5e8;
  color: #388e3c;
}

.log-level.level-warn {
  background: #fff3e0;
  color: #f57c00;
}

.log-level.level-error {
  background: #ffebee;
  color: #d32f2f;
}

.log-category {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.log-message {
  margin: 4px 0;
  font-weight: 500;
}

.log-data {
  margin-top: 8px;
  background: #f8f8f8;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
}

.log-data pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-stats {
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 4px;
}

.error-history {
  max-height: 500px;
  overflow-y: auto;
}

.error-entry {
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.error-entry.severity-low {
  background: #f0f9ff;
  border-color: #91d5ff;
}

.error-entry.severity-medium {
  background: #fffbf0;
  border-color: #ffd666;
}

.error-entry.severity-high {
  background: #fff2f0;
  border-color: #ffb3ba;
}

.error-entry.severity-critical {
  background: #fef0f0;
  border-color: #ff7875;
}

.error-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}

.error-timestamp {
  color: #666;
}

.error-severity {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.error-severity.severity-low {
  background: #e6f7ff;
  color: #1890ff;
}

.error-severity.severity-medium {
  background: #fff7e6;
  color: #fa8c16;
}

.error-severity.severity-high {
  background: #fff1f0;
  color: #ff4d4f;
}

.error-severity.severity-critical {
  background: #fff0f6;
  color: #c41d7f;
}

.error-category {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.error-id {
  color: #666;
  font-family: monospace;
}

.error-message {
  margin: 8px 0;
  font-weight: 500;
}

.error-technical {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.error-suggestions {
  margin: 8px 0;
  font-size: 14px;
}

.error-suggestions ul {
  margin: 4px 0 0 16px;
}

.system-info {
  max-height: 500px;
  overflow-y: auto;
}

.recording-status {
  padding: 16px;
}

.debug-settings {
  padding: 16px;
}
</style>