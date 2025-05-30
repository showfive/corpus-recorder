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
        <LogViewer />
      </el-tab-pane>

      <!-- エラー履歴タブ -->
      <el-tab-pane label="エラー履歴" name="errors">
        <ErrorHistoryViewer />
      </el-tab-pane>

      <!-- システム情報タブ -->
      <el-tab-pane label="システム情報" name="system">
        <SystemInfoViewer />
      </el-tab-pane>

      <!-- 録音サービス状態タブ -->
      <el-tab-pane label="録音状態" name="recording">
        <RecordingStatusViewer />
      </el-tab-pane>

      <!-- 設定タブ -->
      <el-tab-pane label="設定" name="settings">
        <DebugSettings />
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import LogViewer from './LogViewer.vue'
import ErrorHistoryViewer from './ErrorHistoryViewer.vue'
import SystemInfoViewer from './SystemInfoViewer.vue'
import RecordingStatusViewer from './RecordingStatusViewer.vue'
import DebugSettings from './DebugSettings.vue'

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
</script>

<style scoped>
/* メインコンテナのスタイル調整 */
:deep(.el-drawer__body) {
  padding: 16px;
}

:deep(.el-tabs__content) {
  padding: 0;
}
</style> 