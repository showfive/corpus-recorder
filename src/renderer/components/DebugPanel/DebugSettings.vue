<template>
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

      <!-- 詳細設定 -->
      <h4 style="margin-top: 32px;">詳細設定</h4>
      <el-form label-width="150px">
        <el-form-item label="Web Worker有効">
          <el-switch v-model="advancedConfig.enableWebWorkers" @change="updateAdvancedConfig" />
          <div class="setting-description">
            音声処理にWeb Workerを使用してメインスレッドの負荷を軽減
          </div>
        </el-form-item>
        <el-form-item label="音声品質モード">
          <el-select v-model="advancedConfig.audioQualityMode" @change="updateAdvancedConfig">
            <el-option label="高品質" value="high" />
            <el-option label="標準" value="standard" />
            <el-option label="省電力" value="low" />
          </el-select>
          <div class="setting-description">
            音声録音の品質と消費電力のバランス
          </div>
        </el-form-item>
        <el-form-item label="自動保存間隔">
          <el-input-number 
            v-model="advancedConfig.autoSaveInterval" 
            :min="10" 
            :max="300" 
            @change="updateAdvancedConfig"
          />
          <span style="margin-left: 8px;">秒</span>
          <div class="setting-description">
            録音データの自動保存間隔（0で無効）
          </div>
        </el-form-item>
      </el-form>

      <!-- システム制御 -->
      <h4 style="margin-top: 32px;">システム制御</h4>
      <el-space direction="vertical" style="width: 100%;">
        <el-button @click="clearAllLogs" type="danger" size="small">
          <el-icon><Delete /></el-icon>
          全ログクリア
        </el-button>
        <el-button @click="exportAllData" type="primary" size="small">
          <el-icon><Download /></el-icon>
          全デバッグデータエクスポート
        </el-button>
        <el-button @click="resetToDefaults" type="warning" size="small">
          <el-icon><Refresh /></el-icon>
          設定をデフォルトに戻す
        </el-button>
        <el-button @click="reloadApplication" type="info" size="small">
          <el-icon><RefreshRight /></el-icon>
          アプリケーション再読み込み
        </el-button>
      </el-space>

      <!-- 現在の設定状況 -->
      <h4 style="margin-top: 32px;">現在の設定状況</h4>
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="ログエントリ数">{{ currentLogCount }}</el-descriptions-item>
        <el-descriptions-item label="エラー履歴数">{{ currentErrorCount }}</el-descriptions-item>
        <el-descriptions-item label="設定最終更新">{{ lastConfigUpdate }}</el-descriptions-item>
        <el-descriptions-item label="アプリケーション開始時間">{{ applicationStartTime }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Refresh, RefreshRight } from '@element-plus/icons-vue'
import { logger, type LoggerConfig } from '../../../common/logger'
import { errorHandler } from '../../../common/errorHandler'

// リアクティブデータ
const debugConfig = ref<LoggerConfig>({
  enableConsole: true,
  enablePerformance: true,
  maxLogEntries: 1000,
  logLevel: 'INFO' as any
})

const advancedConfig = ref({
  enableWebWorkers: true,
  audioQualityMode: 'standard',
  autoSaveInterval: 60
})

const currentLogCount = ref(0)
const currentErrorCount = ref(0)
const lastConfigUpdate = ref('未更新')
const applicationStartTime = ref('不明')

// メソッド
const updateLoggerConfig = () => {
  logger.updateConfig(debugConfig.value)
  lastConfigUpdate.value = new Date().toLocaleString()
  ElMessage.success('ログ設定が更新されました')
}

const updateAdvancedConfig = () => {
  // 将来的に詳細設定を保存する処理
  lastConfigUpdate.value = new Date().toLocaleString()
  ElMessage.success('詳細設定が更新されました')
}

const clearAllLogs = async () => {
  try {
    await ElMessageBox.confirm(
      '全てのログとエラー履歴が削除されます。この操作は取り消せません。',
      '確認',
      {
        confirmButtonText: '削除',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }
    )
    
    logger.clearLogs()
    errorHandler.clearErrorHistory()
    updateStatistics()
    ElMessage.success('全ログがクリアされました')
  } catch {
    // キャンセルされた場合は何もしない
  }
}

const exportAllData = () => {
  const data = {
    logs: logger.exportLogs(),
    errors: JSON.stringify(errorHandler.getErrorHistory(), null, 2),
    systemInfo: logger.collectSystemInfo(),
    config: {
      debug: debugConfig.value,
      advanced: advancedConfig.value
    },
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `debug-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  ElMessage.success('デバッグデータをエクスポートしました')
}

const resetToDefaults = async () => {
  try {
    await ElMessageBox.confirm(
      '全ての設定がデフォルト値に戻されます。',
      '確認',
      {
        confirmButtonText: 'リセット',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }
    )
    
    debugConfig.value = {
      enableConsole: true,
      enablePerformance: true,
      maxLogEntries: 1000,
      logLevel: 'INFO' as any
    }
    
    advancedConfig.value = {
      enableWebWorkers: true,
      audioQualityMode: 'standard',
      autoSaveInterval: 60
    }
    
    updateLoggerConfig()
    ElMessage.success('設定をデフォルトに戻しました')
  } catch {
    // キャンセルされた場合は何もしない
  }
}

const reloadApplication = async () => {
  try {
    await ElMessageBox.confirm(
      'アプリケーションが再読み込みされます。未保存のデータは失われる可能性があります。',
      '確認',
      {
        confirmButtonText: '再読み込み',
        cancelButtonText: 'キャンセル',
        type: 'warning',
      }
    )
    
    window.location.reload()
  } catch {
    // キャンセルされた場合は何もしない
  }
}

const updateStatistics = () => {
  currentLogCount.value = logger.getLogEntries().length
  currentErrorCount.value = errorHandler.getErrorHistory().length
}

const initializeData = () => {
  debugConfig.value = logger.getConfig()
  applicationStartTime.value = new Date().toLocaleString()
  updateStatistics()
}

// ライフサイクル
onMounted(() => {
  initializeData()
  
  // 定期的に統計を更新
  const interval = setInterval(updateStatistics, 5000)
  
  // クリーンアップ
  return () => clearInterval(interval)
})
</script>

<style scoped>
.debug-section {
  padding: 16px;
}

.debug-settings {
  max-height: 500px;
  overflow-y: auto;
}

.debug-settings h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 8px;
}

.setting-description {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-button) {
  width: 100%;
  justify-content: flex-start;
}

:deep(.el-button .el-icon) {
  margin-right: 8px;
}

:deep(.el-descriptions-item__cell) {
  font-size: 14px;
}

:deep(.el-descriptions-item__label) {
  font-weight: 500;
  background: #fafafa;
}
</style> 