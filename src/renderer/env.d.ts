/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron API の型定義
interface ElectronAPI {
  selectDirectory: () => Promise<string | null>
  saveAudioFile: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  deleteAudioFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  readTextFile: () => Promise<{ filePath: string; content: string } | null>
  getSettings: () => Promise<any>
  updateSettings: (settings: any) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
} 