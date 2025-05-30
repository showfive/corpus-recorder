<template>
  <div class="debug-section">
    <div class="recording-status">
      <!-- 録音サービス状態 -->
      <el-descriptions title="録音サービス状態" :column="2" border>
        <el-descriptions-item label="現在の状態">{{ recordingState }}</el-descriptions-item>
        <el-descriptions-item label="マイクの状態">{{ microphoneStatus }}</el-descriptions-item>
        <el-descriptions-item label="現在のテキスト">{{ currentTextInfo }}</el-descriptions-item>
        <el-descriptions-item label="録音ディレクトリ">{{ recordingDirectory || '未設定' }}</el-descriptions-item>
      </el-descriptions>

      <!-- Web Worker統計情報 -->
      <el-descriptions title="Web Worker統計" :column="2" border style="margin-top: 20px;">
        <el-descriptions-item label="ワーカー数">{{ workerStats.workerCount }}</el-descriptions-item>
        <el-descriptions-item label="初期化状態">{{ workerStats.isInitialized ? '完了' : '未完了' }}</el-descriptions-item>
        <el-descriptions-item label="キューサイズ">{{ workerStats.queueSize }}</el-descriptions-item>
        <el-descriptions-item label="処理中タスク">{{ workerStats.pendingTasks }}</el-descriptions-item>
      </el-descriptions>

      <!-- 音声処理状態 -->
      <el-descriptions title="音声処理状態" :column="2" border style="margin-top: 20px;">
        <el-descriptions-item label="処理中">{{ isProcessing ? 'はい' : 'いいえ' }}</el-descriptions-item>
        <el-descriptions-item label="最新エラー">{{ lastError || 'なし' }}</el-descriptions-item>
      </el-descriptions>

      <!-- マイクデバイス情報 -->
      <el-descriptions v-if="audioDevices.length > 0" title="音声デバイス" :column="1" border style="margin-top: 20px;">
        <el-descriptions-item 
          v-for="(device, index) in audioDevices" 
          :key="device.deviceId"
          :label="`デバイス ${index + 1}`"
        >
          {{ device.label || `不明なデバイス (${device.deviceId.substring(0, 8)}...)` }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 音声品質設定 -->
      <div class="audio-quality-info" style="margin-top: 20px;">
        <h4>音声品質設定</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="自動利得制御">{{ audioQualitySettings.autoGainControl ? 'ON' : 'OFF' }}</el-descriptions-item>
          <el-descriptions-item label="ノイズ抑制">{{ audioQualitySettings.noiseSuppression ? 'ON' : 'OFF' }}</el-descriptions-item>
          <el-descriptions-item label="エコーキャンセレーション">{{ audioQualitySettings.echoCancellation ? 'ON' : 'OFF' }}</el-descriptions-item>
          <el-descriptions-item label="サンプルレート">{{ audioQualitySettings.sampleRate || 'デフォルト' }} Hz</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRecordingStore } from '../../stores/recordingStore'
import { useAudioWorker } from '../../composables/useAudioWorker'

// ストア
const recordingStore = useRecordingStore()

// Composables
const { isProcessing, lastError, workerStats } = useAudioWorker()

// リアクティブデータ
const microphoneStatus = ref('不明')
const audioDevices = ref<MediaDeviceInfo[]>([])
const audioQualitySettings = ref({
  autoGainControl: false,
  noiseSuppression: false,
  echoCancellation: false,
  sampleRate: null as number | null
})

// 計算されたプロパティ
const recordingState = computed(() => recordingStore.recordingState)
const recordingDirectory = computed(() => recordingStore.recordingDirectory)
const currentTextInfo = computed(() => {
  const current = recordingStore.currentTextObject
  return current ? `${current.index}: ${current.text.substring(0, 50)}...` : '選択されていません'
})

// メソッド
const checkMicrophoneStatus = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter(device => device.kind === 'audioinput')
    audioDevices.value = audioInputs
    microphoneStatus.value = audioInputs.length > 0 ? `利用可能（${audioInputs.length}台）` : '利用不可'

    // 権限が許可されている場合は詳細情報を表示
    if (audioInputs.some(device => device.label)) {
      microphoneStatus.value += ' - 権限許可済み'
    } else {
      microphoneStatus.value += ' - 権限未許可'
    }
  } catch (error) {
    microphoneStatus.value = 'アクセス権限なし'
    console.error('Microphone access check failed:', error)
  }
}

const updateAudioQualitySettings = () => {
  // 現在のストリームから設定を取得（実際の実装では recordingService から取得）
  try {
    // デフォルト設定を表示（実際の実装では動的に取得）
    audioQualitySettings.value = {
      autoGainControl: false,
      noiseSuppression: false,
      echoCancellation: false,
      sampleRate: null
    }
  } catch (error) {
    console.error('Failed to get audio quality settings:', error)
  }
}

// ライフサイクル
onMounted(() => {
  checkMicrophoneStatus()
  updateAudioQualitySettings()
  
  // 定期的に状態を更新
  const interval = setInterval(() => {
    checkMicrophoneStatus()
    updateAudioQualitySettings()
  }, 5000)
  
  // クリーンアップ
  return () => clearInterval(interval)
})
</script>

<style scoped>
.debug-section {
  padding: 16px;
}

.recording-status {
  max-height: 500px;
  overflow-y: auto;
}

.audio-quality-info h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

:deep(.el-descriptions__header) {
  margin-bottom: 16px;
}

:deep(.el-descriptions__title) {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

:deep(.el-descriptions__body) {
  background: #fff;
}

:deep(.el-descriptions-item__cell) {
  font-size: 14px;
}

:deep(.el-descriptions-item__label) {
  font-weight: 500;
  background: #fafafa;
}
</style> 