import { z } from 'zod'
import { createLogger } from '../logger'
import {
  AppConfigSchema,
  AudioFileMetadataSchema,
  TextFileReadResultSchema,
  validatePartialConfig,
  validateConfigPath
} from '../schemas'

const logger = createLogger('ValidationService')

// ===========================================
// 検証結果の型定義
// ===========================================

export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: ValidationError[]
}

export interface ValidationError {
  path: string
  message: string
  code: string
  input?: any
}

// ===========================================
// 汎用バリデーションサービス
// ===========================================

/**
 * 統一バリデーションサービス
 * Zodスキーマを使用してランタイム型検証を行う
 */
export class ValidationService {
  private static instance: ValidationService
  private schemaRegistry: Map<string, z.ZodSchema> = new Map()

  constructor() {
    this.initializeSchemas()
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService()
    }
    return ValidationService.instance
  }

  /**
   * スキーマレジストリの初期化
   */
  private initializeSchemas(): void {
    this.schemaRegistry.set('AppConfig', AppConfigSchema)
    this.schemaRegistry.set('AudioFileMetadata', AudioFileMetadataSchema)
    this.schemaRegistry.set('TextFileReadResult', TextFileReadResultSchema)
    
    logger.info('Schema registry initialized', {
      registeredSchemas: Array.from(this.schemaRegistry.keys())
    })
  }

  /**
   * 汎用バリデーション
   */
  validate<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): ValidationResult<T> {
    const startTime = performance.now()
    
    try {
      const result = schema.safeParse(data)
      const duration = performance.now() - startTime

      if (result.success) {
        logger.debug('Validation successful', {
          context,
          duration: `${duration.toFixed(2)}ms`,
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : undefined
        })
        
        return {
          success: true,
          data: result.data
        }
      } else {
        const errors: ValidationError[] = result.error.errors.map(error => ({
          path: error.path.join('.'),
          message: error.message,
          code: error.code,
          input: 'input' in error ? error.input : undefined
        }))

        logger.warn('Validation failed', {
          context,
          duration: `${duration.toFixed(2)}ms`,
          errorCount: errors.length,
          errors: errors.slice(0, 5) // ログには最初の5つのエラーのみ
        })

        return {
          success: false,
          error: `Validation failed: ${errors.map(e => `${e.path}: ${e.message}`).join(', ')}`,
          details: errors
        }
      }
    } catch (error) {
      const duration = performance.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
      
      logger.error('Validation error', {
        context,
        duration: `${duration.toFixed(2)}ms`,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 非同期バリデーション
   */
  async validateAsync<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): Promise<ValidationResult<T>> {
    return new Promise((resolve) => {
      // 重い検証処理を非同期で実行
      setTimeout(() => {
        resolve(this.validate(schema, data, context))
      }, 0)
    })
  }

  /**
   * 登録されたスキーマでの検証
   */
  validateWithSchema<T>(schemaName: string, data: unknown): ValidationResult<T> {
    const schema = this.schemaRegistry.get(schemaName)
    if (!schema) {
      logger.error('Schema not found', { schemaName, availableSchemas: Array.from(this.schemaRegistry.keys()) })
      return {
        success: false,
        error: `Schema '${schemaName}' not found in registry`
      }
    }

    return this.validate(schema as z.ZodSchema<T>, data, schemaName)
  }

  /**
   * 設定の部分的更新の検証
   */
  validatePartialConfig(partial: unknown): ValidationResult<Partial<any>> {
    const result = validatePartialConfig(partial)
    return {
      success: result.success,
      data: result.data,
      error: result.error
    }
  }

  /**
   * IPC通信データの検証
   */
  validateIPC<T>(channel: string, data: unknown): ValidationResult<T> {
    // チャンネル名に基づく適切なスキーマの選択
    const schemaMap: Record<string, string> = {
      'save-audio-file-with-metadata': 'AudioFileMetadata',
      'update-settings': 'AppConfig',
      'read-text-file': 'TextFileReadResult'
    }

    const schemaName = schemaMap[channel]
    if (!schemaName) {
      logger.debug('No specific validation schema for IPC channel', { channel })
      return { success: true, data: data as T }
    }

    return this.validateWithSchema<T>(schemaName, data)
  }

  /**
   * 設定パスの検証
   */
  validatePath(path: string): boolean {
    return validateConfigPath(path)
  }

  /**
   * カスタムスキーマの登録
   */
  registerSchema(name: string, schema: z.ZodSchema): void {
    this.schemaRegistry.set(name, schema)
    logger.info('Custom schema registered', { schemaName: name })
  }

  /**
   * スキーマの削除
   */
  unregisterSchema(name: string): boolean {
    const deleted = this.schemaRegistry.delete(name)
    if (deleted) {
      logger.info('Schema unregistered', { schemaName: name })
    }
    return deleted
  }

  /**
   * 統計情報の取得
   */
  getStats(): { registeredSchemas: number; availableSchemas: string[] } {
    return {
      registeredSchemas: this.schemaRegistry.size,
      availableSchemas: Array.from(this.schemaRegistry.keys())
    }
  }
}

// ===========================================
// 便利な関数
// ===========================================

/**
 * グローバルバリデーションサービスのインスタンス
 */
export const validationService = ValidationService.getInstance()

/**
 * 設定データの検証（便利関数）
 */
export function validateAppConfig(config: unknown): ValidationResult {
  return validationService.validateWithSchema('AppConfig', config)
}

/**
 * 音声ファイルメタデータの検証（便利関数）
 */
export function validateAudioMetadata(metadata: unknown): ValidationResult {
  return validationService.validateWithSchema('AudioFileMetadata', metadata)
}

/**
 * テキストファイル読み込み結果の検証（便利関数）
 */
export function validateTextFileResult(result: unknown): ValidationResult {
  return validationService.validateWithSchema('TextFileReadResult', result)
}

/**
 * IPC通信データの検証（便利関数）
 */
export function validateIPCData<T>(channel: string, data: unknown): ValidationResult<T> {
  return validationService.validateIPC<T>(channel, data)
}

// ===========================================
// デコレーター（将来的な拡張用）
// ===========================================

/**
 * メソッドの引数を自動検証するデコレーター（TypeScript 5.0+）
 */
export function validateArgs(schema: z.ZodSchema) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const result = validationService.validate(schema, args[0], `${target.constructor.name}.${propertyKey}`)
      
      if (!result.success) {
        throw new Error(`Validation failed for ${propertyKey}: ${result.error}`)
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
} 