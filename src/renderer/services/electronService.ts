import { AppSettings, AudioFileMetadata, TextFileReadResult } from '../../common/types'

/**
 * Electron APIを抽象化するサービスクラス
 * IPC通信の詳細をコンポーネントから隠蔽し、テスト容易性を向上させる
 */
class ElectronService {
  private api = (window as any).electronAPI

  constructor() {
    if (!this.api) {
      throw new Error('ElectronAPI is not available. Ensure preload script is loaded.')
    }
  }

  /**
   * ディレクトリ選択ダイアログを開く
   */
  async selectDirectory(): Promise<string | null> {
    return this.api.selectDirectory()
  }

  /**
   * メタデータ付きで音声ファイルを保存する
   */
  async saveAudioFileWithMetadata(arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata): Promise<{ success: boolean; filePath?: string; error?: string }> {
    return this.api.saveAudioFileWithMetadata(arrayBuffer, metadata)
  }

  /**
   * テキストファイルを読み込む
   */
  async readTextFile(): Promise<TextFileReadResult | null> {
    return this.api.readTextFile()
  }

  /**
   * アプリケーション設定を取得する
   */
  async getSettings(): Promise<Partial<AppSettings>> {
    return this.api.getSettings()
  }

  /**
   * アプリケーション設定を更新する
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<Partial<AppSettings>> {
    return this.api.updateSettings(settings)
  }

  /**
   * 音声ファイルを削除する
   */
  async deleteAudioFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.api.deleteAudioFile(filePath)
  }
}

// シングルトンインスタンスとしてエクスポート
export const electronService = new ElectronService()
