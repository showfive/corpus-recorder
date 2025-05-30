/**
 * IPC通信チャンネル名の一元管理
 * すべてのIPCチャンネル名をここで定義してタイプミスを防ぐ
 */
export const IPC_CHANNELS = {
  // ファイル操作関連
  SELECT_DIRECTORY: 'select-directory',
  READ_TEXT_FILE: 'read-text-file',
  
  // 音声ファイル操作関連
  SAVE_AUDIO_FILE: 'save-audio-file',
  SAVE_AUDIO_FILE_WITH_METADATA: 'save-audio-file-with-metadata',
  DELETE_AUDIO_FILE: 'delete-audio-file',
  
  // 設定関連
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  
  // アプリケーション状態
  APP_READY: 'app-ready',
  APP_ERROR: 'app-error',
  
  // ログ関連
  LOG_MESSAGE: 'log-message',
  GET_LOGS: 'get-logs',
  CLEAR_LOGS: 'clear-logs'
} as const

// TypeScriptでの型安全性確保
export type IPCChannelName = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS] 