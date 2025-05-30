/**
 * 統一エラーハンドリングシステム
 * アプリケーション全体で一貫したエラー処理とログ記録を提供
 */

import { ElMessage } from 'element-plus'
import { logger, LogLevel } from './logger'

export enum ErrorCategory {
  // 録音関連
  RECORDING_START = 'RECORDING_START',
  RECORDING_STOP = 'RECORDING_STOP',
  RECORDING_PROCESS = 'RECORDING_PROCESS',
  AUDIO_CONVERSION = 'AUDIO_CONVERSION',
  
  // ファイル操作
  FILE_READ = 'FILE_READ',
  FILE_WRITE = 'FILE_WRITE',
  FILE_DELETE = 'FILE_DELETE',
  DIRECTORY_SELECT = 'DIRECTORY_SELECT',
  
  // IPC通信
  IPC_COMMUNICATION = 'IPC_COMMUNICATION',
  
  // UI操作
  UI_INTERACTION = 'UI_INTERACTION',
  
  // システム
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // ネットワーク（将来的な使用）
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',        // ユーザー操作で回復可能
  MEDIUM = 'MEDIUM',  // 部分的な機能停止
  HIGH = 'HIGH',      // 重要な機能停止
  CRITICAL = 'CRITICAL' // アプリケーション停止
}

export interface ErrorContext {
  category: ErrorCategory
  severity: ErrorSeverity
  userMessage: string
  technicalMessage?: string
  suggestions?: string[]
  retryable?: boolean
  context?: Record<string, any>
}

export interface AppError extends Error {
  category: ErrorCategory
  severity: ErrorSeverity
  userMessage: string
  technicalMessage?: string
  suggestions?: string[]
  retryable?: boolean
  context?: Record<string, any>
  timestamp: string
  id: string
}

class ErrorHandler {
  private errorHistory: AppError[] = []
  private readonly maxErrorHistory = 100

  /**
   * AppErrorを作成
   */
  createError(
    message: string,
    errorContext: ErrorContext,
    originalError?: Error
  ): AppError {
    const error = new Error(message) as AppError
    
    error.category = errorContext.category
    error.severity = errorContext.severity
    error.userMessage = errorContext.userMessage
    error.technicalMessage = errorContext.technicalMessage || message
    error.suggestions = errorContext.suggestions
    error.retryable = errorContext.retryable || false
    error.context = errorContext.context
    error.timestamp = new Date().toISOString()
    error.id = this.generateErrorId()
    
    // 原因となったエラーのスタックトレースを保持
    if (originalError) {
      error.stack = originalError.stack
      error.cause = originalError
    }

    return error
  }

  /**
   * エラーを処理
   */
  handle(error: unknown, context?: Partial<ErrorContext>): AppError {
    let appError: AppError

    if (this.isAppError(error)) {
      appError = error
    } else if (error instanceof Error) {
      appError = this.createErrorFromNativeError(error, context)
    } else {
      appError = this.createErrorFromUnknown(error, context)
    }

    // エラー履歴に追加
    this.addToHistory(appError)

    // ログに記録
    this.logError(appError)

    // ユーザーに通知
    this.notifyUser(appError)

    return appError
  }

  /**
   * 致命的エラーの処理
   */
  handleCritical(error: unknown, context?: Partial<ErrorContext>): AppError {
    const criticalContext: Partial<ErrorContext> = {
      ...context,
      severity: ErrorSeverity.CRITICAL
    }

    const appError = this.handle(error, criticalContext)
    
    // 致命的エラーの場合は追加のログ記録
    logger.log(LogLevel.ERROR, 'CRITICAL_ERROR', 'Critical error occurred - application may become unstable', {
      errorId: appError.id,
      category: appError.category,
      message: appError.message,
      context: appError.context
    })

    return appError
  }

  /**
   * AppErrorかどうかを判定
   */
  private isAppError(error: unknown): error is AppError {
    return error instanceof Error && 'category' in error && 'severity' in error
  }

  /**
   * ネイティブErrorからAppErrorを作成
   */
  private createErrorFromNativeError(error: Error, context?: Partial<ErrorContext>): AppError {
    const errorContext: ErrorContext = {
      category: context?.category || ErrorCategory.SYSTEM_ERROR,
      severity: context?.severity || ErrorSeverity.MEDIUM,
      userMessage: context?.userMessage || this.getDefaultUserMessage(error),
      technicalMessage: error.message,
      suggestions: context?.suggestions,
      retryable: context?.retryable,
      context: context?.context
    }

    return this.createError(error.message, errorContext, error)
  }

