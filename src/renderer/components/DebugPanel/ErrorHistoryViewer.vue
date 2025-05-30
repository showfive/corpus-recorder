<template>
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

    <!-- エラー履歴 -->
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { errorHandler, type AppError } from '../../../common/errorHandler'

// リアクティブデータ
const errorHistory = ref<AppError[]>([])
const errorStats = ref<any>({})

// メソッド
const updateErrorData = () => {
  errorHistory.value = errorHandler.getErrorHistory()
  errorStats.value = errorHandler.getErrorStats()
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

// ライフサイクル
onMounted(() => {
  updateErrorData()
  
  // 定期的にデータを更新
  const interval = setInterval(updateErrorData, 2000)
  
  // クリーンアップ
  return () => clearInterval(interval)
})
</script>

<style scoped>
.debug-section {
  padding: 16px;
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
</style> 