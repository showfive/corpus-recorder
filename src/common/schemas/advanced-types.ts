import { z } from 'zod'
import { 
  AppConfig, 
  AudioConfig, 
  UIConfig, 
  StorageConfig, 
  DevelopmentConfig,
  AudioFileMetadata 
} from './index'

// ===========================================
// 高度な型推論システム
// ===========================================

/**
 * ドット記法のパス型を生成する高度な型推論
 */
export type DeepKeys<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}` | `${K}.${DeepKeys<T[K]>}`
          : `${K}`
        : never
    }[keyof T]
  : never

/**
 * アプリケーション設定のすべての有効なパス
 */
export type AppConfigPath = DeepKeys<AppConfig>

/**
 * パスから値の型を推論する条件付き型
 */
export type PathValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : never

/**
 * 型安全な設定パス検証
 */
export type ValidConfigPath<P extends string> = P extends AppConfigPath ? P : never

/**
 * IPC通信チャンネル名のテンプレートリテラル型
 */
export type IPCChannelTemplate = 
  | 'select-directory'
  | 'save-audio-file'
  | 'save-audio-file-with-metadata'
  | 'delete-audio-file'
  | 'read-text-file'
  | 'get-settings'
  | 'update-settings'
  | 'app-ready'
  | 'app-error'
  | 'log-message'
  | 'get-logs'
  | 'clear-logs'

/**
 * IPC通信ペイロードの型マッピング
 */
export interface IPCPayloadMap {
  'select-directory': { request: void; response: string | null }
  'save-audio-file': { 
    request: [ArrayBuffer, string]; 
    response: { success: boolean; filePath?: string; error?: string }
  }
  'save-audio-file-with-metadata': { 
    request: [ArrayBuffer, AudioFileMetadata]; 
    response: { success: boolean; filePath?: string; error?: string }
  }
  'delete-audio-file': { 
    request: string; 
    response: { success: boolean; error?: string }
  }
  'read-text-file': { 
    request: void; 
    response: any | null 
  }
  'get-settings': { 
    request: void; 
    response: Partial<any>
  }
  'update-settings': { 
    request: Partial<any>; 
    response: Partial<any>
  }
  'app-ready': { request: void; response: void }
  'app-error': { request: string; response: void }
  'log-message': { request: any; response: void }
  'get-logs': { request: void; response: any[] }
  'clear-logs': { request: void; response: void }
}

/**
 * 型安全なIPC通信関数の型定義
 */
export type IPCInvoker = <T extends IPCChannelTemplate>(
  channel: T,
  ...args: IPCPayloadMap[T]['request'] extends void 
    ? [] 
    : [IPCPayloadMap[T]['request']]
) => Promise<IPCPayloadMap[T]['response']>

// ===========================================
// カスタム型ガード
// ===========================================

/**
 * 型ガードファクトリ
 */
export function createTypeGuard<T>(schema: z.ZodSchema<T>) {
  return (value: unknown): value is T => {
    const result = schema.safeParse(value)
    return result.success
  }
}

/**
 * 設定パスの型ガード
 */
export const isValidConfigPath = (path: unknown): path is AppConfigPath => {
  if (typeof path !== 'string') {
    return false
  }
  
  const validPaths: string[] = [
    'audio',
    'audio.quality',
    'audio.quality.autoGainControl',
    'audio.quality.noiseSuppression',
    'audio.quality.echoCancellation',
    'audio.quality.sampleRate',
    'audio.quality.bitDepth',
    'audio.deviceId',
    'audio.bufferSize',
    'audio.processingMode',
    'ui',
    'ui.theme',
    'ui.language',
    'ui.fontSize',
    'ui.waveform',
    'ui.waveform.color',
    'ui.waveform.backgroundColor',
    'ui.waveform.smoothing',
    'ui.waveform.showGrid',
    'storage',
    'storage.recordingDirectory',
    'storage.lastOpenedTextFile',
    'storage.lastTextIndex',
    'storage.autoSave',
    'storage.autoSave.enabled',
    'storage.autoSave.interval',
    'storage.backup',
    'storage.backup.enabled',
    'storage.backup.maxCount',
    'storage.backup.location',
    'development',
    'development.enableWebWorkers',
    'development.enableLogging',
    'development.logLevel',
    'development.enablePerformanceMonitoring',
    'development.enableDebugMode',
    'development.memoryMonitoring',
    'development.memoryMonitoring.enabled',
    'development.memoryMonitoring.interval',
    'development.memoryMonitoring.threshold',
    'version',
    'lastUpdated'
  ]
  
  return validPaths.includes(path)
}

/**
 * IPC通信チャンネルの型ガード
 */
export const isValidIPCChannel = (channel: string): channel is IPCChannelTemplate => {
  const validChannels: IPCChannelTemplate[] = [
    'select-directory',
    'save-audio-file',
    'save-audio-file-with-metadata',
    'delete-audio-file',
    'read-text-file',
    'get-settings',
    'update-settings',
    'app-ready',
    'app-error',
    'log-message',
    'get-logs',
    'clear-logs'
  ]
  
  return validChannels.includes(channel as IPCChannelTemplate)
}

// ===========================================
// 条件付き型ヘルパー
// ===========================================

/**
 * オプショナルなキーのみを抽出
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * 必須キーのみを抽出
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

/**
 * 深い部分的な型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 深い必須型
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * 型から特定のキーを除外
 */
export type OmitDeep<T, K extends string> = {
  [P in keyof T as P extends K ? never : P]: T[P] extends object 
    ? OmitDeep<T[P], K>
    : T[P]
}

/**
 * 型に特定のキーのみを含める
 */
export type PickDeep<T, K extends string> = {
  [P in keyof T as P extends K ? P : never]: T[P] extends object 
    ? PickDeep<T[P], K>
    : T[P]
}

// ===========================================
// ブランド型（名目的型付け）
// ===========================================

/**
 * ブランド型ヘルパー
 */
export type Brand<T, B> = T & { __brand: B }

/**
 * ファイルパス型（文字列だが意味的に区別）
 */
export type FilePath = Brand<string, 'FilePath'>

/**
 * ディレクトリパス型
 */
export type DirectoryPath = Brand<string, 'DirectoryPath'>

/**
 * 設定キー型
 */
export type ConfigKey = Brand<string, 'ConfigKey'>

/**
 * IPC通信ID型
 */
export type IPCRequestId = Brand<string, 'IPCRequestId'>

// ===========================================
// 型レベル計算
// ===========================================

/**
 * 文字列の長さを型レベルで計算
 */
export type StringLength<S extends string> = S extends `${string}${infer Rest}`
  ? 1 extends 0
    ? never
    : StringLength<Rest> extends number
    ? StringLength<Rest>
    : never
  : 0

/**
 * 配列の長さを型レベルで計算
 */
export type ArrayLength<T extends readonly unknown[]> = T['length']

/**
 * オブジェクトのキー数を型レベルで計算
 */
export type ObjectKeyCount<T> = ArrayLength<(keyof T)[]>

// ===========================================
// 高度なバリデーション型
// ===========================================

/**
 * 実行時型検証の結果型
 */
export interface TypeValidationResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly errors?: TypeValidationError[]
  readonly warnings?: TypeValidationWarning[]
}

/**
 * 型検証エラー
 */
export interface TypeValidationError {
  readonly path: string
  readonly expected: string
  readonly received: string
  readonly code: string
  readonly message: string
}

/**
 * 型検証警告
 */
export interface TypeValidationWarning {
  readonly path: string
  readonly message: string
  readonly suggestion?: string
}

/**
 * カスタムバリデーターの型
 */
export type CustomValidator<T> = (value: unknown) => TypeValidationResult<T>

/**
 * 非同期バリデーターの型
 */
export type AsyncValidator<T> = (value: unknown) => Promise<TypeValidationResult<T>>

// ===========================================
// 型レベルユーティリティ
// ===========================================

/**
 * 関数の引数型を抽出
 */
export type FunctionArgs<T> = T extends (...args: infer A) => any ? A : never

/**
 * 関数の戻り値型を抽出
 */
export type FunctionReturn<T> = T extends (...args: any[]) => infer R ? R : never

/**
 * Promiseから値の型を抽出
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * 配列から要素の型を抽出
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

/**
 * 条件付きで型を適用
 */
export type Conditional<Test, TrueType, FalseType> = Test extends true 
  ? TrueType 
  : FalseType 