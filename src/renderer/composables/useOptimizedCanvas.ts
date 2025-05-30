import { ref, onMounted, onUnmounted, computed } from 'vue'
import { createLogger } from '../../common/logger'
import { 
  performanceOptimizer, 
  canvasOptimizer, 
  FPSMonitor,
  uint8ArrayPool,
  floatArrayPool 
} from '../../common/performance'

const logger = createLogger('OptimizedCanvas')

export interface OptimizedCanvasConfig {
  enableWebGL?: boolean
  targetFPS?: number
  minWidth?: number
  minHeight?: number
  backgroundColor?: string
  centerLineColor?: string
  enableHighDPI?: boolean
  enableOffscreen?: boolean
}

export function useOptimizedCanvas(componentName: string, config: OptimizedCanvasConfig = {}) {
  const canvas = ref<HTMLCanvasElement>()
  const isSetup = ref(false)
  const isWebGLSupported = ref(false)
  const fpsMonitor = ref(new FPSMonitor(60))
  const animationId = ref<number | null>(null)

  const defaultConfig: Required<OptimizedCanvasConfig> = {
    enableWebGL: true,
    targetFPS: 60,
    minWidth: 400,
    minHeight: 200,
    backgroundColor: '#1a1a1a',
    centerLineColor: '#4ade80',
    enableHighDPI: true,
    enableOffscreen: false,
    ...config
  }

  // WebGL対応状況を確認
  const checkWebGLSupport = (): boolean => {
    try {
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')
      return !!gl
    } catch (error) {
      logger.warn('WebGL support check failed', { error })
      return false
    }
  }

  // 最適化されたキャンバス設定
  const setupOptimizedCanvas = async (): Promise<boolean> => {
    const canvasElement = canvas.value
    if (!canvasElement) {
      logger.warn('Canvas element not available', { componentName })
      return false
    }

    const container = canvasElement.parentElement
    if (!container) {
      logger.warn('Canvas container not found', { componentName })
      return false
    }

    const rect = container.getBoundingClientRect()
    
    // サイズが0の場合は再試行
    if (rect.width === 0 || rect.height === 0) {
      await new Promise(resolve => setTimeout(resolve, 50))
      return setupOptimizedCanvas()
    }

    // 最適なサイズを計算
    const width = Math.max(rect.width, defaultConfig.minWidth)
    const height = Math.max(rect.height, defaultConfig.minHeight)

    // デバイスピクセル比対応
    const devicePixelRatio = defaultConfig.enableHighDPI ? (window.devicePixelRatio || 1) : 1
    
    canvasElement.width = width * devicePixelRatio
    canvasElement.height = height * devicePixelRatio
    canvasElement.style.width = width + 'px'
    canvasElement.style.height = height + 'px'

    // コンテキストの設定
    const ctx = canvasElement.getContext('2d')
    if (ctx && devicePixelRatio > 1) {
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }

    // WebGL対応チェック
    if (defaultConfig.enableWebGL) {
      isWebGLSupported.value = checkWebGLSupport()
    }

    logger.info('Optimized canvas setup completed', {
      componentName,
      width,
      height,
      devicePixelRatio,
      webGLSupported: isWebGLSupported.value
    })

    isSetup.value = true
    return true
  }

  // 最適化された描画関数（フレームレート制限付き）
  const optimizedDraw = performanceOptimizer.throttleFrame(
    `${componentName}-draw`,
    (drawFn: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) => {
      const canvasElement = canvas.value
      if (!canvasElement) return

      const ctx = canvasElement.getContext('2d')
      if (!ctx) return

      fpsMonitor.value.tick()
      
      try {
        drawFn(ctx, canvasElement)
      } catch (error) {
        logger.error('Draw function error', { error, componentName })
      }
    },
    defaultConfig.targetFPS
  )

  // 効率的な波形描画（メモリプール使用）
  const drawWaveform = (data: Uint8Array | Float32Array) => {
    const canvasElement = canvas.value
    if (!canvasElement) {
      logger.warn('drawWaveform: canvas element not available', { componentName })
      return
    }

    const ctx = canvasElement.getContext('2d')
    if (!ctx) {
      logger.warn('drawWaveform: canvas context not available', { componentName })
      return
    }

    logger.debug('drawWaveform: starting draw', {
      componentName,
      canvasSize: `${canvasElement.width}x${canvasElement.height}`,
      dataLength: data.length,
      dataType: data.constructor.name
    })

    optimizedDraw((ctx, canvas) => {
      // CSS表示サイズを取得（Retina対応）
      const displayWidth = parseFloat(canvas.style.width) || canvas.clientWidth
      const displayHeight = parseFloat(canvas.style.height) || canvas.clientHeight
      
      logger.debug('drawWaveform: canvas dimensions', {
        componentName,
        displayWidth,
        displayHeight,
        styleWidth: canvas.style.width,
        clientWidth: canvas.clientWidth,
        physicalWidth: canvas.width,
        physicalHeight: canvas.height
      })
      
      // キャンバスをクリア
      ctx.fillStyle = defaultConfig.backgroundColor
      ctx.fillRect(0, 0, displayWidth, displayHeight)

      // 中央線（0レベル）
      const centerY = displayHeight / 2
      ctx.strokeStyle = defaultConfig.centerLineColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(displayWidth, centerY)
      ctx.stroke()
      ctx.globalAlpha = 1.0

      // 波形描画（最適化版）
      if (data.length > 0) {
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 2
        ctx.beginPath()

        const sliceWidth = displayWidth / data.length
        let x = 0

        // 最初の数点をログ出力
        logger.debug('drawWaveform: drawing waveform', {
          componentName,
          sliceWidth,
          centerY,
          firstFewPoints: Array.from(data.slice(0, 5)).map((val, i) => {
            let normalizedValue
            if (data instanceof Uint8Array) {
              normalizedValue = (val - 128) / 128
            } else {
              normalizedValue = val
            }
            const y = centerY - (normalizedValue * (displayHeight * 0.4))
            return { i, rawValue: val, normalized: normalizedValue, x: i * sliceWidth, y }
          })
        })

        for (let i = 0; i < data.length; i++) {
          // データを -1 から 1 の範囲に正規化
          let normalizedValue
          if (data instanceof Uint8Array) {
            // Uint8Array (0-255) を -1 から 1 に変換
            normalizedValue = (data[i] - 128) / 128
          } else {
            // Float32Array は既に -1 から 1 の範囲と仮定
            normalizedValue = data[i]
          }
          
          // Y座標を中央基準で計算（上が負、下が正）
          const y = centerY - (normalizedValue * (displayHeight * 0.4)) // 振幅を80%に制限

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }

          x += sliceWidth
        }

        ctx.stroke()
        logger.debug('drawWaveform: stroke completed', { componentName })
      } else {
        logger.warn('drawWaveform: no data to draw', { componentName, dataLength: data.length })
      }
    })
  }

  // WebGL対応の高速描画（実験的）
  const drawWaveformWebGL = (data: Float32Array) => {
    if (!isWebGLSupported.value || !canvas.value) return

    // WebGL実装は複雑になるため、現在はフォールバック
    logger.debug('WebGL waveform drawing not implemented, falling back to 2D', {
      componentName
    })
    drawWaveform(data)
  }

  // バッチ描画操作
  const batchDraw = (operations: Array<() => void>) => {
    const canvasElement = canvas.value
    if (!canvasElement) return

    const ctx = canvasElement.getContext('2d')
    if (!ctx) return

    canvasOptimizer.batchDraw(ctx, operations)
  }

  // 基本波形描画
  const drawBasicWaveform = () => {
    optimizedDraw((ctx, canvas) => {
      // CSS表示サイズを取得（Retina対応）
      const displayWidth = parseFloat(canvas.style.width) || canvas.clientWidth
      const displayHeight = parseFloat(canvas.style.height) || canvas.clientHeight
      
      // 背景をクリア
      ctx.fillStyle = defaultConfig.backgroundColor
      ctx.fillRect(0, 0, displayWidth, displayHeight)

      // 中央線（0レベル）
      const centerY = displayHeight / 2
      ctx.strokeStyle = defaultConfig.centerLineColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.3
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(displayWidth, centerY)
      ctx.stroke()
      ctx.globalAlpha = 1.0

      // 参考グリッド線を追加（オプション）
      ctx.strokeStyle = defaultConfig.centerLineColor
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.1
      
      // 上下の境界線
      ctx.beginPath()
      ctx.moveTo(0, displayHeight * 0.1)
      ctx.lineTo(displayWidth, displayHeight * 0.1)
      ctx.moveTo(0, displayHeight * 0.9)
      ctx.lineTo(displayWidth, displayHeight * 0.9)
      ctx.stroke()
      
      ctx.globalAlpha = 1.0
    })
  }

  // リサイズハンドラー（デバウンス付き）
  const handleResize = performanceOptimizer.debounce(
    `${componentName}-resize`,
    async () => {
      if (isSetup.value) {
        await setupOptimizedCanvas()
        drawBasicWaveform()
      }
    },
    150
  )

  // アニメーションフレーム管理
  const startAnimation = (animationFn: () => void) => {
    if (animationId.value) {
      cancelAnimationFrame(animationId.value)
    }

    fpsMonitor.value.start()
    
    logger.info('Animation started with FPS monitoring', {
      componentName,
      targetFPS: defaultConfig.targetFPS
    })

    const animate = () => {
      animationFn()
      animationId.value = requestAnimationFrame(animate)
    }

    animationId.value = requestAnimationFrame(animate)
  }

  // FPSモニターの直接制御（スロットリング回避用）
  const tickFPS = () => {
    fpsMonitor.value.tick()
  }

  const stopAnimation = () => {
    if (animationId.value) {
      cancelAnimationFrame(animationId.value)
      animationId.value = null
    }

    const metrics = fpsMonitor.value.stop()
    logger.info('Animation stopped', {
      componentName,
      metrics: {
        duration: `${metrics.duration.toFixed(2)}ms`,
        frameCount: metrics.frameCount,
        averageFPS: `${metrics.averageFPS?.toFixed(2)} FPS`
      }
    })
  }

  // パフォーマンス統計
  const performanceStats = computed(() => {
    const currentFPS = fpsMonitor.value.getCurrentFPS()
    const averageFPS = fpsMonitor.value.getAverageFPS()
    
    // デバッグ: FPS値の計算過程をログ出力
    if (componentName === 'WaveformDisplay') {
      logger.debug('Performance stats computed', {
        componentName,
        currentFPS,
        averageFPS,
        isWebGLSupported: isWebGLSupported.value,
        // FPSモニターの内部状態
        fpsMonitorState: {
          frameTimestamps: (fpsMonitor.value as any).frameTimestamps?.length || 0,
          frameCount: (fpsMonitor.value as any).frameCount || 0,
          isRunning: (fpsMonitor.value as any).isRunning || false
        }
      })
    }
    
    return {
      currentFPS,
      averageFPS,
      isWebGLSupported: isWebGLSupported.value,
      uint8ArrayPoolStats: uint8ArrayPool.getStats(),
      floatArrayPoolStats: floatArrayPool.getStats()
    }
  })

  // 初期化
  const initialize = async (): Promise<boolean> => {
    logger.info('Initializing optimized canvas', { componentName })
    
    const success = await setupOptimizedCanvas()
    if (success) {
      drawBasicWaveform()
    }
    
    return success
  }

  // クリーンアップ
  const cleanup = () => {
    stopAnimation()
    
    // プール内のオブジェクトを解放
    uint8ArrayPool.clear()
    floatArrayPool.clear()
    
    logger.info('Optimized canvas cleaned up', { componentName })
  }

  // ライフサイクル
  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    cleanup()
  })

  return {
    // 状態
    canvas,
    isSetup,
    isWebGLSupported,
    performanceStats,

    // メソッド
    setupOptimizedCanvas,
    drawWaveform,
    drawWaveformWebGL,
    drawBasicWaveform,
    batchDraw,
    startAnimation,
    stopAnimation,
    handleResize,
    initialize,
    cleanup,
    tickFPS
  }
} 