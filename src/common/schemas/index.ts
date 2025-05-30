import { z } from 'zod'

// ===========================================
// 基本的なバリデーションスキーマ
// ===========================================

/**
 * 音声品質設定のスキーマ
 */
export const AudioQualitySettingsSchema = z.object({
  autoGainControl: z.boolean().default(false),
  noiseSuppression: z.boolean().default(false),
  echoCancellation: z.boolean().default(false),
  sampleRate: z.number().positive().optional(),
  bitDepth: z.number().positive().optional(),
})

/**
 * 音声設定のスキーマ
 */
export const AudioConfigSchema = z.object({
  quality: AudioQualitySettingsSchema.default({}),
  // 将来的な音声関連設定
  deviceId: z.string().optional(),
  bufferSize: z.number().positive().default(4096),
  processingMode: z.enum(['high', 'standard', 'low']).default('standard'),
})

/**
 * UI設定のスキーマ
 */
export const UIConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  language: z.enum(['ja', 'en']).default('ja'),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
  // 波形表示設定
  waveform: z.object({
    color: z.string().default('#4F46E5'),
    backgroundColor: z.string().default('#F8FAFC'),
    smoothing: z.boolean().default(true),
    showGrid: z.boolean().default(false),
  }).default({}),
})

/**
 * ストレージ設定のスキーマ
 */
export const StorageConfigSchema = z.object({
  recordingDirectory: z.string().min(1),
  lastOpenedTextFile: z.string().optional(),
  lastTextIndex: z.number().min(0).default(0),
  // 自動保存設定
  autoSave: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().min(10).max(300).default(30), // 秒
  }).default({}),
  // バックアップ設定
  backup: z.object({
    enabled: z.boolean().default(false),
    maxCount: z.number().min(1).max(50).default(5),
    location: z.string().optional(),
  }).default({}),
})

/**
 * 開発設定のスキーマ
 */
export const DevelopmentConfigSchema = z.object({
  enableWebWorkers: z.boolean().default(true),
  enableLogging: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  enablePerformanceMonitoring: z.boolean().default(false),
  enableDebugMode: z.boolean().default(false),
  // メモリ監視設定
  memoryMonitoring: z.object({
    enabled: z.boolean().default(false),
    interval: z.number().min(1000).default(5000), // ミリ秒
    threshold: z.number().min(50).max(1000).default(200), // MB
  }).default({}),
})

/**
 * 統一アプリケーション設定のスキーマ
 */
export const AppConfigSchema = z.object({
  audio: AudioConfigSchema.default({}),
  ui: UIConfigSchema.default({}),
  storage: StorageConfigSchema,
  development: DevelopmentConfigSchema.default({}),
  // メタデータ
  version: z.string().default('1.0.0'),
  lastUpdated: z.string().optional(),
})

// ===========================================
// IPC通信用のスキーマ
// ===========================================

/**
 * 音声ファイルメタデータのスキーマ
 */
export const AudioFileMetadataSchema = z.object({
  text: z.string().min(1, 'テキストは必須です'),
  takeNumber: z.number().positive('テイク番号は1以上である必要があります'),
  fileName: z.string().regex(
    /^[^<>:"/\\|?*]+$/,
    'ファイル名に無効な文字が含まれています'
  ),
  duration: z.number().positive().optional(),
  quality: z.object({
    sampleRate: z.number().positive(),
    channels: z.number().positive(),
    bitDepth: z.number().positive(),
  }).optional(),
  // 将来的な拡張
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

/**
 * テキストファイル読み込み結果のスキーマ
 */
export const TextFileReadResultSchema = z.object({
  success: z.boolean(),
  format: z.enum(['plain-text', 'ita-format', 'rohan-format']),
  content: z.array(z.object({
    id: z.string(),
    index: z.number(),
    text: z.string(),
    label: z.string().optional(),
    reading: z.string().optional(),
    rubyText: z.array(z.union([
      z.string(),
      z.object({
        base: z.string(),
        ruby: z.string(),
      })
    ])).optional(),
  })),
  filePath: z.string(),
  error: z.string().optional(),
})

// ===========================================
// 型推論
// ===========================================

export type AudioQualitySettings = z.infer<typeof AudioQualitySettingsSchema>
export type AudioConfig = z.infer<typeof AudioConfigSchema>
export type UIConfig = z.infer<typeof UIConfigSchema>
export type StorageConfig = z.infer<typeof StorageConfigSchema>
export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>
export type AppConfig = z.infer<typeof AppConfigSchema>

export type AudioFileMetadata = z.infer<typeof AudioFileMetadataSchema>
export type TextFileReadResult = z.infer<typeof TextFileReadResultSchema>

// ===========================================
// デフォルト設定値
// ===========================================

/**
 * デフォルトの統一設定
 */
export const defaultAppConfig: AppConfig = {
  audio: {
    quality: {
      autoGainControl: false,
      noiseSuppression: false,
      echoCancellation: false,
    },
    bufferSize: 4096,
    processingMode: 'standard',
  },
  ui: {
    theme: 'light',
    language: 'ja',
    fontSize: 'medium',
    waveform: {
      color: '#4F46E5',
      backgroundColor: '#F8FAFC',
      smoothing: true,
      showGrid: false,
    },
  },
  storage: {
    recordingDirectory: '',
    lastTextIndex: 0,
    autoSave: {
      enabled: true,
      interval: 30,
    },
    backup: {
      enabled: false,
      maxCount: 5,
    },
  },
  development: {
    enableWebWorkers: true,
    enableLogging: true,
    logLevel: 'info',
    enablePerformanceMonitoring: false,
    enableDebugMode: false,
    memoryMonitoring: {
      enabled: false,
      interval: 5000,
      threshold: 200,
    },
  },
  version: '1.0.0',
}

// ===========================================
// 検証ヘルパー関数
// ===========================================

/**
 * 設定の部分的な更新を検証する
 */
export function validatePartialConfig(partial: unknown): { success: boolean; data?: Partial<AppConfig>; error?: string } {
  try {
    // 個別にパース可能なものを確認
    if (typeof partial !== 'object' || partial === null) {
      return { success: false, error: 'Configuration must be an object' }
    }
    
    const result = AppConfigSchema.partial().deepPartial().safeParse(partial)
    
    if (result.success) {
      return { success: true, data: result.data as Partial<AppConfig> }
    } else {
      return { 
        success: false, 
        error: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}

/**
 * 設定パスの検証（ドット記法対応）
 */
export function validateConfigPath(path: string): boolean {
  const validPaths = [
    'audio.quality.autoGainControl',
    'audio.quality.noiseSuppression', 
    'audio.quality.echoCancellation',
    'audio.quality.sampleRate',
    'audio.quality.bitDepth',
    'audio.deviceId',
    'audio.bufferSize',
    'audio.processingMode',
    'ui.theme',
    'ui.language',
    'ui.fontSize',
    'ui.waveform.color',
    'ui.waveform.backgroundColor',
    'ui.waveform.smoothing',
    'ui.waveform.showGrid',
    'storage.recordingDirectory',
    'storage.lastOpenedTextFile',
    'storage.lastTextIndex',
    'storage.autoSave.enabled',
    'storage.autoSave.interval',
    'storage.backup.enabled',
    'storage.backup.maxCount',
    'storage.backup.location',
    'development.enableWebWorkers',
    'development.enableLogging',
    'development.logLevel',
    'development.enablePerformanceMonitoring',
    'development.enableDebugMode',
    'development.memoryMonitoring.enabled',
    'development.memoryMonitoring.interval',
    'development.memoryMonitoring.threshold',
  ]
  
  return validPaths.includes(path)
} 