import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// Element Plus のモック設定
config.global.stubs = {
  'el-button': true,
  'el-input': true,
  'el-tag': true,
  'el-card': true,
  'el-message': true,
  'el-message-box': true,
  'el-input-number': true,
  'el-select': true,
  'el-option': true,
  'el-checkbox': true,
  'el-drawer': true,
  'el-tabs': true,
  'el-tab-pane': true,
  'el-descriptions': true,
  'el-descriptions-item': true,
  'el-alert': true,
  'el-button-group': true,
  'el-row': true,
  'el-col': true,
}

// グローバルモックの設定
Object.defineProperty(window, 'electronAPI', {
  value: {
    selectDirectory: vi.fn(),
    saveAudioFileWithMetadata: vi.fn(),
    readTextFile: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    deleteAudioFile: vi.fn(),
  },
  writable: true,
})

// Web Audio API のモック
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(),
  createMediaStreamSource: vi.fn(),
  close: vi.fn(),
  state: 'running',
}))

// MediaRecorderのモック（isTypeSupportedメソッドを含む）
const MediaRecorderMock = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
}))

// 静的メソッドの追加
MediaRecorderMock.isTypeSupported = vi.fn().mockReturnValue(true)

global.MediaRecorder = MediaRecorderMock as any

// getUserMedia のモック
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([
        { stop: vi.fn() }
      ])
    }),
  },
  writable: true,
})

// Worker のモック
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

// Canvas のモック
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
})

// ResizeObserver のモック
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) 