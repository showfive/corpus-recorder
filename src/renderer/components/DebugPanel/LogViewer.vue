<template>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { logger, type LogEntry } from '../../../common/logger'

// リアクティブデータ
const logLevelFilter = ref('')
const logCategoryFilter = ref('')
const logEntries = ref<LogEntry[]>([])

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

// メソッド
const updateLogData = () => {
  logEntries.value = logger.getLogEntries()
}

const clearLogs = () => {
  logger.clearLogs()
  updateLogData()
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

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

// ライフサイクル
onMounted(() => {
  updateLogData()
  
  // 定期的にデータを更新
  const interval = setInterval(updateLogData, 2000)
  
  // クリーンアップ
  return () => clearInterval(interval)
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
</style> 