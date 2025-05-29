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