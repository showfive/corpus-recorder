<template>
  <div class="recording-view">    <!-- 専用タイトルバー（ドラッグ専用領域） -->
    <div class="title-bar">
      <div class="title-content">
        <div class="app-icon">🎙️</div>
        <span class="app-title">Corpus Recorder</span>
      </div>
      <el-button
        :icon="Setting"
        circle
        size="small"
        class="settings-button"
        @click="showSettings = true"
      />
    </div>    
    <!-- 設定ダイアログ -->
    <el-dialog
      v-model="showSettings"
      title="設定"
      width="600px"
      :modal="true"
      :close-on-click-modal="false"
    >
      <SettingsPanel
        :recording-directory="recordingStore.recordingDirectory"
        :audio-settings="recordingStore.audioSettings"
        @select-directory="recordingStore.selectDirectory"
        @update-audio-setting="recordingStore.updateAudioSetting"
      />
    </el-dialog>

    <!-- メインコンテンツ -->
    <div class="main-content">
      <div class="content-grid">        <!-- 左側: テキスト表示（ナビゲーション統合済み） -->
        <div class="left-panel">
          <TextDisplay 
            :currentText="recordingStore.currentTextObject"
            :textIndex="recordingStore.currentTextIndex"
            :totalTexts="recordingStore.texts.length"
            :fileFormat="recordingStore.currentFileFormat"
            @load-text-file="recordingStore.loadTextFile"
            @navigate-to="recordingStore.navigateToText"
          />
        </div>

        <!-- 右側: 録音コントロールと録音リスト -->
        <div class="right-panel">
          <RecordingControls
            :recording-state="recordingStore.recordingState"
            :has-recordings="recordingStore.currentRecordings.length > 0"
            :current-recordings="recordingStore.currentRecordings"
            @start-recording="recordingStore.startRecording"
            @stop-recording="recordingStore.stopRecording"
            @retry-recording="recordingStore.retryRecording"
            @play-recording="recordingStore.playRecording"
          />

          <RecordingsList
            :recordings="recordingStore.currentRecordings"
            @play-recording="recordingStore.playRecording"
            @delete-recording="recordingStore.deleteRecording"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import TextDisplay from '../components/TextDisplay.vue'
import RecordingControls from '../components/RecordingControls.vue'
import RecordingsList from '../components/RecordingsList.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import { useRecordingStore } from '../stores/recordingStore'

// Piniaストアの使用
const recordingStore = useRecordingStore()
const showSettings = ref(false)

// 初期化
onMounted(async () => {
  await recordingStore.initialize()
})

// クリーンアップ
onUnmounted(() => {
  // 音声再生のクリーンアップ
  if (window.currentAudio) {
    window.currentAudio.pause()
    window.currentAudio.currentTime = 0
    window.currentAudio = null
  }
})
</script>

<style scoped>
.recording-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
}

.title-bar {
  height: 48px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  box-shadow: var(--shadow-sm);
}

.title-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.app-icon {
  font-size: 1.25rem;
}

.app-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: white;
  letter-spacing: -0.025em;
}

.settings-button {
  -webkit-app-region: no-drag;
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
  transition: all 0.2s ease;
}

.settings-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-xl);
  min-height: 0;
}

.content-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: min-content;
  padding-bottom: var(--space-xl);
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: min-content;
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .main-content {
    padding: var(--space-md);
  }
  
  .content-grid {
    gap: var(--space-md);
    max-width: 100%;
  }
}
</style>