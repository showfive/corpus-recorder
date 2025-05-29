/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron API の型定義
import type { AppSettings, AudioFileMetadata, TextFileReadResult } from '../common/types'

interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  saveAudioFile: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveAudioFileWithMetadata: (arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  deleteAudioFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  readTextFile: () => Promise<TextFileReadResult | null>;
  getSettings: () => Promise<Partial<AppSettings>>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<Partial<AppSettings>>;
}

interface Window {
  electronAPI: ElectronAPI;
}