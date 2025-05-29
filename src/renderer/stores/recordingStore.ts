import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  CorpusText, 
  Recording, 
  RecordingState, 
  TextFileFormat, 
  AudioFileMetadata,
  AppSettings 
} from '../../common/types'
import { electronService } from '../services/electronService'
import { recordingService } from '../services/recordingService'

export const useRecordingStore = defineStore('recording', () => {
  // === 状態 ===
  const recordingDirectory = ref<string>('')
  const texts = ref<CorpusText[]>([])
  const currentTextIndex = ref<number>(0)
  const recordingState = ref<RecordingState>(RecordingState.IDLE)
  const recordings = ref<Recording[]>([])
  const currentFileFormat = ref<TextFileFormat>(TextFileFormat.PLAIN_TEXT)
  const lastOpenedTextFile = ref<string>('')

  // === ゲッター ===
  const currentTextObject = computed((): CorpusText | null => {
    return texts.value[currentTextIndex.value] || null
  })

  const currentRecordings = computed((): Recording[] => {
    const currentText = currentTextObject.value
    if (!currentText) return []
    return recordings.value.filter(r => r.textId === currentText.id)
  })

  const totalTexts = computed((): number => {
    return texts.value.length
  })

  // === アクション ===

  /**
   * 設定を読み込む
   */
  const loadSettings = async (): Promise<void> => {
    try {
      const settings = await electronService.getSettings()
      if (settings.recordingDirectory) {
        recordingDirectory.value = settings.recordingDirectory
      }
      if (settings.lastTextIndex !== undefined) {
        currentTextIndex.value = settings.lastTextIndex
      }
      if (settings.lastOpenedTextFile) {
        lastOpenedTextFile.value = settings.lastOpenedTextFile
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      ElMessage.error('設定の読み込みに失敗しました')
    }
  }

  /**
   * ディレクトリを選択する
   */
  const selectDirectory = async (): Promise<void> => {
    try {
      const path = await electronService.selectDirectory()
      if (path) {
        recordingDirectory.value = path
        await electronService.updateSettings({ recordingDirectory: path })
        ElMessage.success('保存先を設定しました')
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
      ElMessage.error('ディレクトリの選択に失敗しました')
    }
  }

  /**
   * テキストファイルを読み込む
   */
  const loadTextFile = async (): Promise<void> => {
    try {
      const result = await electronService.readTextFile()
      if (result) {
        if (result.error) {
          ElMessage.error(result.error)
          return
        }

        texts.value = result.texts
        currentFileFormat.value = result.format
        lastOpenedTextFile.value = result.filePath
        currentTextIndex.value = 0
        
        // 録音データをクリア
        recordings.value = []
        
        ElMessage.success(`${result.texts.length}件のテキストを読み込みました`)
        
        // 設定を保存
        await electronService.updateSettings({ 
          lastOpenedTextFile: result.filePath,
          lastTextIndex: 0
        })
      }
    } catch (error) {
      console.error('Failed to load text file:', error)
      ElMessage.error('テキストファイルの読み込みに失敗しました')
    }
  }
  /**
   * 録音を開始する
   */
  const startRecording = async (): Promise<void> => {
    if (recordingState.value !== RecordingState.IDLE) {
      return
    }

    try {
      recordingState.value = RecordingState.RECORDING
      await recordingService.startRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
      recordingState.value = RecordingState.IDLE
      ElMessage.error('録音の開始に失敗しました')
    }
  }
  /**
   * 録音を停止する
   */
  const stopRecording = (): void => {
    if (recordingState.value !== RecordingState.RECORDING) {
      return
    }

    recordingState.value = RecordingState.PROCESSING
    recordingService.stopRecording()
  }
  /**
   * 録音を完了する（録音データを保存）
   */
  const completeRecording = async (data: { arrayBuffer: ArrayBuffer; duration: number }): Promise<void> => {
    const currentText = currentTextObject.value
    if (!currentText) {
      ElMessage.error('録音対象のテキストが選択されていません')
      recordingState.value = RecordingState.IDLE
      recordingService.resetState()
      return
    }    try {
      const takeNumber = getNextTakeNumber(currentText.id)
      const fileName = generateFileName(currentText, takeNumber)
      
      const metadata: AudioFileMetadata = {
        text: currentText.text,
        takeNumber,
        fileName
      }

      const result = await electronService.saveAudioFileWithMetadata(data.arrayBuffer, metadata)
      
      if (result.success && result.filePath) {
        const recording: Recording = {
          id: `${currentText.id}_${takeNumber}`,
          textId: currentText.id,
          fileName,
          filePath: result.filePath,
          duration: data.duration,
          createdAt: new Date(),
          takeNumber,
          text: currentText.text
        }
        
        recordings.value.push(recording)
        ElMessage.success('録音を保存しました')
      } else {
        throw new Error(result.error || '保存に失敗しました')
      }
    } catch (error) {
      console.error('Failed to save recording:', error)
      ElMessage.error('録音の保存に失敗しました')
    } finally {
      recordingState.value = RecordingState.IDLE
      recordingService.resetState()
    }
  }
  /**
   * 録音をやり直す
   */
  const retryRecording = (): void => {
    recordingState.value = RecordingState.IDLE
    recordingService.retryRecording()
  }

  /**
   * 指定されたテキストインデックスに移動
   */
  const navigateToText = async (index: number): Promise<void> => {
    if (index >= 0 && index < texts.value.length) {
      currentTextIndex.value = index
      
      // 設定を保存
      try {
        await electronService.updateSettings({ lastTextIndex: index })
      } catch (error) {
        console.error('Failed to save text index:', error)
      }
    }
  }

  /**
   * 録音ファイルを削除する
   */
  const deleteRecording = async (recording: Recording): Promise<void> => {
    try {
      const result = await electronService.deleteAudioFile(recording.filePath)
      
      if (result.success) {
        const index = recordings.value.findIndex(r => r.id === recording.id)
        if (index > -1) {
          recordings.value.splice(index, 1)
          ElMessage.success('録音を削除しました')
        }
      } else {
        throw new Error(result.error || '削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete recording:', error)
      ElMessage.error('録音の削除に失敗しました')
    }
  }  /**
   * 次のテイク番号を取得
   */
  const getNextTakeNumber = (textId: string): number => {
    const existingRecordings = recordings.value.filter(r => r.textId === textId)
    return existingRecordings.length + 1
  }
  /**
   * ファイル名を生成する
   */
  const generateFileName = (text: CorpusText, takeNumber: number): string => {
    // ラベルが存在する場合はそれを使用
    if (text.label) {
      // テイク番号が1の場合は省略、2以上の場合は_take{number}を付加
      if (takeNumber === 1) {
        return `${text.label}.wav`
      } else {
        return `${text.label}_take${takeNumber}.wav`
      }
    }
    
    // フォーマットに応じたデフォルト名を生成
    const format = currentFileFormat.value
    const paddedIndex = text.index.toString().padStart(4, '0')
    
    let baseName: string
    switch (format) {
      case TextFileFormat.ROHAN_FORMAT:
        baseName = `ROHAN4600_${paddedIndex}`
        break
      case TextFileFormat.ITA_FORMAT:
        baseName = `ITA_${paddedIndex}`
        break
      case TextFileFormat.PLAIN_TEXT:
      default:
        baseName = `anycorpus_${paddedIndex}`
        break
    }
    
    // テイク番号が1の場合は省略、2以上の場合は_take{number}を付加
    if (takeNumber === 1) {
      return `${baseName}.wav`
    } else {
      return `${baseName}_take${takeNumber}.wav`
    }
  }

  /**
   * 録音の再生
   */
  const playRecording = (recording: Recording): void => {
    const audio = new Audio(`file://${recording.filePath}`)
    audio.play()
  }

  /**
   * 時間のフォーマット（秒をMM:SSに変換）
   */
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // === 初期化 ===
    /**
   * ストアを初期化する
   */
  const initialize = async (): Promise<void> => {
    // recordingServiceのイベントハンドラーを設定
    recordingService.onRecordingComplete = async (data) => {
      await completeRecording(data)
    }
      recordingService.onRecordingError = (error) => {
      ElMessage.error(error)
      recordingState.value = RecordingState.IDLE
      recordingService.resetState()
    }
      recordingService.onRecordingStart = () => {
      // 録音開始時は既にstartRecordingで状態を更新済み
      // 波形描画の開始も通知
    }
    
    recordingService.onRecordingRetry = () => {
      recordingState.value = RecordingState.IDLE
    }

    // 設定を読み込み
    await loadSettings()
  }

  return {
    // 状態
    recordingDirectory,
    texts,
    currentTextIndex,
    recordingState,
    recordings,
    currentFileFormat,
    lastOpenedTextFile,
    
    // ゲッター
    currentTextObject,
    currentRecordings,
    totalTexts,
      // アクション
    loadSettings,
    selectDirectory,
    loadTextFile,
    startRecording,
    stopRecording,
    completeRecording,
    retryRecording,
    navigateToText,
    deleteRecording,
    playRecording,
    formatDuration,
    getNextTakeNumber,
    initialize
  }
})