  /**
   * 不明なエラーからAppErrorを作成
   */
  private createErrorFromUnknown(error: unknown, context?: Partial<ErrorContext>): AppError {
    const message = typeof error === 'string' ? error : '不明なエラーが発生しました'
    
    const errorContext: ErrorContext = {
      category: context?.category || ErrorCategory.SYSTEM_ERROR,
      severity: context?.severity || ErrorSeverity.MEDIUM,
      userMessage: context?.userMessage || message,
      technicalMessage: message,
      suggestions: context?.suggestions,
      retryable: context?.retryable,
      context: {
        ...context?.context,
        originalError: error
      }
    }

    return this.createError(message, errorContext)
  }

  /**
   * デフォルトユーザーメッセージを取得
   */
  private getDefaultUserMessage(error: Error): string {
    const message = error.message.toLowerCase()

    if (message.includes('permission') || message.includes('access')) {
      return 'アクセス権限の問題が発生しました'
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'ネットワーク接続の問題が発生しました'
    }
    if (message.includes('file') || message.includes('path')) {
      return 'ファイル操作でエラーが発生しました'
    }
    if (message.includes('microphone') || message.includes('audio')) {
      return '音声機能でエラーが発生しました'
    }

    return '予期しないエラーが発生しました'
  }

  /**
   * エラー履歴に追加
   */
  private addToHistory(error: AppError): void {
    this.errorHistory.push(error)
    
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift()
    }
  }

  /**
   * エラーをログに記録
   */
  private logError(error: AppError): void {
    const logData = {
      id: error.id,
      category: error.category,
      severity: error.severity,
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
      suggestions: error.suggestions,
      retryable: error.retryable,
      context: error.context,
      stack: error.stack
    }

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logger.log(LogLevel.INFO, 'ERROR_HANDLER', `Low severity error: ${error.message}`, logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.log(LogLevel.WARN, 'ERROR_HANDLER', `Medium severity error: ${error.message}`, logData)
        break
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logger.log(LogLevel.ERROR, 'ERROR_HANDLER', `${error.severity} severity error: ${error.message}`, logData)
        break
    }
  }

  /**
   * ユーザーに通知
   */
  private notifyUser(error: AppError): void {
    let message = error.userMessage

    // 提案がある場合は追加
    if (error.suggestions && error.suggestions.length > 0) {
      message += '\n\n推奨対応:\n' + error.suggestions.map(s => `• ${s}`).join('\n')
    }

    // リトライ可能な場合は追加
    if (error.retryable) {
      message += '\n\n操作を再試行してください。'
    }

    switch (error.severity) {
      case ErrorSeverity.LOW:
        ElMessage.warning(message)
        break
      case ErrorSeverity.MEDIUM:
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        ElMessage.error(message)
        break
    }
  }

  /**
   * エラーIDを生成
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * エラー履歴を取得
   */
  getErrorHistory(): AppError[] {
    return [...this.errorHistory]
  }

  /**
   * カテゴリ別エラー履歴を取得
   */
  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return this.errorHistory.filter(error => error.category === category)
  }

  /**
   * 重要度別エラー履歴を取得
   */
  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.errorHistory.filter(error => error.severity === severity)
  }

  /**
   * エラー履歴をクリア
   */
  clearErrorHistory(): void {
    this.errorHistory = []
    logger.log(LogLevel.INFO, 'ERROR_HANDLER', 'Error history cleared')
  }

  /**
   * エラー統計を取得
   */
  getErrorStats(): {
    total: number
    byCategory: Record<string, number>
    bySeverity: Record<string, number>
    recent24h: number
  } {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    let recent24h = 0

    this.errorHistory.forEach(error => {
      // カテゴリ別
      byCategory[error.category] = (byCategory[error.category] || 0) + 1
      
      // 重要度別
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1
      
      // 24時間以内
      if (new Date(error.timestamp) > yesterday) {
        recent24h++
      }
    })

    return {
      total: this.errorHistory.length,
      byCategory,
      bySeverity,
      recent24h
    }
  }

  /**
   * エラーパターンを分析
   */
  analyzeErrorPatterns(): ErrorPattern[] {
    const patterns: Map<string, ErrorPattern> = new Map()
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    this.errorHistory.forEach(error => {
      const errorTime = new Date(error.timestamp)
      const patternKey = `${error.category}:${error.technicalMessage?.split(':')[0] || 'unknown'}`
      
      if (!patterns.has(patternKey)) {
        patterns.set(patternKey, {
          category: error.category,
          pattern: error.technicalMessage?.split(':')[0] || 'unknown',
          frequency: 0,
          lastOccurrence: error.timestamp,
          severity: error.severity,
          recentOccurrences: 0,
          hourlyOccurrences: 0,
          suggestedFix: this.generateSuggestedFix(error),
          affectedComponents: new Set(),
          errorIds: []
        })
      }

      const pattern = patterns.get(patternKey)!
      pattern.frequency++
      pattern.errorIds.push(error.id)
      
      if (errorTime > oneHourAgo) {
        pattern.hourlyOccurrences++
      }
      
      if (errorTime > oneDayAgo) {
        pattern.recentOccurrences++
      }

      if (error.context?.component) {
        pattern.affectedComponents.add(error.context.component as string)
      }

      // より新しいエラーの重要度を採用
      if (errorTime > new Date(pattern.lastOccurrence)) {
        pattern.lastOccurrence = error.timestamp
        pattern.severity = error.severity
      }
    })

    return Array.from(patterns.values())
      .filter(pattern => pattern.frequency > 1) // 2回以上発生したパターンのみ
      .sort((a, b) => b.frequency - a.frequency) // 頻度順でソート
  }

  /**
   * 高頻度エラーパターンを取得
   */
  getHighFrequencyPatterns(threshold: number = 3): ErrorPattern[] {
    return this.analyzeErrorPatterns()
      .filter(pattern => pattern.frequency >= threshold)
  }

  /**
   * 最近のエラートレンドを分析
   */
  analyzeRecentTrends(): ErrorTrend[] {
    const trends: ErrorTrend[] = []
    const now = new Date()
    const intervals = [
      { name: '過去1時間', duration: 60 * 60 * 1000 },
      { name: '過去6時間', duration: 6 * 60 * 60 * 1000 },
      { name: '過去24時間', duration: 24 * 60 * 60 * 1000 }
    ]

    intervals.forEach(interval => {
      const startTime = new Date(now.getTime() - interval.duration)
      const errorsInInterval = this.errorHistory.filter(
        error => new Date(error.timestamp) > startTime
      )

      const categoryCount: Record<string, number> = {}
      const severityCount: Record<string, number> = {}

      errorsInInterval.forEach(error => {
        categoryCount[error.category] = (categoryCount[error.category] || 0) + 1
        severityCount[error.severity] = (severityCount[error.severity] || 0) + 1
      })

      trends.push({
        timeframe: interval.name,
        totalErrors: errorsInInterval.length,
        errorRate: errorsInInterval.length / (interval.duration / (60 * 60 * 1000)), // エラー/時間
        topCategories: Object.entries(categoryCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([category, count]) => ({ category, count })),
        severityDistribution: severityCount,
        isIncreasing: this.isErrorRateIncreasing(interval.duration)
      })
    })

    return trends
  }

  /**
   * エラー率が増加傾向にあるかを判定
   */
  private isErrorRateIncreasing(duration: number): boolean {
    const now = new Date()
    const currentPeriodStart = new Date(now.getTime() - duration)
    const previousPeriodStart = new Date(now.getTime() - duration * 2)

    const currentPeriodErrors = this.errorHistory.filter(
      error => new Date(error.timestamp) > currentPeriodStart
    ).length

    const previousPeriodErrors = this.errorHistory.filter(
      error => {
        const errorTime = new Date(error.timestamp)
        return errorTime > previousPeriodStart && errorTime <= currentPeriodStart
      }
    ).length

    return currentPeriodErrors > previousPeriodErrors
  }

  /**
   * 修復提案を生成
   */
  private generateSuggestedFix(error: AppError): string {
    const category = error.category
    const message = error.technicalMessage?.toLowerCase() || ''

    // カテゴリ別の修復提案
    switch (category) {
      case ErrorCategory.RECORDING_START:
        if (message.includes('permission') || message.includes('access')) {
          return 'ブラウザの設定でマイクアクセスを許可してください'
        }
        if (message.includes('device') || message.includes('microphone')) {
          return 'マイクが正しく接続されているか確認してください'
        }
        return 'マイクの設定を確認し、ブラウザを再起動してください'

      case ErrorCategory.AUDIO_CONVERSION:
        if (message.includes('decode') || message.includes('format')) {
          return '音声形式が対応していない可能性があります。録音設定を確認してください'
        }
        if (message.includes('memory') || message.includes('buffer')) {
          return 'メモリ不足の可能性があります。他のアプリケーションを閉じてください'
        }
        return '音声処理でエラーが発生しました。録音を再試行してください'

      case ErrorCategory.FILE_WRITE:
        if (message.includes('permission') || message.includes('access')) {
          return '保存先フォルダの書き込み権限を確認してください'
        }
        if (message.includes('space') || message.includes('disk')) {
          return 'ディスク容量が不足している可能性があります'
        }
        return 'ファイル保存でエラーが発生しました。保存先を変更してください'

      case ErrorCategory.IPC_COMMUNICATION:
        return 'アプリケーション内部の通信エラーです。アプリケーションを再起動してください'

      case ErrorCategory.UI_INTERACTION:
        if (message.includes('canvas') || message.includes('render')) {
          return 'グラフィック表示でエラーが発生しました。ページを再読み込みしてください'
        }
        return 'UI操作でエラーが発生しました。ページを再読み込みしてください'

      default:
        return 'システムエラーが発生しました。アプリケーションを再起動してください'
    }
  }

  /**
   * システム健全性レポートを生成
   */
  generateHealthReport(): SystemHealthReport {
    const stats = this.getErrorStats()
    const patterns = this.analyzeErrorPatterns()
    const trends = this.analyzeRecentTrends()
    const criticalErrors = this.errorHistory.filter(
      error => error.severity === ErrorSeverity.CRITICAL
    )

    // 健全性スコア計算（0-100）
    let healthScore = 100
    
    // 最近のエラー数による減点
    healthScore -= Math.min(stats.recent24h * 2, 30)
    
    // 高頻度パターンによる減点
    const highFreqPatterns = patterns.filter(p => p.frequency >= 5)
    healthScore -= highFreqPatterns.length * 10
    
    // 致命的エラーによる減点
    healthScore -= criticalErrors.length * 15
    
    // エラー率増加による減点
    const increasingTrends = trends.filter(t => t.isIncreasing)
    healthScore -= increasingTrends.length * 5

    healthScore = Math.max(0, healthScore)

    // 健全性レベル判定
    let healthLevel: 'excellent' | 'good' | 'warning' | 'critical'
    if (healthScore >= 90) healthLevel = 'excellent'
    else if (healthScore >= 70) healthLevel = 'good'
    else if (healthScore >= 50) healthLevel = 'warning'
    else healthLevel = 'critical'

    // 推奨アクション生成
    const recommendations: string[] = []
    
    if (stats.recent24h > 10) {
      recommendations.push('最近のエラー発生率が高いため、システムの安定性を確認してください')
    }
    
    if (highFreqPatterns.length > 0) {
      recommendations.push(`${highFreqPatterns.length}個の高頻度エラーパターンが検出されました`)
    }
    
    if (criticalErrors.length > 0) {
      recommendations.push('致命的エラーが発生しています。緊急対応が必要です')
    }
    
    if (increasingTrends.length > 0) {
      recommendations.push('エラー発生率が増加傾向にあります。予防的対策を検討してください')
    }

    if (recommendations.length === 0) {
      recommendations.push('システムは正常に動作しています')
    }

    return {
      healthScore,
      healthLevel,
      totalErrors: stats.total,
      recentErrors: stats.recent24h,
      criticalErrors: criticalErrors.length,
      highFrequencyPatterns: highFreqPatterns.length,
      recommendations,
      lastUpdated: new Date().toISOString()
    }
  }
}

