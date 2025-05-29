<template>
  <div class="recording-view">
    <!-- 専用タイトルバー（ドラッグ専用領域） -->
    <div class="title-bar">
      <span class="app-title">Corpus Recorder</span>
    </div>

    <!-- 設定エリア -->
    <SettingsPanel
      :recording-directory="recordingStore.recordingDirectory"
      @select-directory="recordingStore.selectDirectory"
      @load-text-file="recordingStore.loadTextFile"
    />

    <!-- メインコンテンツ -->
    <el-main class="main-content">
      <!-- テキスト表示エリア -->
      <TextDisplay 
        :currentText="recordingStore.currentTextObject"
        :textIndex="recordingStore.currentTextIndex"
        :totalTexts="recordingStore.texts.length"
        :fileFormat="recordingStore.currentFileFormat"
      />      <!-- 録音コントロール -->
      <RecordingControls
        :recording-state="recordingStore.recordingState"
        :has-recordings="recordingStore.currentRecordings.length > 0"
        @start-recording="recordingStore.startRecording"
        @stop-recording="recordingStore.stopRecording"
        @retry-recording="recordingStore.retryRecording"
      />

      <!-- ナビゲーションコントロール -->
      <NavigationControls
        :current-index="recordingStore.currentTextIndex"
        :total-texts="recordingStore.texts.length"
        @navigate-to="recordingStore.navigateToText"
      />

      <!-- 録音済み音声リスト -->
      <RecordingsList
        :recordings="recordingStore.currentRecordings"
        @play-recording="recordingStore.playRecording"
        @delete-recording="recordingStore.deleteRecording"
      />
    </el-main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import TextDisplay from '../components/TextDisplay.vue'
import RecordingControls from '../components/RecordingControls.vue'
import NavigationControls from '../components/NavigationControls.vue'
import RecordingsList from '../components/RecordingsList.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import { useRecordingStore } from '../stores/recordingStore'

// Piniaストアの使用
const recordingStore = useRecordingStore()

// 初期化
onMounted(async () => {
  await recordingStore.initialize()
})
</script>

<style scoped>
.recording-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.title-bar {
  height: 40px;
  background: linear-gradient(to bottom, #f7f7f7, #e8e8e8);
  border-bottom: 1px solid #d0d0d0;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
  user-select: none;
}

.app-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
}
</style>