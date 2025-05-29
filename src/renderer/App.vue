<template>
  <el-config-provider :locale="ja">
    <RecordingView />
    <DebugPanel :model-value="debugPanelVisible" @update:model-value="debugPanelVisible = $event" />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElConfigProvider } from 'element-plus'
import ja from 'element-plus/es/locale/lang/ja'
import RecordingView from './views/RecordingView.vue'
import DebugPanel from './components/DebugPanel.vue'
import { createLogger } from '../common/logger'

const logger = createLogger('App')
const debugPanelVisible = ref(false)

// キーボードショートカットの処理
const handleKeyDown = (event: KeyboardEvent) => {
  // F12キーでデバッグパネルを切り替え
  if (event.key === 'F12') {
    event.preventDefault()
    debugPanelVisible.value = !debugPanelVisible.value
    logger.info('Debug panel toggled', { visible: debugPanelVisible.value })
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  logger.info('App mounted, debug panel available with F12')
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  logger.debug('App unmounted, event listeners removed')
})
</script>

<style scoped>
</style> 