// シングルトンインスタンス
export const errorHandler = new ErrorHandler()

/**
 * カテゴリ別のエラーハンドラー作成ヘルパー
 */
export function createCategoryErrorHandler(category: ErrorCategory) {
  return {
    handle: (error: unknown, context?: Partial<Omit<ErrorContext, 'category'>>) =>
      errorHandler.handle(error, { ...context, category }),
    
    handleCritical: (error: unknown, context?: Partial<Omit<ErrorContext, 'category'>>) =>
      errorHandler.handleCritical(error, { ...context, category }),
    
    create: (message: string, context: Omit<ErrorContext, 'category'>) =>
      errorHandler.createError(message, { ...context, category })
  }
}

// 型定義を追加
export interface ErrorPattern {
  category: ErrorCategory
  pattern: string
  frequency: number
  lastOccurrence: string
  severity: ErrorSeverity
  recentOccurrences: number
  hourlyOccurrences: number
  suggestedFix: string
  affectedComponents: Set<string>
  errorIds: string[]
}

export interface ErrorTrend {
  timeframe: string
  totalErrors: number
  errorRate: number
  topCategories: Array<{ category: string; count: number }>
  severityDistribution: Record<string, number>
  isIncreasing: boolean
}

export interface SystemHealthReport {
  healthScore: number
  healthLevel: 'excellent' | 'good' | 'warning' | 'critical'
  totalErrors: number
  recentErrors: number
  criticalErrors: number
  highFrequencyPatterns: number
  recommendations: string[]
  lastUpdated: string
}