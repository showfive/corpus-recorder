/**
 * 構造化ロギングシステム
 * アプリケーション全体で一貫したログ記録とデバッグ情報の提供
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  category: string
  message: string
  data?: any
  context?: string
}

export interface LoggerConfig {
  enableConsole: boolean
  enablePerformance: boolean
  maxLogEntries: number
  logLevel: LogLevel
}

/**
 * カテゴリ別のロガークラス
 */
class CategoryLogger {
  constructor(
    private category: string,
    private mainLogger: Logger
  ) {}

  debug(message: string, data?: any, context?: string): void {
    this.mainLogger.log(LogLevel.DEBUG, this.category, message, data, context)
  }

  info(message: string, data?: any, context?: string): void {
    this.mainLogger.log(LogLevel.INFO, this.category, message, data, context)
  }

  warn(message: string, data?: any, context?: string): void {
    this.mainLogger.log(LogLevel.WARN, this.category, message, data, context)
  }

  error(message: string, data?: any, context?: string): void {
    this.mainLogger.log(LogLevel.ERROR, this.category, message, data, context)
  }

  startPerformance(markName: string): void {
    this.mainLogger.startPerformance(`${this.category}:${markName}`)
  }

  endPerformance(markName: string): number | null {
    return this.mainLogger.endPerformance(`${this.category}:${markName}`)
  }
}

/**
 * メインロガークラス
 */
class Logger {
  private static instance: Logger
  private logEntries: LogEntry[] = []
  private performanceMarks: Map<string, number> = new Map()
  private config: LoggerConfig = {
    enableConsole: true,
    enablePerformance: true,
    maxLogEntries: 1000,
    logLevel: LogLevel.INFO
  }

  private constructor() {
    // 開発環境の場合はDEBUGレベルを有効化
    if (process.env.NODE_ENV === 'development') {
      this.config.logLevel = LogLevel.DEBUG
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * カテゴリ別ロガーを取得
   */
  getLogger(category: string): CategoryLogger {
    return new CategoryLogger(category, this)
  }

  /**
   * ログレベルの優先度を取得
   */
  private getLogLevelPriority(level: LogLevel): number {
    switch (level) {
      case LogLevel.DEBUG: return 0
      case LogLevel.INFO: return 1
      case LogLevel.WARN: return 2
      case LogLevel.ERROR: return 3
      default: return 1
    }
  }

  /**
   * ログエントリを記録
   */
  log(level: LogLevel, category: string, message: string, data?: any, context?: string): void {
    // ログレベルフィルタリング
    if (this.getLogLevelPriority(level) < this.getLogLevelPriority(this.config.logLevel)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      context
    }

    // ログエントリを保存
    this.logEntries.push(entry)

    // 最大エントリ数を超えた場合は古いエントリを削除
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries.shift()
    }

    // コンソール出力
    if (this.config.enableConsole) {
      this.outputToConsole(entry)
    }
  }

  /**
   * コンソール出力
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const prefix = `[${timestamp}] [${entry.level}] [${entry.category}]`
    const message = entry.context ? `${entry.message} (${entry.context})` : entry.message

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, entry.data || '')
        break
      case LogLevel.INFO:
        console.info(prefix, message, entry.data || '')
        break
      case LogLevel.WARN:
        console.warn(prefix, message, entry.data || '')
        break
      case LogLevel.ERROR:
        console.error(prefix, message, entry.data || '')
        break
    }
  }

  /**
   * パフォーマンス測定開始
   */
  startPerformance(markName: string): void {
    if (!this.config.enablePerformance) return
    
    this.performanceMarks.set(markName, performance.now())
    this.log(LogLevel.DEBUG, 'PERFORMANCE', `Performance mark started: ${markName}`)
  }

  /**
   * パフォーマンス測定終了
   */
  endPerformance(markName: string): number | null {
    if (!this.config.enablePerformance) return null

    const startTime = this.performanceMarks.get(markName)
    if (startTime === undefined) {
      this.log(LogLevel.WARN, 'PERFORMANCE', `Performance mark not found: ${markName}`)
      return null
    }

    const duration = performance.now() - startTime
    this.performanceMarks.delete(markName)
    
    this.log(LogLevel.DEBUG, 'PERFORMANCE', `Performance mark ended: ${markName}`, { 
      duration: `${duration.toFixed(2)}ms` 
    })
    
    return duration
  }

  /**
   * ログエントリを取得
   */
  getLogEntries(): LogEntry[] {
    return [...this.logEntries]
  }

  /**
   * カテゴリ別ログエントリを取得
   */
  getLogEntriesByCategory(category: string): LogEntry[] {
    return this.logEntries.filter(entry => entry.category === category)
  }

  /**
   * レベル別ログエントリを取得
   */
  getLogEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.logEntries.filter(entry => entry.level === level)
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logEntries = []
    this.log(LogLevel.INFO, 'LOGGER', 'Log entries cleared')
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.log(LogLevel.INFO, 'LOGGER', 'Logger configuration updated', newConfig)
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): LoggerConfig {
    return { ...this.config }
  }

  /**
   * システム情報を収集
   */
  collectSystemInfo(): Record<string, any> {
    const systemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memoryInfo: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      timestamp: new Date().toISOString()
    }

    this.log(LogLevel.INFO, 'SYSTEM', 'System information collected', systemInfo)
    return systemInfo
  }

  /**
   * ログをエクスポート（JSON形式）
   */
  exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      systemInfo: this.collectSystemInfo(),
      logs: this.logEntries
    }

    return JSON.stringify(exportData, null, 2)
  }
}

// シングルトンインスタンス
export const logger = Logger.getInstance()

// 便利なヘルパー関数
export function createLogger(category: string): CategoryLogger {
  return logger.getLogger(category)
}