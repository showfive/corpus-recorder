import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { promises as fsPromises } from 'fs'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import { readAndParseTextFile, getSupportedExtensions } from './services/textFileService'
import { AudioFileMetadata } from '../common/types'
import { addMetadataToWav } from './utils/wavMetadata'

// ESモジュールで__dirnameを取得
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// IPC通信のチャンネル名を直接定義
const IPC_CHANNELS = {
  SELECT_DIRECTORY: 'select-directory',
  SAVE_AUDIO_FILE: 'save-audio-file',
  SAVE_AUDIO_FILE_WITH_METADATA: 'save-audio-file-with-metadata',
  DELETE_AUDIO_FILE: 'delete-audio-file',
  READ_TEXT_FILE: 'read-text-file',
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  APP_READY: 'app-ready'
} as const

// アプリケーション設定の型定義
interface AppSettings {
  recordingDirectory: string
  lastOpenedTextFile?: string
  lastTextIndex?: number
}

// electron-storeの初期化
const store = new Store({
  defaults: {
    recordingDirectory: path.join(app.getPath('documents'), 'CorpusRecordings')
  }
}) as any

let mainWindow: BrowserWindow | null = null

const createMenu = () => {
  const template: any[] = [
    {
      label: 'アプリケーション',
      submenu: [
        {
          label: 'Corpus Recorderについて',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: '終了',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '表示',
      submenu: [
        {
          label: 'リロード',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload()
            }
          }
        },
        {
          label: '開発者ツール',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools()
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

const createWindow = () => {
  // __dirnameの値を確認
  console.log('Current __dirname:', __dirname)
  console.log('Process cwd:', process.cwd())
  
  // 開発環境と本番環境でpreloadスクリプトのパスを切り替え
  const preloadPath = process.env.VITE_DEV_SERVER_URL 
    ? path.join(process.cwd(), 'electron/preload.cjs')
    : path.join(__dirname, 'preload.cjs')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
      webSecurity: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    trafficLightPosition: { x: 10, y: 10 }
  })

  // preloadスクリプトのパス確認用ログ
  console.log('Preload path:', preloadPath)
  console.log('File exists:', fs.existsSync(preloadPath))
  console.log('Directory contents:', fs.readdirSync(__dirname))

  // 開発環境とプロダクション環境で読み込むURLを切り替え
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // 開発者ツールは必要に応じて手動で開く
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC通信のハンドラー設定

// ディレクトリ選択
ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory']
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0]
    store.set('recordingDirectory', selectedPath)
    return selectedPath
  }
  
  return null
})

// 音声ファイルの保存
ipcMain.handle(IPC_CHANNELS.SAVE_AUDIO_FILE, async (_, arrayBuffer: ArrayBuffer, fileName: string) => {
  try {
    const recordingDir = store.get('recordingDirectory')
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(recordingDir)) {
      await fsPromises.mkdir(recordingDir, { recursive: true })
    }
    
    const filePath = path.join(recordingDir, fileName)
    const buffer = Buffer.from(arrayBuffer)
    
    await fsPromises.writeFile(filePath, buffer)
    
    return { success: true, filePath }
  } catch (error) {
    console.error('Failed to save audio file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }  }
})

// メタデータ付き音声ファイルの保存
ipcMain.handle(IPC_CHANNELS.SAVE_AUDIO_FILE_WITH_METADATA, async (_, arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata) => {
  try {
    const recordingDir = store.get('recordingDirectory')
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(recordingDir)) {
      await fsPromises.mkdir(recordingDir, { recursive: true })
    }
    
    // WAVファイルにメタデータを追加
    const wavWithMetadata = addMetadataToWav(arrayBuffer, metadata)
    
    const filePath = path.join(recordingDir, metadata.fileName)
    const buffer = Buffer.from(wavWithMetadata)
    
    await fsPromises.writeFile(filePath, buffer)
    
    return { success: true, filePath }
  } catch (error) {
    console.error('Failed to save audio file with metadata:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// 音声ファイルの削除
ipcMain.handle(IPC_CHANNELS.DELETE_AUDIO_FILE, async (_, filePath: string) => {
  try {
    await fsPromises.unlink(filePath)
    return { success: true }
  } catch (error) {
    console.error('Failed to delete audio file:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// テキストファイルの読み込み
ipcMain.handle(IPC_CHANNELS.READ_TEXT_FILE, async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: getSupportedExtensions() },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    try {
      // textFileService を使用してファイルを読み込み、解析する
      const parseResult = await readAndParseTextFile(filePath)
      store.set('lastOpenedTextFile', filePath) // 最後に開いたファイルを保存
      return parseResult // 解析結果全体を返す
    } catch (error) {
      console.error('Failed to read or parse text file:', error)
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
  return null
})

// 設定の取得
ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
  return store.store
})

// 設定の更新
ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, (_, settings: Partial<AppSettings>) => {
  Object.entries(settings).forEach(([key, value]) => {
    store.set(key as keyof AppSettings, value)
  })
  return store.store
})