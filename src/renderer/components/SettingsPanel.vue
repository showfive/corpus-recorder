<template>
  <div class="settings-content">
    <!-- 保存先設定セクション -->
    <div class="settings-section">
      <h3 class="section-title">📁 保存先設定</h3>
      <div class="section-content">
        <el-input 
          :model-value="recordingDirectory" 
          readonly 
          placeholder="保存ディレクトリを選択してください"
          class="directory-input"
        >
          <template #prefix>
            <span class="input-icon">📂</span>
          </template>
        </el-input>
        <el-button 
          @click="$emit('select-directory')" 
          type="primary"
          class="select-button"
          style="width: 100%; margin-top: 12px;"
        >
          フォルダを選択
        </el-button>
      </div>
    </div>
    
    <!-- 音声品質設定セクション -->
    <div class="settings-section">
      <h3 class="section-title">🎛️ 音声品質設定</h3>
      <div class="section-content">
        <el-alert 
          type="info" 
          :show-icon="false" 
          :closable="false"
          class="settings-alert"
        >
          音声品質の問題がある場合は、これらの設定をOFFにすることを推奨します
        </el-alert>
        
        <div class="audio-settings-list">
          <el-checkbox 
            :model-value="audioSettings.autoGainControl"
            @change="updateAudioSetting('autoGainControl', $event)"
            class="audio-checkbox"
          >
            オートゲインコントロール (AGC)
          </el-checkbox>
          <el-checkbox 
            :model-value="audioSettings.noiseSuppression"
            @change="updateAudioSetting('noiseSuppression', $event)"
            class="audio-checkbox"
          >
            ノイズサプレッション
          </el-checkbox>
          <el-checkbox 
            :model-value="audioSettings.echoCancellation"
            @change="updateAudioSetting('echoCancellation', $event)"
            class="audio-checkbox"
          >
            エコーキャンセレーション
          </el-checkbox>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AudioQualitySettings } from '../../common/types'

interface Props {
  recordingDirectory: string
  audioSettings: AudioQualitySettings
}

interface Emits {
  (e: 'select-directory'): void
  (e: 'update-audio-setting', key: keyof AudioQualitySettings, value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const updateAudioSetting = (key: keyof AudioQualitySettings, value: boolean) => {
  emit('update-audio-setting', key, value)
}
</script>

<style scoped>
.settings-panel {
  -webkit-app-region: no-drag;
}

.compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
}

.file-controls {
  display: flex;
  gap: var(--space-sm);
}

.directory-display {
  flex: 1;
  margin: 0 var(--space-lg);
  min-width: 0;
}

.directory-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-button {
  padding: var(--space-sm);
  font-size: var(--font-size-lg);
  color: var(--gray-600);
  transition: color 0.2s ease;
}

.settings-button:hover {
  color: var(--primary-color);
}

.audio-settings {
  padding: var(--space-md);
}

.settings-description {
  display: block;
  margin-bottom: var(--space-lg);
  padding: var(--space-sm);
  background-color: var(--gray-50);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--info-color);
}

.audio-settings-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.audio-checkbox {
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease;
}

.audio-checkbox:hover {
  background-color: var(--gray-50);
}

/* レスポンシブデザイン */
@media (max-width: 1024px) {
  .settings-content {
    grid-template-columns: 1fr;
    gap: var(--space-xl);
  }
}

@media (max-width: 768px) {
  .compact-header {
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
  }
  
  .file-controls {
    width: 100%;
    justify-content: center;
  }
  
  .directory-display {
    margin: 0;
    text-align: center;
  }
  
  .settings-button {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
  }
}
</style>
