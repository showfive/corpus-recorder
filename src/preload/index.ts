import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AudioFileMetadata, type TextFileReadResult, type AppSettings } from '../common/types'

console.log('=== Preload script started ===')

const electronAPI = {
  // ディレクトリ選択
  selectDirectory: (): Promise<string | null> => {
    console.log('selectDirectory called')
    return ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY)
  },
    // 音声ファイルの保存
  saveAudioFile: (arrayBuffer: ArrayBuffer, fileName: string): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    console.log('saveAudioFile called:', fileName)
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_AUDIO_FILE, arrayBuffer, fileName)
  },
    // メタデータ付き音声ファイルの保存
  saveAudioFileWithMetadata: (arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    console.log('saveAudioFileWithMetadata called:', metadata.fileName)
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_AUDIO_FILE_WITH_METADATA, arrayBuffer, metadata)
  },
  
  // 音声ファイルの削除
  deleteAudioFile: (filePath: string): Promise<{ success: boolean; error?: string }> => {
    console.log('deleteAudioFile called:', filePath)
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_AUDIO_FILE, filePath)
  },
  
  // テキストファイルの読み込み
  readTextFile: (): Promise<TextFileReadResult | null> => {
    console.log('readTextFile called')
    return ipcRenderer.invoke(IPC_CHANNELS.READ_TEXT_FILE)
  },
  
  // 設定の取得
  getSettings: (): Promise<Partial<AppSettings>> => {
    console.log('getSettings called')
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS)
  },
  
  // 設定の更新
  updateSettings: (settings: Partial<AppSettings>): Promise<Partial<AppSettings>> => {
    console.log('updateSettings called:', settings)
    return ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings)
  }
}

// カスタムAPIをレンダラープロセスに公開
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  console.log('=== ElectronAPI successfully exposed ===')
  console.log('Available methods:', Object.keys(electronAPI))
} catch (error) {
  console.error('Failed to expose ElectronAPI:', error)
}

// DOMが読み込まれた後に実行されることを確認
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== DOM loaded, checking ElectronAPI ===')
  console.log('window.electronAPI:', typeof (window as any).electronAPI)
})

console.log('=== Preload script completed ===') 