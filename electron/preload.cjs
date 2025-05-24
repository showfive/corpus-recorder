const { contextBridge, ipcRenderer } = require('electron')

console.log('=== Preload script started ===')

// IPC通信のチャンネル名を直接定義
const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'select-directory',
  SAVE_AUDIO_FILE: 'save-audio-file',
  DELETE_AUDIO_FILE: 'delete-audio-file',
  READ_TEXT_FILE: 'read-text-file',
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  APP_READY: 'app-ready'
}

const electronAPI = {
  // ディレクトリ選択
  selectDirectory: () => {
    console.log('selectDirectory called')
    return ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY)
  },
  
  // 音声ファイルの保存
  saveAudioFile: (arrayBuffer, fileName) => {
    console.log('saveAudioFile called:', fileName)
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_AUDIO_FILE, arrayBuffer, fileName)
  },
  
  // 音声ファイルの削除
  deleteAudioFile: (filePath) => {
    console.log('deleteAudioFile called:', filePath)
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_AUDIO_FILE, filePath)
  },
  
  // テキストファイルの読み込み
  readTextFile: () => {
    console.log('readTextFile called')
    return ipcRenderer.invoke(IPC_CHANNELS.READ_TEXT_FILE)
  },
  
  // 設定の取得
  getSettings: () => {
    console.log('getSettings called')
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS)
  },
  
  // 設定の更新
  updateSettings: (settings) => {
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
  console.log('window.electronAPI:', typeof window.electronAPI)
})

console.log('=== Preload script completed ===') 