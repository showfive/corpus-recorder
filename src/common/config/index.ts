import EventEmitter from 'eventemitter3'
import { createLogger } from '../logger'
import { 
  AppConfig, 
  AppConfigSchema,
  defaultAppConfig,
  validatePartialConfig
} from '../schemas'
import { ValidationResult, validationService } from '../validation'

const logger = createLogger('ConfigManager')

// ===========================================
// 設定イベントの型定義
// ===========================================

export interface ConfigEvents {
  'config:changed': { path: string; oldValue: any; newValue: any; timestamp: string }
  'config:loaded': { source: string; config: AppConfig; timestamp: string }
  'config:saved': { target: string; config: AppConfig; timestamp: string }
  'config:error': { error: string; context: string; timestamp: string }
  'config:validated': { path?: string; success: boolean; timestamp: string }
}

export type ConfigWatcher<T = any> = (newValue: T, oldValue: T, path: string) => void

// ===========================================
// 設定管理サービス
// ===========================================

/**
 * 統一設定管理システム
 * - 型安全な設定の読み書き
 * - リアルタイム変更通知
 * - バリデーション機能
 * - ドット記法でのアクセス
 */
export class ConfigManager extends EventEmitter<ConfigEvents> {
  private static instance: ConfigManager
  private config: AppConfig
  private watchers: Map<string, Set<ConfigWatcher>> = new Map()
  private isLoaded: boolean = false
  private saveDebounceTimer: NodeJS.Timeout | null = null
  private readonly SAVE_DEBOUNCE_MS = 500

  constructor(initialConfig?: Partial<AppConfig>) {
    super()
    
    // デフォルト設定から開始
    this.config = { ...defaultAppConfig }
    
    // 初期設定があれば適用
    if (initialConfig) {
      this.applyPartialConfig(initialConfig)
    }

    logger.info('ConfigManager initialized', {
      hasInitialConfig: !!initialConfig,
      configKeys: Object.keys(this.config)
    })
  }

