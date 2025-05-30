import { z } from 'zod'
import { createLogger } from '../logger'
import { 
  IPCChannelTemplate,
  IPCPayloadMap,
  TypeValidationResult,
  isValidIPCChannel
} from '../schemas/advanced-types'
import { 
  AppConfigSchema,
  AudioFileMetadataSchema,
  TextFileReadResultSchema
} from '../schemas'
import { validationService } from '../validation'

const logger = createLogger('TypeSafeIPC')

// ===========================================
// IPC通信用Zodスキーマ
// ===========================================

/**
 * IPC通信用のリクエスト/レスポンススキーマ定義
 */
export const IPCSchemas = {
  'select-directory': {
    request: z.void(),
    response: z.string().nullable()
  },
  'save-audio-file': {
    request: z.tuple([
      z.instanceof(ArrayBuffer),
      z.string().min(1)
    ]),
    response: z.object({
      success: z.boolean(),
      filePath: z.string().optional(),
      error: z.string().optional()
    })
  },
  'save-audio-file-with-metadata': {
    request: z.tuple([
      z.instanceof(ArrayBuffer),
      AudioFileMetadataSchema
    ]),
    response: z.object({
      success: z.boolean(),
      filePath: z.string().optional(),
      error: z.string().optional()
    })
  },
  'delete-audio-file': {
    request: z.string().min(1),
    response: z.object({
      success: z.boolean(),
      error: z.string().optional()
    })
  },
  'read-text-file': {
    request: z.void(),
    response: TextFileReadResultSchema.nullable()
  },
  'get-settings': {
    request: z.void(),
    response: AppConfigSchema.partial()
  },
  'update-settings': {
    request: AppConfigSchema.partial(),
    response: AppConfigSchema.partial()
  },
  'app-ready': {
    request: z.void(),
    response: z.void()
  },
  'app-error': {
    request: z.string(),
    response: z.void()
  },
  'log-message': {
    request: z.any(),
    response: z.void()
  },
  'get-logs': {
    request: z.void(),
    response: z.array(z.any())
  },
  'clear-logs': {
    request: z.void(),
    response: z.void()
  }
} as const

// ===========================================
// 型安全IPC通信インターフェース
// ===========================================

/**
 * 型安全なIPCリクエスト情報
 */
export interface TypeSafeIPCRequest<T extends IPCChannelTemplate> {
  readonly channel: T
  readonly data: IPCPayloadMap[T]['request']
  readonly requestId: string
  readonly timestamp: number
}

/**
 * 型安全なIPCレスポンス情報
 */
export interface TypeSafeIPCResponse<T extends IPCChannelTemplate> {
  readonly channel: T
  readonly data: IPCPayloadMap[T]['response']
  readonly requestId: string
  readonly timestamp: number
  readonly success: boolean
  readonly error?: string
}

/**
 * IPC通信の統計情報
 */
export interface IPCStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  channelStats: Record<string, {
    count: number
    averageTime: number
    lastUsed: number
  }>
}

// ===========================================
// 型安全IPC通信クラス
// ===========================================

/**
 * 型安全なIPC通信を提供するクラス
 */
