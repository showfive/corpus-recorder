import Store from 'electron-store'
import { createLogger } from '../../common/logger'
import { 
  AppConfig, 
  AppConfigSchema,
  defaultAppConfig,
  AudioQualitySettings
} from '../../common/schemas'
import { validationService } from '../../common/validation'
import { AppSettings } from '../../common/types'

const logger = createLogger('SettingsService')

// ===========================================
// 統一設定サービス
// ===========================================

/**
 * 統一設定サービス
 * 既存のelectron-storeとの互換性を保ちながら新しい統一設定システムを提供
 */
export class SettingsService {
  private static instance: SettingsService
  private store: Store<AppSettings>
  private unifiedConfig: AppConfig

  constructor() {
    // 既存のelectron-storeを維持
    this.store = new Store<AppSettings>({
      defaults: {
        recordingDirectory: '',
        lastTextIndex: 0,
        audioQuality: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: false,
        }
      }
    })

    // 統一設定の初期化
    this.unifiedConfig = this.createUnifiedConfig()
    
    logger.info('SettingsService initialized', {
      storePath: (this.store as any).path,
      hasLegacySettings: this.hasLegacySettings()
    })
  }

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService()
    }
    return SettingsService.instance
  }

  /**
   * レガシー設定から統一設定を作成
   */
  private createUnifiedConfig(): AppConfig {
    const legacySettings = this.getLegacySettings()
    
    return {
      audio: {
        quality: legacySettings.audioQuality || defaultAppConfig.audio.quality,
        bufferSize: defaultAppConfig.audio.bufferSize,
        processingMode: defaultAppConfig.audio.processingMode,
      },
      ui: defaultAppConfig.ui,
      storage: {
        recordingDirectory: legacySettings.recordingDirectory || '',
        lastOpenedTextFile: legacySettings.lastOpenedTextFile,
        lastTextIndex: legacySettings.lastTextIndex || 0,
        autoSave: defaultAppConfig.storage.autoSave,
        backup: defaultAppConfig.storage.backup,
      },
      development: defaultAppConfig.development,
      version: defaultAppConfig.version,
    }
  }

  /**
   * レガシー設定の取得
   */
  getLegacySettings(): Partial<AppSettings> {
    return {
      recordingDirectory: (this.store as any).get('recordingDirectory', ''),
      lastOpenedTextFile: (this.store as any).get('lastOpenedTextFile'),
      lastTextIndex: (this.store as any).get('lastTextIndex', 0),
      audioQuality: (this.store as any).get('audioQuality', defaultAppConfig.audio.quality)
    }
  }

  /**
   * レガシー設定の更新
   */
  updateLegacySettings(settings: Partial<AppSettings>): void {
    logger.info('Updating legacy settings', { keys: Object.keys(settings) })

    if (settings.recordingDirectory !== undefined) {
      ;(this.store as any).set('recordingDirectory', settings.recordingDirectory)
      this.unifiedConfig.storage.recordingDirectory = settings.recordingDirectory
    }
    
    if (settings.lastOpenedTextFile !== undefined) {
      ;(this.store as any).set('lastOpenedTextFile', settings.lastOpenedTextFile)
      this.unifiedConfig.storage.lastOpenedTextFile = settings.lastOpenedTextFile
    }
    
    if (settings.lastTextIndex !== undefined) {
      ;(this.store as any).set('lastTextIndex', settings.lastTextIndex)
      this.unifiedConfig.storage.lastTextIndex = settings.lastTextIndex
    }
    
    if (settings.audioQuality !== undefined) {
      ;(this.store as any).set('audioQuality', settings.audioQuality)
      this.unifiedConfig.audio.quality = settings.audioQuality
    }

    this.validateAndSyncConfig()
  }

  /**
   * 統一設定の取得
   */
  getUnifiedConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.unifiedConfig))
  }

  /**
   * 統一設定の部分更新
   */
  updateUnifiedConfig(updates: Record<string, any>): void {
    logger.info('Updating unified config', { paths: Object.keys(updates) })

    try {
      // 統一設定を更新
      Object.entries(updates).forEach(([path, value]) => {
        this.setValueByPath(this.unifiedConfig, path, value)
      })

      // レガシーストアとの同期
      this.syncToLegacyStore()
      
      // 検証
      this.validateAndSyncConfig()

    } catch (error) {
      logger.error('Failed to update unified config', {
        error: error instanceof Error ? error.message : error,
        updates
      })
      throw error
    }
  }

  /**
   * 設定パスによる値の設定
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
   * 統一設定からレガシーストアへの同期
   */
  private syncToLegacyStore(): void {
    const legacySettings: Partial<AppSettings> = {
      recordingDirectory: this.unifiedConfig.storage.recordingDirectory,
      lastOpenedTextFile: this.unifiedConfig.storage.lastOpenedTextFile,
      lastTextIndex: this.unifiedConfig.storage.lastTextIndex,
      audioQuality: this.unifiedConfig.audio.quality
    }

    // レガシーストアに保存
    Object.entries(legacySettings).forEach(([key, value]) => {
      if (value !== undefined) {
        (this.store as any).set(key as keyof AppSettings, value)
      }
    })

    logger.debug('Synced to legacy store', { keys: Object.keys(legacySettings) })
  }

  /**
   * 設定の検証と同期
   */
  private validateAndSyncConfig(): void {
    const validation = validationService.validate(AppConfigSchema, this.unifiedConfig, 'SettingsService')
    
    if (!validation.success) {
      logger.warn('Configuration validation failed, applying defaults', {
        error: validation.error,
        details: validation.details
      })
      
      // デフォルト設定を適用
      this.unifiedConfig = this.createUnifiedConfig()
    }
  }

  /**
   * レガシー設定の存在確認
   */
  private hasLegacySettings(): boolean {
    return (this.store as any).size > 0
  }

  /**
   * 設定のマイグレーション
   */
  async migrateToUnified(): Promise<void> {
    logger.info('Starting configuration migration to unified system')

    try {
      // 現在のレガシー設定をバックアップ
      const legacyBackup = this.getLegacySettings()
      
      // 統一設定を作成
      this.unifiedConfig = this.createUnifiedConfig()
      
      // 検証
      const validation = validationService.validate(AppConfigSchema, this.unifiedConfig, 'SettingsService.migrate')
      
      if (!validation.success) {
        throw new Error(`Migration validation failed: ${validation.error}`)
      }

      logger.info('Configuration migration completed successfully', {
        migratedKeys: Object.keys(legacyBackup),
        unifiedConfigKeys: Object.keys(this.unifiedConfig)
      })

    } catch (error) {
      logger.error('Configuration migration failed', {
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * 設定を工場出荷時に戻す
   */
  resetToDefaults(): void {
    logger.info('Resetting all settings to defaults')

    try {
      // デフォルト設定を適用
      this.unifiedConfig = { ...defaultAppConfig }
      
      // レガシーストアにも反映
      this.syncToLegacyStore()
      
      logger.info('Settings reset to defaults successfully')

    } catch (error) {
      logger.error('Failed to reset settings', {
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * デバッグ情報の取得
   */
  getDebugInfo(): {
    legacySettings: Partial<AppSettings>
    unifiedConfig: AppConfig
    storePath: string
    storeSize: number
    validationStatus: boolean
  } {
    const validation = validationService.validate(AppConfigSchema, this.unifiedConfig, 'SettingsService.debug')
    
    return {
      legacySettings: this.getLegacySettings(),
      unifiedConfig: this.getUnifiedConfig(),
      storePath: (this.store as any).path || 'unknown',
      storeSize: (this.store as any).size,
      validationStatus: validation.success
    }
  }

  /**
   * ストアパスの取得
   */
  getStorePath(): string {
    return (this.store as any).path || 'unknown'
  }
}

// ===========================================
// グローバルインスタンス
// ===========================================

/**
 * グローバル設定サービスのインスタンス
 */
export const settingsService = SettingsService.getInstance()

// ===========================================
// 便利な関数（既存コードとの互換性）
// ===========================================

/**
 * レガシー設定の取得（既存コードとの互換性）
 */
export function getSettings(): Partial<AppSettings> {
  return settingsService.getLegacySettings()
}

/**
 * レガシー設定の更新（既存コードとの互換性）
 */
export function updateSettings(settings: Partial<AppSettings>): void {
  settingsService.updateLegacySettings(settings)
}

/**
 * 統一設定の取得
 */
export function getUnifiedConfig(): AppConfig {
  return settingsService.getUnifiedConfig()
}

/**
 * 統一設定の更新
 */
export function updateUnifiedConfig(updates: Record<string, any>): void {
  settingsService.updateUnifiedConfig(updates)
} 