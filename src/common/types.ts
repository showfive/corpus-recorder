// 音声録音に関する型定義
export interface Recording {
  id: string
  textId: string
  fileName: string
  filePath: string
  duration: number
  createdAt: Date
  takeNumber: number // take数を追加
  text: string // 読み上げ文章を追加
}

// コーパステキストに関する型定義
export type RubySegment = string | { base: string; ruby: string };

export interface CorpusText {
  id: string
  index: number
  text: string // プレーンテキスト、または読み仮名注釈付きの原文
  label?: string // コーパス文ラベル (ITA/Rohanフォーマット用)
  reading?: string // カタカナの読み (ITA/Rohanフォーマット用)
  rubyText?: RubySegment[]; // ルビ情報を含む解析済みテキスト (Rohanフォーマット用)
  recordings?: Recording[]
}

// テキストファイル読み込み結果
export interface TextFileReadResult {
  filePath: string
  content: string
  texts: CorpusText[]
  format: TextFileFormat // string から TextFileFormat に変更
  error?: string // error プロパティを追加
}

// アプリケーション設定に関する型定義
export interface AppSettings {
  recordingDirectory: string
  lastOpenedTextFile?: string
  lastTextIndex?: number
}

// 音声ファイル保存時のメタデータ
export interface AudioFileMetadata {
  text: string
  takeNumber: number
  fileName: string
}

// IPC通信のイベント名を定義
export const IPC_CHANNELS = {
  // ファイル操作
  SELECT_DIRECTORY: 'select-directory',
  SAVE_AUDIO_FILE: 'save-audio-file',
  SAVE_AUDIO_FILE_WITH_METADATA: 'save-audio-file-with-metadata',
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

// サポートするテキストファイルのフォーマット
export enum TextFileFormat {
  PLAIN_TEXT = 'plain-text',
  ITA_FORMAT = 'ita-format', // ITAコーパス形式
  ROHAN_FORMAT = 'rohan-format' // Rohanコーパス形式
}