/// <reference path="../env.d.ts" />

import { container } from '../../common/di/container'
import { AudioFileMetadata } from '../../common/types'

// 型アサーション用のヘルパー
const electronAPI = (window as any).electronAPI

export interface FileOperationResult {
  success: boolean
  error?: string
  filePath?: string
}

export interface SaveOptions {
  defaultPath?: string
  filters?: Array<{
    name: string
    extensions: string[]
  }>
}

/**
 * ファイル操作への統一インターフェース
 * Electronのファイルシステム操作を簡潔にラップ
 */
export class FileFacade {
  constructor() {
    // 必要に応じてファイル関連サービスをDIコンテナから取得
  }

  // ===== ファイル保存 =====
  async saveAudioFile(
    audioData: ArrayBuffer, 
    fileName: string
  ): Promise<FileOperationResult> {
    try {
      const result = await electronAPI.saveAudioFile(audioData, fileName)
      return {
        success: result.success,
        filePath: result.filePath,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async saveAudioFileWithMetadata(
    audioData: ArrayBuffer, 
    metadata: AudioFileMetadata
  ): Promise<FileOperationResult> {
    try {
      const result = await electronAPI.saveAudioFileWithMetadata(audioData, metadata)
      return {
        success: result.success,
        filePath: result.filePath,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async saveTextFile(
    content: string, 
    options: SaveOptions = {}
  ): Promise<FileOperationResult> {
    try {
      const result = await electronAPI.saveFile({
        data: new TextEncoder().encode(content),
        defaultPath: options.defaultPath || 'transcript.txt',
        filters: options.filters || [
          { name: 'Text Files', extensions: ['txt', 'md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      return {
        success: true,
        filePath: result.filePath
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ===== ファイル読み込み =====
  async loadTextFile(): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const result = await electronAPI.readTextFile()
      
      if (!result) {
        return { success: false, error: 'Operation cancelled' }
      }

      return {
        success: result.success,
        content: result.content,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ===== ディレクトリ操作 =====
  async selectDirectory(): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const path = await electronAPI.selectDirectory()
      
      if (!path) {
        return { success: false, error: 'Operation cancelled' }
      }

      return {
        success: true,
        path
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ===== ファイル削除 =====
  async deleteAudioFile(filePath: string): Promise<FileOperationResult> {
    try {
      const result = await electronAPI.deleteAudioFile(filePath)
      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // ===== ユーティリティ =====
  generateFilename(prefix: string, extension: string): string {
    const now = new Date()
    const timestamp = now.toISOString()
      .replace(/[:]/g, '-')
      .replace(/[.]/g, '-')
      .slice(0, 19)
    
    return `${prefix}_${timestamp}.${extension}`
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

// ファサードのファクトリー関数
export function createFileFacade(): FileFacade {
  return new FileFacade()
} 