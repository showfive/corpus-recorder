// 音声録音に関する型定義
export interface Recording {
  id: string
  textId: string
  fileName: string
  filePath: string
  duration: number
  createdAt: Date
}

// コーパステキストに関する型定義
export interface CorpusText {
  id: string
  index: number
  text: string
  recordings?: Recording[]
}

// テキストファイル読み込み結果
export interface TextFileReadResult {
  filePath: string
  content: string
  texts: CorpusText[]
  format: string
}

// アプリケーション設定に関する型定義
export interface AppSettings {
  recordingDirectory: string
  lastOpenedTextFile?: string
  lastTextIndex?: number
}

// IPC通信のイベント名を定義
export const IPC_CHANNELS = {
  // ファイル操作
  SELECT_DIRECTORY: 'select-directory',
  SAVE_AUDIO_FILE: 'save-audio-file',
  DELETE_AUDIO_FILE: 'delete-audio-file',
  READ_TEXT_FILE: 'read-text-file',
  
  // 設定操作
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  
  // アプリケーション制御
  APP_READY: 'app-ready'
} as const

// 音声録音の状態
export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing'
}