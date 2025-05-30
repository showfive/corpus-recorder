import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  CorpusText, 
  Recording, 
  RecordingState, 
  TextFileFormat, 
  AudioFileMetadata,
  AppSettings,
  AudioQualitySettings 
} from '../../common/types'
import { electronService } from '../services/electronService'
import { recordingService } from '../services/recordingService'

// 型定義をファイル先頭付近に追加
declare global {
  interface Window {
    currentAudio: HTMLAudioElement | null
  }
}

export const useRecordingStore = defineStore('recording', () => {  // === 状態 ===
  const recordingDirectory = ref<string>('')
  const texts = ref<CorpusText[]>([])
  const currentTextIndex = ref<number>(0)
  const recordingState = ref<RecordingState>(RecordingState.IDLE)
  const recordings = ref<Recording[]>([])
  const currentFileFormat = ref<TextFileFormat>(TextFileFormat.PLAIN_TEXT)
  const lastOpenedTextFile = ref<string>('')
  const audioSettings = ref<AudioQualitySettings>({
    autoGainControl: false,
    noiseSuppression: false,
    echoCancellation: false
  })

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
      if (settings.audioQuality) {
        audioSettings.value = settings.audioQuality
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      ElMessage.error('設定の読み込みに失敗しました')
    }
  }  /**
   * 音声品質設定を更新する
   */  const updateAudioSetting = async (key: keyof AudioQualitySettings, value: boolean): Promise<void> => {
    try {
      audioSettings.value = {
        ...audioSettings.value,
        [key]: value
      }
      
      // プレーンなオブジェクトとして送信
      const plainAudioSettings = {
        autoGainControl: audioSettings.value.autoGainControl,
        noiseSuppression: audioSettings.value.noiseSuppression,
        echoCancellation: audioSettings.value.echoCancellation
      }
      
      await electronService.updateSettings({ 
        audioQuality: plainAudioSettings 
      })
      
      // recordingServiceに設定を反映
      recordingService.updateAudioSettings(plainAudioSettings)
      
      ElMessage.success('音声設定を更新しました')
    } catch (error) {
      console.error('Failed to update audio setting:', error)
      ElMessage.error('音声設定の更新に失敗しました')
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
      await recordingService.startRecording()
      recordingState.value = RecordingState.RECORDING
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
    
    try {
      let textId: string
      let fileName: string
      let text: string
      let takeNumber: number
      
      if (currentText) {
        // テキストが選択されている場合の処理
        textId = currentText.id
        takeNumber = getNextTakeNumber(currentText.id)
        fileName = generateFileName(currentText, takeNumber)
        text = currentText.text
      } else {
        // テキストが選択されていない場合の処理
        const timestamp = Date.now()
        textId = `anycorpus_${timestamp}`
        takeNumber = 1
        
        // tmp.wavというファイル名を使用
        fileName = `tmp.wav`
        text = '音声録音（テキスト未選択）'
      }
      
      const metadata: AudioFileMetadata = {
        text,
        takeNumber,
        fileName
      }

      const result = await electronService.saveAudioFileWithMetadata(data.arrayBuffer, metadata)
      
      if (result.success && result.filePath) {
        const recording: Recording = {
          id: `${textId}_${takeNumber}`,
          textId,
          fileName,
          filePath: result.filePath,
          duration: data.duration,
          createdAt: new Date(),
          takeNumber,
          text
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
  const retryRecording = async (): Promise<void> => {
    try {
      const currentText = currentTextObject.value
      if (!currentText) {
        ElMessage.warning('対象のテキストが選択されていません')
        return
      }

      // 現在録音中の場合は何もしない
      if (recordingState.value === RecordingState.RECORDING) {
        return
      }

      // 現在のテキストに関連する録音がある場合はサイレントに削除
      const currentTextRecordings = recordings.value.filter(r => r.textId === currentText.id)
      if (currentTextRecordings.length > 0) {
        // 現在のテキストの全録音を削除（サイレント）
        for (const recording of currentTextRecordings) {
          // 再生中の音声を停止
          if (window.currentAudio && window.currentAudio.src.includes(recording.filePath)) {
            window.currentAudio.pause()
            window.currentAudio.currentTime = 0
            window.currentAudio = null
          }

          // ファイルを削除
          const result = await electronService.deleteAudioFile(recording.filePath)
          if (result.success) {
            // メモリ上のリストからも削除
            const index = recordings.value.findIndex(r => r.id === recording.id)
            if (index > -1) {
              recordings.value.splice(index, 1)
            }
          } else {
            console.warn(`Failed to delete recording file: ${recording.filePath}`, result.error)
            // ファイル削除に失敗してもメモリ上のリストからは削除（ファイルが既に存在しない可能性）
            const index = recordings.value.findIndex(r => r.id === recording.id)
            if (index > -1) {
              recordings.value.splice(index, 1)
            }
          }
        }
      }

      // 録音状態をリセットしてから録音開始
      recordingState.value = RecordingState.IDLE
      recordingService.retryRecording()
      
      // 即座に録音を開始
      await startRecording()
      
    } catch (error) {
      console.error('Failed to retry recording:', error)
      ElMessage.error('やり直し処理に失敗しました')
      
      // エラーが発生しても状態はリセット
      recordingState.value = RecordingState.IDLE
      recordingService.retryRecording()
    }
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
      // 削除対象の音声が再生中の場合は停止
      if (window.currentAudio && window.currentAudio.src.includes(recording.filePath)) {
        window.currentAudio.pause()
        window.currentAudio.currentTime = 0
        window.currentAudio = null
      }

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
  }
  /**
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
  const playRecording = async (recording: Recording): Promise<void> => {
    try {
      // 既存のAudioオブジェクトをクリーンアップ
      if (window.currentAudio) {
        window.currentAudio.pause()
        window.currentAudio.currentTime = 0
        window.currentAudio = null
      }

      // キャッシュ無効化のためタイムスタンプを付加
      const timestamp = Date.now()
      const audioUrl = `file://${recording.filePath}?t=${timestamp}`
      
      const audio = new Audio(audioUrl)
      
      // グローバルな参照を保持して管理
      window.currentAudio = audio
      
      // エラーハンドリング
      audio.onerror = () => {
        ElMessage.error('音声ファイルが見つかりません。削除されている可能性があります。')
        window.currentAudio = null
        
        // メモリ上のrecordingsリストからも削除
        const index = recordings.value.findIndex(r => r.id === recording.id)
        if (index > -1) {
          recordings.value.splice(index, 1)
        }
      }
      
      // 再生完了時のクリーンアップ
      audio.onended = () => {
        window.currentAudio = null
      }
      
      await audio.play()
      ElMessage.success('再生を開始しました')
      
    } catch (error) {
      console.error('Failed to play recording:', error)
      ElMessage.error('音声の再生に失敗しました')
      
      // エラー時もメモリ上のリストから削除
      const index = recordings.value.findIndex(r => r.id === recording.id)
      if (index > -1) {
        recordings.value.splice(index, 1)
      }
    }
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
    // 既存のAudioオブジェクトをクリーンアップ
    if (window.currentAudio) {
      window.currentAudio.pause()
      window.currentAudio.currentTime = 0
      window.currentAudio = null
    }

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
    audioSettings,
    
    // 音声設定のゲッター
    autoGainControl: computed(() => audioSettings.value.autoGainControl),
    noiseSuppression: computed(() => audioSettings.value.noiseSuppression),
    echoCancellation: computed(() => audioSettings.value.echoCancellation),
    
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
    initialize,
    
    // 音声設定のアクション
    updateAudioSetting,
    updateAutoGainControl: (value: boolean) => updateAudioSetting('autoGainControl', value),
    updateNoiseSuppression: (value: boolean) => updateAudioSetting('noiseSuppression', value),
    updateEchoCancellation: (value: boolean) => updateAudioSetting('echoCancellation', value)
  }
})