  static getInstance(initialConfig?: Partial<AppConfig>): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(initialConfig)
    }
    return ConfigManager.instance
  }

  // ===========================================
  // 設定の読み取り
  // ===========================================

  /**
   * 設定値の取得（ドット記法対応）
   */
  get<T = any>(path: string): T {
    const value = this.getValueByPath(this.config, path)
    
    logger.debug('Config value retrieved', {
      path,
      valueType: typeof value,
      hasValue: value !== undefined
    })
    
    return value as T
  }

  /**
   * 設定値の取得（デフォルト値付き）
   */
  getWithDefault<T>(path: string, defaultValue: T): T {
    const value = this.get<T>(path)
    return value !== undefined ? value : defaultValue
  }

  /**
   * 全設定の取得
   */
  getAll(): AppConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 設定セクションの取得
   */
  getSection<T extends keyof AppConfig>(section: T): AppConfig[T] {
    return JSON.parse(JSON.stringify(this.config[section]))
  }

  // ===========================================
  // 設定の書き込み
  // ===========================================

  /**
   * 設定値の設定（ドット記法対応）
   */
  set<T>(path: string, value: T): void {
    // パスの妥当性検証
    if (!validationService.validatePath(path)) {
      const error = `Invalid config path: ${path}`
      logger.error(error)
      this.emit('config:error', {
        error,
        context: 'set',
        timestamp: new Date().toISOString()
      })
      throw new Error(error)
    }

    const oldValue = this.get(path)
    
    try {
      // 値の設定
      this.setValueByPath(this.config, path, value)
      
      // 設定全体の検証
      const validation = this.validate()
      if (!validation.success) {
        // 無効な場合は元に戻す
        this.setValueByPath(this.config, path, oldValue)
        throw new Error(`Validation failed: ${validation.error}`)
      }

      // 変更通知
      this.notifyChange(path, oldValue, value)
      
      // 自動保存（デバウンス）
      this.scheduleSave()

      logger.debug('Config value set', {
        path,
        oldValue: this.serializeForLog(oldValue),
        newValue: this.serializeForLog(value)
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to set config value', {
        path,
        value: this.serializeForLog(value),
        error: errorMessage
      })
      
      this.emit('config:error', {
        error: errorMessage,
        context: `set:${path}`,
        timestamp: new Date().toISOString()
      })
      
      throw error
    }
  }

  /**
   * 複数の設定値を一括設定
   */
  setMultiple(updates: Record<string, any>): void {
    logger.info('Setting multiple config values', {
      paths: Object.keys(updates),
      updateCount: Object.keys(updates).length
    })

    const oldValues: Record<string, any> = {}
    const errors: string[] = []

    // すべての変更を一度に適用し、問題があれば巻き戻す
    try {
      // 古い値を保存
      Object.keys(updates).forEach(path => {
        oldValues[path] = this.get(path)
      })

      // 新しい値を設定
      Object.entries(updates).forEach(([path, value]) => {
        if (!validationService.validatePath(path)) {
          throw new Error(`Invalid path: ${path}`)
        }
        this.setValueByPath(this.config, path, value)
      })

      // 全体の検証
      const validation = this.validate()
      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.error}`)
      }

      // 変更通知
      Object.entries(updates).forEach(([path, value]) => {
        this.notifyChange(path, oldValues[path], value)
      })

      this.scheduleSave()

    } catch (error) {
      // エラー時は全て巻き戻す
      Object.entries(oldValues).forEach(([path, value]) => {
        this.setValueByPath(this.config, path, value)
      })

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to set multiple config values', {
        updates: Object.keys(updates),
        error: errorMessage
      })

      throw error
    }
  }

  // ===========================================
  // 監視機能
  // ===========================================

  /**
   * 設定変更の監視
   */
  watch<T>(path: string, callback: ConfigWatcher<T>): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set())
    }
    
    const watchers = this.watchers.get(path)!
    watchers.add(callback as ConfigWatcher)

    logger.debug('Config watcher added', {
      path,
      watcherCount: watchers.size
    })

    // アンサブスクライブ関数を返す
    return () => {
      watchers.delete(callback as ConfigWatcher)
      if (watchers.size === 0) {
        this.watchers.delete(path)
      }
      
      logger.debug('Config watcher removed', {
        path,
        remainingWatchers: watchers.size
      })
    }
  }

  /**
   * 設定変更の通知
   */
  private notifyChange(path: string, oldValue: any, newValue: any): void {
    const timestamp = new Date().toISOString()

    // グローバルイベント
    this.emit('config:changed', { path, oldValue, newValue, timestamp })

    // パス固有のウォッチャー
    const watchers = this.watchers.get(path)
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(newValue, oldValue, path)
        } catch (error) {
          logger.error('Config watcher error', {
            path,
            error: error instanceof Error ? error.message : error
          })
        }
      })
    }

    // 上位パスのウォッチャーも通知
    this.notifyParentWatchers(path, oldValue, newValue)
  }

  /**
   * 上位パスのウォッチャーに通知
   */
  private notifyParentWatchers(path: string, oldValue: any, newValue: any): void {
    const pathParts = path.split('.')
    
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.')
      const watchers = this.watchers.get(parentPath)
      
      if (watchers) {
        const parentOldValue = this.getValueByPath({ ...this.config, [path]: oldValue }, parentPath)
        const parentNewValue = this.getValueByPath(this.config, parentPath)
        
        watchers.forEach(callback => {
          try {
            callback(parentNewValue, parentOldValue, parentPath)
          } catch (error) {
            logger.error('Parent config watcher error', {
              parentPath,
              childPath: path,
              error: error instanceof Error ? error.message : error
            })
          }
        })
      }
    }
  }

  // ===========================================
  // 検証機能
  // ===========================================

  /**
   * 設定全体の検証
   */
  validate(): ValidationResult<AppConfig> {
    const result = validationService.validate(AppConfigSchema, this.config, 'ConfigManager.validate')
    
    this.emit('config:validated', {
      success: result.success,
      timestamp: new Date().toISOString()
    })

    return {
      success: result.success,
      data: result.success ? result.data as AppConfig : undefined,
      error: result.error,
      details: result.details
    }
  }

  /**
   * 部分設定の適用
   */
  applyPartialConfig(partial: Partial<AppConfig>): void {
    const validation = validatePartialConfig(partial)
    
    if (!validation.success) {
      throw new Error(`Invalid partial config: ${validation.error}`)
    }

    // 深いマージ
    this.config = this.deepMerge(this.config, partial)
    
    logger.info('Partial config applied', {
      appliedKeys: Object.keys(partial),
      configAfterMerge: Object.keys(this.config)
    })
  }

  // ===========================================
  // 永続化機能
  // ===========================================

  /**
   * 設定の保存（デバウンス付き）
   */
  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }

    this.saveDebounceTimer = setTimeout(async () => {
      try {
        await this.save()
      } catch (error) {
        logger.error('Auto-save failed', {
          error: error instanceof Error ? error.message : error
        })
      }
    }, this.SAVE_DEBOUNCE_MS)
  }

  /**
   * 設定の保存（オーバーライド可能）
   */
  async save(): Promise<void> {
    // 基底クラスでは何もしない（サブクラスでオーバーライド）
    logger.debug('ConfigManager.save() called (base implementation)')
    
    this.emit('config:saved', {
      target: 'memory',
      config: this.getAll(),
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 設定の読み込み（オーバーライド可能）
   */
  async load(): Promise<void> {
    // 基底クラスでは何もしない（サブクラスでオーバーライド）
    this.isLoaded = true
    logger.debug('ConfigManager.load() called (base implementation)')
    
    this.emit('config:loaded', {
      source: 'memory',
      config: this.getAll(),
      timestamp: new Date().toISOString()
    })
  }

  // ===========================================
  // ユーティリティ
  // ===========================================

  /**
   * ドット記法での値取得
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * ドット記法での値設定
   */
  private setValueByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)
    
    target[lastKey] = value
  }

  /**
   * 深いマージ
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object') {
      return source
    }

    if (Array.isArray(source)) {
      return [...source]
    }

    const result = { ...target }
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = this.deepMerge(target[key], source[key])
        } else {
          result[key] = source[key]
        }
      }
    }

    return result
  }

  /**
   * ログ用のシリアライズ（機密情報の除外）
   */
  private serializeForLog(value: any): any {
    if (typeof value === 'string' && value.length > 100) {
      return `${value.substring(0, 100)}... (truncated)`
    }
    return value
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    isLoaded: boolean
    watcherCount: number
    watchedPaths: string[]
    configKeys: string[]
    lastValidation?: boolean
  } {
    return {
      isLoaded: this.isLoaded,
      watcherCount: Array.from(this.watchers.values()).reduce((sum, set) => sum + set.size, 0),
      watchedPaths: Array.from(this.watchers.keys()),
      configKeys: Object.keys(this.config),
      lastValidation: this.validate().success
    }
  }

  /**
   * デバッグ情報の取得
   */
  getDebugInfo(): {
    config: AppConfig
    watchers: Record<string, number>
    stats: ReturnType<ConfigManager['getStats']>
  } {
    const watcherCounts: Record<string, number> = {}
    this.watchers.forEach((watchers, path) => {
      watcherCounts[path] = watchers.size
    })

    return {
      config: this.getAll(),
      watchers: watcherCounts,
      stats: this.getStats()
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    
    this.watchers.clear()
    this.removeAllListeners()
    
    logger.info('ConfigManager destroyed')
  }
}

// ===========================================
// グローバルインスタンス
// ===========================================

/**
 * グローバル設定マネージャーのインスタンス
 */
export const configManager = ConfigManager.getInstance()

// ===========================================
// 便利な関数
// ===========================================

/**
 * 設定値の取得（便利関数）
 */
export function getConfig<T = any>(path: string): T {
  return configManager.get<T>(path)
}

/**
 * 設定値の設定（便利関数）
 */
export function setConfig<T>(path: string, value: T): void {
  configManager.set(path, value)
}

/**
 * 設定の監視（便利関数）
 */
export function watchConfig<T>(path: string, callback: ConfigWatcher<T>): () => void {
  return configManager.watch(path, callback)
} 