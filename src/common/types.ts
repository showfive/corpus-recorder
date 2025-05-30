// ===========================================
// 【統一設定システム移行済み - フェーズ2完了】
// 
// 以下の型は新しい統一設定システムに移行されました：
// ✅ AudioQualitySettings → src/common/schemas/index.ts (Zodスキーマ付き)
// ✅ AppSettings → レガシー互換性のため残存、統一設定はAppConfig
// ✅ AudioFileMetadata → src/common/schemas/index.ts (検証機能付き)
// ✅ IPC通信型 → src/common/schemas/advanced-types.ts (型安全性強化)
// ✅ 高度な型推論 → src/common/schemas/advanced-types.ts (テンプレートリテラル型)
// ✅ カスタムバリデーター → src/common/validation/custom-validators.ts
// ✅ 型安全IPC通信 → src/common/ipc/type-safe-ipc.ts
// 
// 【新しい統一設定システムの使用方法】:
// import { AppConfig, AudioConfig, UIConfig } from '../common/schemas'
// import { configManager } from '../common/config'
// import { typeSafeIPC, validateIPCRequest } from '../common/ipc/type-safe-ipc'
// import { customValidators } from '../common/validation/custom-validators'
// 
// 【高度な型推論の使用例】:
// import { AppConfigPath, PathValue, DeepKeys } from '../common/schemas/advanced-types'
// function getTypedConfig<P extends AppConfigPath>(path: P): PathValue<AppConfig, P> {
//   return configManager.get<PathValue<AppConfig, P>>(path)
// }
// 
// 【型安全IPC通信の使用例】:
// const request = validateIPCRequest('save-audio-file', [arrayBuffer, fileName])
// if (request.success) {
//   // 型安全に処理
// }
// ===========================================

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

// ===========================================
// 【レガシー型定義】- 既存コードとの互換性のため残存
// 
// ⚠️ 新しいコードでは以下を使用してください：
// - src/common/schemas の統一型システム  
// - src/common/schemas/advanced-types.ts の高度な型推論
// - src/common/validation/custom-validators.ts のカスタムバリデーター
// - src/common/ipc/type-safe-ipc.ts の型安全IPC通信
// ===========================================

// 音声品質設定（レガシー）
export interface AudioQualitySettings {
  autoGainControl: boolean
  noiseSuppression: boolean
  echoCancellation: boolean
  sampleRate?: number
  bitDepth?: number
}

// アプリケーション設定（レガシー）
export interface AppSettings {
  recordingDirectory: string
  lastOpenedTextFile?: string
  lastTextIndex?: number
  audioQuality?: AudioQualitySettings
}

// 音声ファイル保存時のメタデータ（レガシー）
export interface AudioFileMetadata {
  text: string
  takeNumber: number
  fileName: string
}

// ===========================================
// IPC通信とアプリケーション状態
// ===========================================

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