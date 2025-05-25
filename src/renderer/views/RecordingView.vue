<template>
  <div class="recording-view">
    <!-- 専用タイトルバー（ドラッグ専用領域） -->
    <div class="title-bar">
      <span class="app-title">Corpus Recorder</span>
    </div>

    <!-- 設定エリア -->
    <el-header class="settings-header">
      <div class="settings-area">
        <el-space>
          <span>保存先:</span>
          <el-input 
            v-model="recordingDirectory" 
            readonly 
            style="width: 400px"
            placeholder="保存ディレクトリを選択してください"
          />
          <el-button @click="selectDirectory" type="primary">
            フォルダを選択
          </el-button>
          <el-button @click="loadTextFile" type="info">
            テキストファイルを開く
          </el-button>
        </el-space>
      </div>
    </el-header>

    <!-- メインコンテンツ -->
    <el-main class="main-content">
      <!-- テキスト表示エリア -->
      <TextDisplay 
        :currentText="currentTextObject"
        :textIndex="currentTextIndex"
        :totalTexts="texts.length"
        :fileFormat="currentFileFormat"
      />

      <!-- 録音コントロール -->
      <RecordingControls
        :recording-state="recordingState"
        @start-recording="startRecording"
        @stop-recording="stopRecording"
        @retry-recording="retryRecording"
      />

      <!-- ナビゲーションコントロール -->
      <NavigationControls
        :current-index="currentTextIndex"
        :total-texts="texts.length"
        @navigate-to="navigateToText"
      />

      <!-- 録音済み音声リスト -->
      <div class="recordings-list" v-if="currentRecordings.length > 0">
        <el-divider>録音済み音声</el-divider>
        <el-space direction="vertical" :size="10" style="width: 100%">
          <div v-for="recording in currentRecordings" :key="recording.id" class="recording-item">
            <el-card shadow="hover">              <el-row align="middle">
                <el-col :span="16">
                  <span>{{ recording.fileName }}</span>
                  <el-tag size="small" style="margin-left: 10px">
                    {{ formatDuration(recording.duration) }}
                  </el-tag>
                  <el-tag size="small" type="info" style="margin-left: 5px">
                    Take {{ recording.takeNumber }}
                  </el-tag>
                </el-col>
                <el-col :span="8" style="text-align: right">
                  <el-button-group>
                    <el-button size="small" @click="playRecording(recording)">
                      再生
                    </el-button>
                    <el-button size="small" type="danger" @click="deleteRecording(recording)">
                      削除
                    </el-button>
                  </el-button-group>
                </el-col>
              </el-row>
            </el-card>
          </div>
        </el-space>
      </div>
    </el-main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TextDisplay from '../components/TextDisplay.vue'
import RecordingControls from '../components/RecordingControls.vue'
import NavigationControls from '../components/NavigationControls.vue'
import { Recording, CorpusText, RecordingState, TextFileFormat, AudioFileMetadata } from '../../common/types'

// 状態管理
const recordingDirectory = ref<string>('')
const texts = ref<CorpusText[]>([])
const currentTextIndex = ref<number>(0)
const recordingState = ref<RecordingState>(RecordingState.IDLE)
const recordings = ref<Recording[]>([])
const currentFileFormat = ref<TextFileFormat | null>(null)

// 現在のテキスト (CorpusText オブジェクト全体を返すように変更)
const currentTextObject = computed(() => {
  if (texts.value.length === 0 || currentTextIndex.value < 0 || currentTextIndex.value >= texts.value.length) {
    return null
  }
  return texts.value[currentTextIndex.value]
})

// 現在のテキストに関連する録音
const currentRecordings = computed(() => {
  if (texts.value.length === 0) return []
  const currentTextId = texts.value[currentTextIndex.value]?.id
  return recordings.value.filter(r => r.textId === currentTextId)
})

