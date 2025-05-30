import { ref, nextTick } from 'vue'
import { createLogger } from '../../common/logger'

const logger = createLogger('CanvasManager')

export interface CanvasConfig {
  minWidth?: number
  minHeight?: number
  backgroundColor?: string
  centerLineColor?: string
  enableHighDPI?: boolean
}

export function useCanvasManager(componentName: string, config: CanvasConfig = {}) {
  const canvas = ref<HTMLCanvasElement>()
  const isSetup = ref(false)
  
  const defaultConfig: Required<CanvasConfig> = {
    minWidth: 400,
    minHeight: 200,
    backgroundColor: '#1a1a1a',
    centerLineColor: '#4ade80',
    enableHighDPI: true,
    ...config
  }

  /**
   * キャンバスの基本設定
   */
  const setupCanvas = async (): Promise<boolean> => {
    const canvasElement = canvas.value
    if (!canvasElement) {
      logger.warn('Canvas element not available for setup', {
        component: componentName,
        method: 'setupCanvas'
      })
      return false
    }
    
    // キャンバスサイズを親要素に合わせる
    const container = canvasElement.parentElement
    if (!container) {
      logger.warn('Canvas container not found', {
        component: componentName,
        method: 'setupCanvas'
      })
      return false
    }

    const rect = container.getBoundingClientRect()
    logger.debug('Container rect measurements', { 
      rect,
      component: componentName 
    })
    
    // 親要素のサイズが0の場合は少し待ってから再試行
    if (rect.width === 0 || rect.height === 0) {
      logger.warn('Container size is 0, retrying in 50ms', {
        containerSize: { width: rect.width, height: rect.height },
        retryDelay: 50,
        component: componentName
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
      return setupCanvas() // 再帰的に再試行
    }
    
    // 最小サイズを確保
    const width = Math.max(rect.width, defaultConfig.minWidth)
    const height = Math.max(rect.height, defaultConfig.minHeight)
    
    canvasElement.width = width
    canvasElement.height = height
    
    logger.debug('Canvas size configured', { 
      width: canvasElement.width, 
      height: canvasElement.height,
      component: componentName
    })
    
    // 高DPI対応
    if (defaultConfig.enableHighDPI) {
      const ctx = canvasElement.getContext('2d')
      if (ctx) {
        const devicePixelRatio = window.devicePixelRatio || 1
        if (devicePixelRatio > 1) {
          canvasElement.width = width * devicePixelRatio
          canvasElement.height = height * devicePixelRatio
          canvasElement.style.width = width + 'px'
          canvasElement.style.height = height + 'px'
          ctx.scale(devicePixelRatio, devicePixelRatio)
          logger.debug('High DPI scaling applied', { 
            devicePixelRatio,
            component: componentName 
          })
        }
      }
    }
    
    isSetup.value = true
    return true
  }

  /**
   * 基本的な波形（無音時）を描画
   */
  const drawBasicWaveform = () => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)
    
    // 背景色を設定
    ctx.fillStyle = defaultConfig.backgroundColor
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height)
    
    // 中央線を描画（無音時の基準線）
    ctx.strokeStyle = defaultConfig.centerLineColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, canvasElement.height / 2)
    ctx.lineTo(canvasElement.width, canvasElement.height / 2)
    ctx.stroke()
    
    logger.debug('Basic waveform drawn', {
      canvasSize: { width: canvasElement.width, height: canvasElement.height },
      component: componentName
    })
  }

  /**
   * キャンバスをクリア
   */
  const clearCanvas = () => {
    const canvasElement = canvas.value
    if (!canvasElement) return
    
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height)
    logger.debug('Canvas cleared', { component: componentName })
  }

  /**
   * キャンバスのサイズを取得
   */
  const getCanvasSize = () => {
    const canvasElement = canvas.value
    if (!canvasElement) return null
    
    return {
      width: canvasElement.width,
      height: canvasElement.height,
      displayWidth: canvasElement.style.width,
      displayHeight: canvasElement.style.height
    }
  }

  /**
   * リサイズハンドラー
   */
  const handleResize = async () => {
    if (canvas.value && isSetup.value) {
      logger.debug('Handling canvas resize', { component: componentName })
      await setupCanvas()
      drawBasicWaveform()
    }
  }

  /**
   * 初期化（セットアップ + 基本描画）
   */
  const initialize = async (): Promise<boolean> => {
    logger.info('Initializing canvas', { component: componentName })
    
    await nextTick() // DOMの更新を待つ
    
    const success = await setupCanvas()
    if (success) {
      drawBasicWaveform()
      logger.info('Canvas initialization completed', { component: componentName })
    } else {
      logger.error('Canvas initialization failed', { component: componentName })
    }
    
    return success
  }

  /**
   * クリーンアップ
   */
  const cleanup = () => {
    if (canvas.value) {
      clearCanvas()
    }
    isSetup.value = false
    logger.debug('Canvas cleanup completed', { component: componentName })
  }

  return {
    // 状態
    canvas,
    isSetup,
    
    // メソッド
    setupCanvas,
    drawBasicWaveform,
    clearCanvas,
    getCanvasSize,
    handleResize,
    initialize,
    cleanup
  }
} 