export class TypeSafeIPCManager {
  private static instance: TypeSafeIPCManager
  private stats: IPCStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    channelStats: {}
  }
  private responseTimeHistory: number[] = []
  private readonly MAX_HISTORY_SIZE = 100

  constructor() {
    logger.info('TypeSafeIPCManager initialized')
  }

  static getInstance(): TypeSafeIPCManager {
    if (!TypeSafeIPCManager.instance) {
      TypeSafeIPCManager.instance = new TypeSafeIPCManager()
    }
    return TypeSafeIPCManager.instance
  }

  /**
   * IPCリクエストを検証する
   */
  validateRequest<T extends IPCChannelTemplate>(
    channel: T, 
    data: unknown
  ): TypeValidationResult<IPCPayloadMap[T]['request']> {
    const startTime = performance.now()

    try {
      // チャンネル名の検証
      if (!isValidIPCChannel(channel)) {
        return {
          success: false,
          errors: [{
            path: 'channel',
            expected: 'valid IPC channel',
            received: channel,
            code: 'INVALID_CHANNEL',
            message: `無効なIPCチャンネル: ${channel}`
          }]
        }
      }

      // スキーマ取得
      const schema = IPCSchemas[channel]?.request
      if (!schema) {
        return {
          success: false,
          errors: [{
            path: 'schema',
            expected: 'defined schema',
            received: 'undefined',
            code: 'SCHEMA_NOT_FOUND',
            message: `チャンネル ${channel} のスキーマが見つかりません`
          }]
        }
      }

      // データ検証
      const result = validationService.validate(schema, data, `IPC:${channel}`)
      const duration = performance.now() - startTime

      // 統計更新
      this.updateStats(channel, duration, result.success)

      logger.debug('IPC request validation completed', {
        channel,
        success: result.success,
        duration: `${duration.toFixed(2)}ms`
      })

      return {
        success: result.success,
        data: result.success ? result.data as IPCPayloadMap[T]['request'] : undefined,
        errors: result.details?.map(error => ({
          path: error.path,
          expected: '',
          received: '',
          code: error.code,
          message: error.message
        })),
        warnings: []
      }

    } catch (error) {
      const duration = performance.now() - startTime
      this.updateStats(channel, duration, false)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('IPC request validation error', {
        channel,
        error: errorMessage,
        duration: `${duration.toFixed(2)}ms`
      })

      return {
        success: false,
        errors: [{
          path: 'validation',
          expected: 'successful validation',
          received: 'error',
          code: 'VALIDATION_ERROR',
          message: `検証エラー: ${errorMessage}`
        }]
      }
    }
  }

  /**
   * IPCレスポンスを検証する
   */
  validateResponse<T extends IPCChannelTemplate>(
    channel: T, 
    data: unknown
  ): TypeValidationResult<IPCPayloadMap[T]['response']> {
    const startTime = performance.now()

    try {
      // チャンネル名の検証
      if (!isValidIPCChannel(channel)) {
        return {
          success: false,
          errors: [{
            path: 'channel',
            expected: 'valid IPC channel',
            received: channel,
            code: 'INVALID_CHANNEL',
            message: `無効なIPCチャンネル: ${channel}`
          }]
        }
      }

      // スキーマ取得
      const schema = IPCSchemas[channel]?.response
      if (!schema) {
        return {
          success: false,
          errors: [{
            path: 'schema',
            expected: 'defined schema',
            received: 'undefined',
            code: 'SCHEMA_NOT_FOUND',
            message: `チャンネル ${channel} のレスポンススキーマが見つかりません`
          }]
        }
      }

      // データ検証
      const result = validationService.validate(schema as any, data, `IPC:${channel}:response`)
      const duration = performance.now() - startTime

      logger.debug('IPC response validation completed', {
        channel,
        success: result.success,
        duration: `${duration.toFixed(2)}ms`
      })

      return {
        success: result.success,
        data: result.success ? result.data as IPCPayloadMap[T]['response'] : undefined,
        errors: result.details?.map(error => ({
          path: error.path,
          expected: '',
          received: '',
          code: error.code,
          message: error.message
        })),
        warnings: []
      }

    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      logger.error('IPC response validation error', {
        channel,
        error: errorMessage,
        duration: `${duration.toFixed(2)}ms`
      })

      return {
        success: false,
        errors: [{
          path: 'validation',
          expected: 'successful validation',
          received: 'error',
          code: 'VALIDATION_ERROR',
          message: `レスポンス検証エラー: ${errorMessage}`
        }]
      }
    }
  }

  /**
   * 型安全なIPCリクエストを作成
   */
  createRequest<T extends IPCChannelTemplate>(
    channel: T,
    data: IPCPayloadMap[T]['request']
  ): TypeSafeIPCRequest<T> {
    const requestId = this.generateRequestId()
    const timestamp = Date.now()

    logger.debug('Creating IPC request', {
      channel,
      requestId,
      dataType: typeof data
    })

    return {
      channel,
      data,
      requestId,
      timestamp
    }
  }

  /**
   * 型安全なIPCレスポンスを作成
   */
  createResponse<T extends IPCChannelTemplate>(
    channel: T,
    data: IPCPayloadMap[T]['response'],
    requestId: string,
    success: boolean = true,
    error?: string
  ): TypeSafeIPCResponse<T> {
    const timestamp = Date.now()

    logger.debug('Creating IPC response', {
      channel,
      requestId,
      success,
      hasError: !!error
    })

    return {
      channel,
      data,
      requestId,
      timestamp,
      success,
      error
    }
  }

  /**
   * 統計情報の更新
   */
  private updateStats(channel: string, responseTime: number, success: boolean): void {
    this.stats.totalRequests++
    
    if (success) {
      this.stats.successfulRequests++
    } else {
      this.stats.failedRequests++
    }

    // レスポンス時間の履歴更新
    this.responseTimeHistory.push(responseTime)
    if (this.responseTimeHistory.length > this.MAX_HISTORY_SIZE) {
      this.responseTimeHistory.shift()
    }

    // 平均レスポンス時間の計算
    this.stats.averageResponseTime = 
      this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / 
      this.responseTimeHistory.length

    // チャンネル別統計
    if (!this.stats.channelStats[channel]) {
      this.stats.channelStats[channel] = {
        count: 0,
        averageTime: 0,
        lastUsed: 0
      }
    }

    const channelStat = this.stats.channelStats[channel]
    channelStat.count++
    channelStat.averageTime = 
      (channelStat.averageTime * (channelStat.count - 1) + responseTime) / 
      channelStat.count
    channelStat.lastUsed = Date.now()
  }

  /**
   * リクエストIDの生成
   */
  private generateRequestId(): string {
    return `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 統計情報の取得
   */
  getStats(): IPCStats {
    return { ...this.stats }
  }

  /**
   * 統計情報のリセット
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      channelStats: {}
    }
    this.responseTimeHistory = []
    
    logger.info('IPC statistics reset')
  }

  /**
   * デバッグ情報の取得
   */
  getDebugInfo(): {
    stats: IPCStats
    recentResponseTimes: number[]
    supportedChannels: IPCChannelTemplate[]
  } {
    return {
      stats: this.getStats(),
      recentResponseTimes: [...this.responseTimeHistory].slice(-10),
      supportedChannels: Object.keys(IPCSchemas) as IPCChannelTemplate[]
    }
  }
}

// ===========================================
// ユーティリティ関数
// ===========================================

/**
 * IPCチャンネルの一覧を取得
 */
export function getAllIPCChannels(): IPCChannelTemplate[] {
  return Object.keys(IPCSchemas) as IPCChannelTemplate[]
}

/**
 * 特定のチャンネルがサポートされているかチェック
 */
export function isChannelSupported(channel: string): channel is IPCChannelTemplate {
  return channel in IPCSchemas
}

/**
 * チャンネルのスキーマ情報を取得
 */
export function getChannelSchema(channel: IPCChannelTemplate): {
  request: z.ZodSchema
  response: z.ZodSchema
} | null {
  return IPCSchemas[channel] || null
}

// ===========================================
// グローバルインスタンス
// ===========================================

/**
 * グローバル型安全IPC管理インスタンス
 */
export const typeSafeIPC = TypeSafeIPCManager.getInstance()

/**
 * IPC通信の型安全性チェック（便利関数）
 */
export function validateIPCRequest<T extends IPCChannelTemplate>(
  channel: T,
  data: unknown
): TypeValidationResult<IPCPayloadMap[T]['request']> {
  return typeSafeIPC.validateRequest(channel, data)
}

/**
 * IPCレスポンスの型安全性チェック（便利関数）
 */
export function validateIPCResponse<T extends IPCChannelTemplate>(
  channel: T,
  data: unknown
): TypeValidationResult<IPCPayloadMap[T]['response']> {
  return typeSafeIPC.validateResponse(channel, data)
} 