// ファイル名生成
const generateFileName = (currentText: CorpusText, takeNumber: number): string => {
  if (currentFileFormat.value === TextFileFormat.ITA_FORMAT || 
      currentFileFormat.value === TextFileFormat.ROHAN_FORMAT) {
    // ITA/Rohanフォーマットの場合、labelを使用
    const baseFileName = currentText.label || currentText.id
    return takeNumber > 1 ? `${baseFileName}_take${takeNumber}.wav` : `${baseFileName}.wav`
  } else {
    // プレーンテキストの場合、4桁0パディングの番号を使用
    const paddedNumber = (currentText.index + 1).toString().padStart(4, '0')
    return takeNumber > 1 ? `anycorpus_${paddedNumber}_take${takeNumber}.wav` : `anycorpus_${paddedNumber}.wav`
  }
}

// 次のtake数を計算
const getNextTakeNumber = (textId: string): number => {
  const existingRecordings = recordings.value.filter(r => r.textId === textId)
  return existingRecordings.length + 1
}

// ディレクトリ選択
const selectDirectory = async () => {
  try {
    // ElectronAPIの存在チェック
    if (!window.electronAPI) {
      console.error('ElectronAPI is not available')
      ElMessage.error('Electronとの通信ができません')
      return
    }

    const path = await window.electronAPI.selectDirectory()
    if (path) {
      recordingDirectory.value = path
      await window.electronAPI.updateSettings({ recordingDirectory: path })
      ElMessage.success('保存先を設定しました')
    }
  } catch (error) {
    console.error('Failed to select directory:', error)
    ElMessage.error('ディレクトリの選択に失敗しました')
  }
}

// テキストファイル読み込み
const loadTextFile = async () => {
  try {
    if (!window.electronAPI) {
      console.error('ElectronAPI is not available')
      ElMessage.error('Electronとの通信ができません')
      return
    }

    const result = await window.electronAPI.readTextFile()
    console.log('[RecordingView] window.electronAPI.readTextFile result:', JSON.stringify(result, null, 2)); // ★デバッグログ追加

    if (result) {
      if (result.error) {
        ElMessage.error(`テキストファイルの読み込みに失敗しました: ${result.error}`)
        currentFileFormat.value = null
        return
      }
      
      if (result.texts && result.format) {
        console.log('[RecordingView] Text file loaded. Format from main process:', result.format); // ★デバッグログ追加
        texts.value = result.texts
        currentTextIndex.value = 0
        currentFileFormat.value = result.format
        console.log('[RecordingView] currentFileFormat set to:', currentFileFormat.value); // ★デバッグログ追加
        ElMessage.success(`${texts.value.length}件のテキストを読み込みました (フォーマット: ${currentFileFormat.value})`)      } else if (result.content) { 
        console.log('[RecordingView] Text file loaded as plain text (fallback).'); // ★デバッグログ追加
        const lines = result.content.split('\n').filter((line: string) => line.trim())
        texts.value = lines.map((text: string, index: number) => ({
          id: `text-${index}`,
          index,
          text: text.trim(),
        }))
        currentTextIndex.value = 0
        currentFileFormat.value = TextFileFormat.PLAIN_TEXT
        console.log('[RecordingView] currentFileFormat set to (fallback):', currentFileFormat.value); // ★デバッグログ追加
        ElMessage.success(`${texts.value.length}件のテキストを読み込みました (フォーマット: ${currentFileFormat.value})`)
      } else {
        ElMessage.error('テキストファイルの解析に失敗しました: 不明な形式または空のファイルです。')
        texts.value = []
        currentTextIndex.value = 0
        currentFileFormat.value = null
      }
    }
  } catch (error) {
    console.error('Failed to load text file:', error)
    ElMessage.error('テキストファイルの読み込みに失敗しました')
    texts.value = []
    currentTextIndex.value = 0
    currentFileFormat.value = null
  }
}

// 録音開始
const startRecording = () => {
  if (!recordingDirectory.value) {
    ElMessage.warning('保存先を選択してください')
    return
  }
  if (texts.value.length === 0) {
    ElMessage.warning('テキストファイルを読み込んでください')
    return
  }
  recordingState.value = RecordingState.RECORDING
  // 実際の録音処理はRecordingControlsコンポーネント内で行う
}

