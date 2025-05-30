import { z } from 'zod'
import { createLogger } from '../logger'
import { 
  TypeValidationResult, 
  TypeValidationError, 
  TypeValidationWarning,
  CustomValidator,
  AsyncValidator,
  FilePath,
  DirectoryPath,
  IPCChannelTemplate
} from '../schemas/advanced-types'

const logger = createLogger('CustomValidators')

// ===========================================
// カスタムバリデーターコレクション
// ===========================================

/**
 * ファイルパスバリデーター
 */
export const filePathValidator: CustomValidator<FilePath> = (value: unknown): TypeValidationResult<FilePath> => {
  if (typeof value !== 'string') {
    return {
      success: false,
      errors: [{
        path: '',
        expected: 'string',
        received: typeof value,
        code: 'INVALID_TYPE',
        message: 'ファイルパスは文字列である必要があります'
      }]
    }
  }

  const errors: TypeValidationError[] = []
  const warnings: TypeValidationWarning[] = []

  // 無効な文字チェック
  const invalidChars = /[<>:"|?*]/
  if (invalidChars.test(value)) {
    errors.push({
      path: '',
      expected: 'valid file path',
      received: value,
      code: 'INVALID_CHARACTERS',
      message: 'ファイルパスに無効な文字が含まれています: < > : " | ? *'
    })
  }

  // 長さチェック
  if (value.length > 260) {
    errors.push({
      path: '',
      expected: 'path length <= 260',
      received: `length: ${value.length}`,
      code: 'PATH_TOO_LONG',
      message: 'ファイルパスが長すぎます（260文字以下である必要があります）'
    })
  }

  // 空文字チェック
  if (value.trim().length === 0) {
    errors.push({
      path: '',
      expected: 'non-empty path',
      received: 'empty string',
      code: 'EMPTY_PATH',
      message: 'ファイルパスを空にすることはできません'
    })
  }

  // 相対パス警告
  if (value.includes('..')) {
    warnings.push({
      path: '',
      message: '相対パス（..）の使用は推奨されません',
      suggestion: '絶対パスの使用を検討してください'
    })
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  return {
    success: true,
    data: value as FilePath,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * ディレクトリパスバリデーター
 */
export const directoryPathValidator: CustomValidator<DirectoryPath> = (value: unknown): TypeValidationResult<DirectoryPath> => {
  const fileResult = filePathValidator(value)
  
  if (!fileResult.success || !fileResult.data) {
    return {
      success: false,
      errors: fileResult.errors,
      warnings: fileResult.warnings
    }
  }

  const errors: TypeValidationError[] = []
  const warnings: TypeValidationWarning[] = [...(fileResult.warnings || [])]

  // ファイル拡張子チェック（ディレクトリには拡張子があってはいけない）
  if (/\.[a-zA-Z0-9]+$/.test(fileResult.data)) {
    warnings.push({
      path: '',
      message: 'ディレクトリパスにファイル拡張子が含まれています',
      suggestion: 'ディレクトリパスであることを確認してください'
    })
  }

  return {
    success: true,
    data: fileResult.data as unknown as DirectoryPath,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * 音声品質設定バリデーター
 */
export const audioQualityValidator: CustomValidator<{
  sampleRate?: number
  channels?: number
  bitDepth?: number
}> = (value: unknown): TypeValidationResult<any> => {
  if (typeof value !== 'object' || value === null) {
    return {
      success: false,
      errors: [{
        path: '',
        expected: 'object',
        received: typeof value,
        code: 'INVALID_TYPE',
        message: '音声品質設定はオブジェクトである必要があります'
      }]
    }
  }

  const obj = value as any
  const errors: TypeValidationError[] = []
  const warnings: TypeValidationWarning[] = []

  // サンプルレート検証
  if (obj.sampleRate !== undefined) {
    if (typeof obj.sampleRate !== 'number' || obj.sampleRate <= 0) {
      errors.push({
        path: 'sampleRate',
        expected: 'positive number',
        received: String(obj.sampleRate),
        code: 'INVALID_SAMPLE_RATE',
        message: 'サンプルレートは正の数値である必要があります'
      })
    } else {
      // 一般的なサンプルレートの検証
      const standardRates = [8000, 16000, 22050, 44100, 48000, 96000, 192000]
      if (!standardRates.includes(obj.sampleRate)) {
        warnings.push({
          path: 'sampleRate',
          message: `非標準的なサンプルレートです: ${obj.sampleRate}Hz`,
          suggestion: `標準的なレート (${standardRates.join(', ')}Hz) の使用を検討してください`
        })
      }
    }
  }

  // チャンネル数検証
  if (obj.channels !== undefined) {
    if (typeof obj.channels !== 'number' || obj.channels < 1 || obj.channels > 8) {
      errors.push({
        path: 'channels',
        expected: 'number between 1 and 8',
        received: String(obj.channels),
        code: 'INVALID_CHANNELS',
        message: 'チャンネル数は1-8の範囲である必要があります'
      })
    }
  }

  // ビット深度検証
  if (obj.bitDepth !== undefined) {
    if (typeof obj.bitDepth !== 'number' || ![8, 16, 24, 32].includes(obj.bitDepth)) {
      errors.push({
        path: 'bitDepth',
        expected: '8, 16, 24, or 32',
        received: String(obj.bitDepth),
        code: 'INVALID_BIT_DEPTH',
        message: 'ビット深度は8, 16, 24, 32のいずれかである必要があります'
      })
    }
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  return {
    success: true,
    data: obj,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

// ===========================================
// 非同期バリデーター
// ===========================================

/**
 * ファイル存在確認バリデーター（Node.js環境のみ）
 */
export const fileExistsValidator: AsyncValidator<FilePath> = async (value: unknown): Promise<TypeValidationResult<FilePath>> => {
  const pathResult = filePathValidator(value)
  
  if (!pathResult.success || !pathResult.data) {
    return pathResult
  }

  try {
    // Electronのメインプロセスでのみ利用可能
    if (typeof require !== 'undefined') {
      const fs = require('fs').promises
      await fs.access(pathResult.data)
      
      return {
        success: true,
        data: pathResult.data,
        warnings: pathResult.warnings
      }
    } else {
      return {
        success: true,
        data: pathResult.data,
        warnings: [
          ...(pathResult.warnings || []),
          {
            path: '',
            message: 'ファイル存在確認をスキップしました（レンダラープロセス）',
            suggestion: 'メインプロセスでの検証を推奨します'
          }
        ]
      }
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        path: '',
        expected: 'existing file',
        received: pathResult.data,
        code: 'FILE_NOT_EXISTS',
        message: `ファイルが存在しません: ${pathResult.data}`
      }],
      warnings: pathResult.warnings
    }
  }
}

/**
 * ディレクトリ存在確認バリデーター
 */
export const directoryExistsValidator: AsyncValidator<DirectoryPath> = async (value: unknown): Promise<TypeValidationResult<DirectoryPath>> => {
  const pathResult = directoryPathValidator(value)
  
  if (!pathResult.success || !pathResult.data) {
    return pathResult
  }

  try {
    if (typeof require !== 'undefined') {
      const fs = require('fs').promises
      const stat = await fs.stat(pathResult.data)
      
      if (!stat.isDirectory()) {
        return {
          success: false,
          errors: [{
            path: '',
            expected: 'directory',
            received: 'file',
            code: 'NOT_DIRECTORY',
            message: `指定されたパスはディレクトリではありません: ${pathResult.data}`
          }],
          warnings: pathResult.warnings
        }
      }
      
      return {
        success: true,
        data: pathResult.data,
        warnings: pathResult.warnings
      }
    } else {
      return {
        success: true,
        data: pathResult.data,
        warnings: [
          ...(pathResult.warnings || []),
          {
            path: '',
            message: 'ディレクトリ存在確認をスキップしました（レンダラープロセス）',
            suggestion: 'メインプロセスでの検証を推奨します'
          }
        ]
      }
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        path: '',
        expected: 'existing directory',
        received: pathResult.data,
        code: 'DIRECTORY_NOT_EXISTS',
        message: `ディレクトリが存在しません: ${pathResult.data}`
      }],
      warnings: pathResult.warnings
    }
  }
}

// ===========================================
// バリデーターコンポジション
// ===========================================

/**
 * 複数のバリデーターを組み合わせる
 */
export function composeValidators<T>(...validators: CustomValidator<T>[]): CustomValidator<T> {
  return (value: unknown): TypeValidationResult<T> => {
    const allErrors: TypeValidationError[] = []
    const allWarnings: TypeValidationWarning[] = []
    let lastValidData: T | undefined

    for (const validator of validators) {
      const result = validator(value)
      
      if (result.errors) {
        allErrors.push(...result.errors)
      }
      
      if (result.warnings) {
        allWarnings.push(...result.warnings)
      }
      
      if (result.success && result.data) {
        lastValidData = result.data
      }
      
      // 最初のエラーで停止
      if (!result.success) {
        break
      }
    }

    if (allErrors.length > 0) {
      return {
        success: false,
        errors: allErrors,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      }
    }

    return {
      success: true,
      data: lastValidData,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    }
  }
}

/**
 * 非同期バリデーターを組み合わせる
 */
export function composeAsyncValidators<T>(...validators: AsyncValidator<T>[]): AsyncValidator<T> {
  return async (value: unknown): Promise<TypeValidationResult<T>> => {
    const allErrors: TypeValidationError[] = []
    const allWarnings: TypeValidationWarning[] = []
    let lastValidData: T | undefined

    for (const validator of validators) {
      const result = await validator(value)
      
      if (result.errors) {
        allErrors.push(...result.errors)
      }
      
      if (result.warnings) {
        allWarnings.push(...result.warnings)
      }
      
      if (result.success && result.data) {
        lastValidData = result.data
      }
      
      // 最初のエラーで停止
      if (!result.success) {
        break
      }
    }

    if (allErrors.length > 0) {
      return {
        success: false,
        errors: allErrors,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      }
    }

    return {
      success: true,
      data: lastValidData,
      warnings: allWarnings.length > 0 ? allWarnings : undefined
    }
  }
}

// ===========================================
// 型変換とサニタイゼーション
// ===========================================

/**
 * 型変換ヘルパー
 */
export class TypeConverter {
  /**
   * 文字列を数値に安全に変換
   */
  static stringToNumber(value: string): TypeValidationResult<number> {
    const trimmed = value.trim()
    
    if (trimmed === '') {
      return {
        success: false,
        errors: [{
          path: '',
          expected: 'non-empty string',
          received: 'empty string',
          code: 'EMPTY_STRING',
          message: '空文字列を数値に変換することはできません'
        }]
      }
    }

    const num = Number(trimmed)
    
    if (isNaN(num)) {
      return {
        success: false,
        errors: [{
          path: '',
          expected: 'numeric string',
          received: value,
          code: 'NOT_A_NUMBER',
          message: '数値に変換できない文字列です'
        }]
      }
    }

    const warnings: TypeValidationWarning[] = []
    
    // 無限大チェック
    if (!isFinite(num)) {
      return {
        success: false,
        errors: [{
          path: '',
          expected: 'finite number',
          received: String(num),
          code: 'INFINITE_NUMBER',
          message: '無限大の値は許可されていません'
        }]
      }
    }

    // 精度警告
    if (trimmed.includes('.') && trimmed.split('.')[1].length > 10) {
      warnings.push({
        path: '',
        message: '高精度の小数点以下の桁数が検出されました',
        suggestion: '精度の低下が発生する可能性があります'
      })
    }

    return {
      success: true,
      data: num,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  /**
   * 真偽値に安全に変換
   */
  static toBoolean(value: unknown): TypeValidationResult<boolean> {
    if (typeof value === 'boolean') {
      return { success: true, data: value }
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim()
      if (['true', '1', 'yes', 'on'].includes(lower)) {
        return { success: true, data: true }
      }
      if (['false', '0', 'no', 'off'].includes(lower)) {
        return { success: true, data: false }
      }
    }

    if (typeof value === 'number') {
      return { success: true, data: value !== 0 }
    }

    return {
      success: false,
      errors: [{
        path: '',
        expected: 'boolean convertible value',
        received: String(value),
        code: 'NOT_BOOLEAN_CONVERTIBLE',
        message: '真偽値に変換できない値です'
      }]
    }
  }
}

// ===========================================
// エクスポート
// ===========================================

export const customValidators = {
  filePath: filePathValidator,
  directoryPath: directoryPathValidator,
  audioQuality: audioQualityValidator,
  fileExists: fileExistsValidator,
  directoryExists: directoryExistsValidator,
  compose: composeValidators,
  composeAsync: composeAsyncValidators,
  TypeConverter
} as const 