// 録音停止
const stopRecording = async (audioData: { arrayBuffer: ArrayBuffer; duration: number }) => {
  try {
    if (!window.electronAPI) {
      console.error('ElectronAPI is not available')
      ElMessage.error('Electronとの通信ができません')
      return
    }

    recordingState.value = RecordingState.PROCESSING
    
    const currentText = texts.value[currentTextIndex.value]
    const currentTextId = currentText.id
    const takeNumber = getNextTakeNumber(currentTextId)
    const fileName = generateFileName(currentText, takeNumber)
    
    // メタデータを準備
    const metadata: AudioFileMetadata = {
      text: currentText.text,
      takeNumber,
      fileName
    }
    
    const result = await window.electronAPI.saveAudioFileWithMetadata(audioData.arrayBuffer, metadata)
    
    if (result.success && result.filePath) {
      const newRecording: Recording = {
        id: `recording-${Date.now()}`,
        textId: currentTextId,
        fileName,
        filePath: result.filePath,
        duration: audioData.duration,
        createdAt: new Date(),
        takeNumber,
        text: currentText.text
      }
      recordings.value.push(newRecording)
      ElMessage.success('録音を保存しました')
    } else {
      ElMessage.error('録音の保存に失敗しました')
    }
    
    recordingState.value = RecordingState.IDLE
  } catch (error) {
    console.error('Failed to save recording:', error)
    ElMessage.error('録音の保存に失敗しました')
    recordingState.value = RecordingState.IDLE
  }
}

// 録音やり直し
const retryRecording = () => {
  recordingState.value = RecordingState.IDLE
}

// テキストナビゲーション
const navigateToText = async (index: number) => {
  try {
    if (index >= 0 && index < texts.value.length) {
      currentTextIndex.value = index
      if (window.electronAPI) {
        await window.electronAPI.updateSettings({ lastTextIndex: index })
      }
    }
  } catch (error) {
    console.error('Failed to update settings:', error)
  }
}

// 録音再生
const playRecording = (recording: Recording) => {
  const audio = new Audio(`file://${recording.filePath}`)
  audio.play()
}

// 録音削除
const deleteRecording = async (recording: Recording) => {
  try {
    if (!window.electronAPI) {
      console.error('ElectronAPI is not available')
      ElMessage.error('Electronとの通信ができません')
      return
    }

    await ElMessageBox.confirm(
      'この録音を削除しますか？',
      '確認',
      {
        confirmButtonText: '削除',
        cancelButtonText: 'キャンセル',
        type: 'warning'
      }
    )
    
    const result = await window.electronAPI.deleteAudioFile(recording.filePath)
    if (result.success) {
      recordings.value = recordings.value.filter(r => r.id !== recording.id)
      ElMessage.success('録音を削除しました')
    } else {
      ElMessage.error('録音の削除に失敗しました')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete recording:', error)
      ElMessage.error('録音の削除に失敗しました')
    }
  }
}

// 時間フォーマット
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// 初期化
onMounted(async () => {
  // ElectronAPIの読み込み完了を待つ
  let retryCount = 0
  const maxRetries = 10
  
  const waitForElectronAPI = async (): Promise<boolean> => {
    if (window.electronAPI) {
      console.log('ElectronAPI is available')
      return true
    }
    
    if (retryCount < maxRetries) {
      retryCount++
      console.log(`Waiting for ElectronAPI... (${retryCount}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, 100))
      return waitForElectronAPI()
    }
    
    return false
  }

  const apiAvailable = await waitForElectronAPI()
  
  if (apiAvailable) {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings.recordingDirectory) {
        recordingDirectory.value = settings.recordingDirectory
      }
      if (settings.lastTextIndex) {
        currentTextIndex.value = settings.lastTextIndex
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  } else {
    console.error('ElectronAPI is not available after maximum retries')
    ElMessage.error('アプリケーションの初期化に失敗しました。アプリを再起動してください。')
  }
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

.settings-header {
  background-color: #f5f7fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e4e7ed;
  height: auto;
}

.settings-area {
  -webkit-app-region: no-drag;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
}

.recordings-list {
  margin-top: 20px;
}

.recording-item {
  width: 100%;
}
</style>