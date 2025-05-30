<template>
  <div class="waveform-display">
    <!-- 録音中：波形表示 -->
    <div 
      v-if="recordingState === RecordingState.RECORDING"
      class="waveform-container recording"
    >
      <canvas
        ref="recordingCanvas"
        class="waveform-canvas"
      />
      
      <!-- パフォーマンス情報（開発時のみ表示） -->
      <div v-if="showPerformanceInfo" class="performance-info">
        <div class="perf-stat">
          <span class="perf-label">FPS:</span>
          <span class="perf-value">{{ displayFPS.currentFPS.toFixed(1) }}</span>
        </div>
        <div class="perf-stat">
          <span class="perf-label">WebGL:</span>
          <span class="perf-value">{{ displayFPS.isWebGLSupported ? '✓' : '✗' }}</span>
        </div>
      </div>
    </div>

    <!-- 録音停止後：スペクトログラム＋再生バー表示枠 -->
    <div 
      v-else-if="recordingState === RecordingState.IDLE && hasRecordings"
      class="analysis-container"
    >
      <!-- 波形データ表示枠 -->
      <div class="waveform-section">
        <div class="section-header">
          <span class="section-title">波形データ</span>
        </div>
        <div class="waveform-placeholder">
          <canvas
            ref="staticCanvas"
            class="waveform-canvas static"
          />
          <div class="placeholder-overlay">
            <span class="placeholder-text">録音された波形</span>
          </div>
        </div>
      </div>

      <!-- スペクトログラム表示枠 -->
      <div class="spectrogram-section">
        <div class="section-header">
          <span class="section-title">スペクトログラム</span>
        </div>
        <div class="spectrogram-placeholder">
          <div class="spectrogram-content">
            <div class="frequency-axis">
              <span class="axis-label">周波数 (Hz)</span>
            </div>
            <div class="spectrogram-data">
              <div class="spectrogram-visual"></div>
            </div>
          </div>
          <div class="placeholder-overlay">
            <span class="placeholder-text">スペクトログラム表示予定</span>
          </div>
        </div>
      </div>

      <!-- 再生バー表示枠 -->
      <div class="playback-section">
        <div class="section-header">
          <span class="section-title">再生コントロール</span>
        </div>
        <div class="playback-placeholder">
          <div class="playback-content">
            <div class="time-axis">
              <span class="time-label">0:00</span>
              <div class="progress-bar">
                <div class="progress-track"></div>
              </div>
              <span class="time-label">--:--</span>
            </div>
          </div>
          <div class="placeholder-overlay">
            <span class="placeholder-text">再生バー表示予定</span>
          </div>
        </div>
      </div>

      <!-- 分析情報表示 -->
      <div class="analysis-overlay">
        <span class="analysis-label">録音完了 - 解析データ表示予定</span>
      </div>
    </div>
    
    <!-- 録音されていない場合のヒント表示 -->
    <div v-else class="empty-state">
      <div class="recording-hints">
        <div class="hint-item">
          <span class="hint-icon">💡</span>
          <span class="hint-text">静かな環境で録音することを推奨します</span>
        </div>
        <div class="hint-item">
          <span class="hint-icon">🎯</span>
          <span class="hint-text">マイクから15-20cm程度の距離を保ってください</span>
        </div>
        <div class="hint-item">
          <span class="hint-icon">🎤</span>
          <span class="hint-text">録音開始ボタンまたはスペースキーで開始できます</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { RecordingState } from '../../../common/types'
import { useAudioVisualization } from '../../composables/useAudioVisualization'
import { useOptimizedCanvas } from '../../composables/useOptimizedCanvas'
import { createLogger } from '../../../common/logger'
import { container } from '../../../common/di/container'
import { RecordingService } from '../../services/recordingService'

const logger = createLogger('WaveformDisplay')

interface Props {
  recordingState: RecordingState
  hasRecordings: boolean
}

const props = defineProps<Props>()

// キャンバス要素のref
const recordingCanvas = ref<HTMLCanvasElement>()
const staticCanvas = ref<HTMLCanvasElement>()

// 最適化されたキャンバス管理
const {
  canvas: optimizedCanvas,
  isSetup,
  isWebGLSupported,
  performanceStats,
  drawWaveform,
  drawBasicWaveform,
  startAnimation,
  stopAnimation,
  initialize,
  cleanup,
  tickFPS
} = useOptimizedCanvas('WaveformDisplay', {
  targetFPS: 60,
  enableWebGL: true,
  enableHighDPI: true
})

// 音声可視化
const { 
  startVisualization, 
  stopVisualization, 
  getWaveformData
} = useAudioVisualization()

// RecordingServiceに直接アクセスして状態確認
const recordingService = container.resolve<RecordingService>('recordingService')

// isAnalyserReadyはrefで管理（computedのリアクティブ問題を回避）
const isAnalyserReady = ref(false)

// 手動でAnalyser状態を更新する関数
const updateAnalyserState = () => {
  const newState = recordingService.isAnalyserReady()
  if (isAnalyserReady.value !== newState) {
    logger.debug('Analyser state changed', {
      oldState: isAnalyserReady.value,
      newState,
      component: 'WaveformDisplay'
    })
    isAnalyserReady.value = newState
  }
  return newState
}

// 開発環境でのパフォーマンス情報表示
const showPerformanceInfo = ref(process.env.NODE_ENV === 'development')

// 表示用FPS値（0.5秒間隔で更新）
const displayFPS = ref({
  currentFPS: 0,
  isWebGLSupported: false
})

// デバッグ用のインターバルID
const debugInterval = ref<number | null>(null)
const fpsDisplayInterval = ref<number | null>(null)

// キャンバスサイズを設定する関数
const setupCanvasSize = (canvas: HTMLCanvasElement) => {
  if (!canvas) return
  
  const container = canvas.parentElement
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  // パディングを考慮したサイズ計算
  const computedStyle = window.getComputedStyle(container)
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
  
  const availableWidth = rect.width - paddingLeft - paddingRight
  const availableHeight = rect.height - paddingTop - paddingBottom
  
  // CSS表示サイズ（最小サイズを保証）
  const displayWidth = Math.max(availableWidth, 200)
  const displayHeight = Math.max(availableHeight, 100)
  
  // Retina対応：物理ピクセルサイズ
  const physicalWidth = displayWidth * dpr
  const physicalHeight = displayHeight * dpr
  
  // キャンバスの物理サイズを設定
  canvas.width = physicalWidth
  canvas.height = physicalHeight
  
  // CSS表示サイズを設定（重要：これがRetina対応のキー）
  canvas.style.width = `${displayWidth}px`
  canvas.style.height = `${displayHeight}px`
  
  // コンテキストのスケーリング（Retina対応）
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // 既存の変換をリセット
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // DPRに基づいてスケール
    ctx.scale(dpr, dpr)
  }
  
  logger.info('Canvas size set for Retina display', {
    containerSize: { width: rect.width, height: rect.height },
    padding: { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom },
    displaySize: { width: displayWidth, height: displayHeight },
    physicalSize: { width: physicalWidth, height: physicalHeight },
    dpr,
    isRetina: dpr > 1
  })
}

// 現在のキャンバスを取得する関数
const getCurrentCanvas = (): HTMLCanvasElement | null => {
  if (props.recordingState === RecordingState.RECORDING) {
    return recordingCanvas.value || null
  } else if (props.recordingState === RecordingState.IDLE && props.hasRecordings) {
    return staticCanvas.value || null
  }
  return null
}

// 波形アニメーション
const animateWaveform = () => {
  // FPSモニターのtickを直接呼び出し（最適化されたキャンバスのスロットリングをバイパス）
  tickFPS()
  
  // 定期的にFPS状態をログ出力（5秒間隔）
  const now = Date.now()
  if (!animateWaveform.lastFPSLog || now - animateWaveform.lastFPSLog > 5000) {
    const currentStats = performanceStats.value
    logger.info('FPS status during animation', {
      currentFPS: currentStats.currentFPS.toFixed(1),
      timestamp: new Date().toLocaleTimeString()
    })
    animateWaveform.lastFPSLog = now
  }
  
  // 手動でAnalyser状態を更新
  const serviceReady = updateAnalyserState()
  const composableReady = isAnalyserReady.value // 更新後の値
  
  logger.debug('animateWaveform called', {
    composableIsAnalyserReady: composableReady,
    serviceIsAnalyserReady: serviceReady,
    recordingState: props.recordingState,
    timestamp: Date.now(),
    mismatch: composableReady !== serviceReady,
    // FPS統計を追加
    currentFPS: performanceStats.value.currentFPS,
    averageFPS: performanceStats.value.averageFPS
  })
  
  // serviceReadyを優先して使用
  if (!serviceReady) {
    logger.warn('Analyser not ready for animation (using service check)', {
      composableReady,
      serviceReady,
      usingServiceCheck: true
    })
    return
  }

  const data = getWaveformData()
  logger.debug('getWaveformData result', {
    hasData: !!data,
    dataLength: data?.length || 'null',
    dataType: data?.constructor.name || 'null',
    sampleValues: data ? Array.from(data.slice(0, 10)) : 'null'
  })
  
  if (data) {
    // デバッグ: データの基本情報を出力
    const rms = Math.sqrt(data.reduce((sum, val) => sum + Math.pow((val - 128) / 128, 2), 0) / data.length)
    const max = Math.max(...data)
    const min = Math.min(...data)
    
    // 毎秒1回のみログ出力（パフォーマンス改善）
    const now = Date.now()
    if (!animateWaveform.lastLogTime || now - animateWaveform.lastLogTime > 1000) {
      logger.info('Waveform data received', {
        length: data.length,
        type: data.constructor.name,
        rms: rms.toFixed(4),
        range: `${min}-${max}`,
        sample: Array.from(data.slice(0, 5)),
        allSame: data.every(val => val === data[0]), // 全て同じ値かチェック
        fps: {
          current: performanceStats.value.currentFPS.toFixed(1),
          average: performanceStats.value.averageFPS.toFixed(1)
        }
      })
      animateWaveform.lastLogTime = now
    }
    
    try {
      drawWaveform(data)
      logger.debug('drawWaveform completed successfully')
    } catch (drawError) {
      logger.error('Error in drawWaveform', {
        error: drawError instanceof Error ? drawError.message : drawError,
        stack: drawError instanceof Error ? drawError.stack : undefined
      })
    }
  } else {
    logger.warn('No waveform data available from getWaveformData()', {
      serviceReady,
      composableReady
    })
  }
}

// 録音状態の監視
watch(() => props.recordingState, async (newState, oldState) => {
  logger.info('Recording state changed', { 
    oldState, 
    newState,
    component: 'WaveformDisplay'
  })
  
  if (newState === RecordingState.IDLE) {
    // 録音停止時
    stopVisualization()
    stopAnimation()
    stopAnalyserMonitoring()
    stopFPSDisplay() // FPS表示も停止
    
    // 静的キャンバスに切り替えて波形を描画
    await nextTick()
    const canvas = getCurrentCanvas()
    if (canvas && props.hasRecordings) {
      setupCanvasSize(canvas)
      // optimizedCanvasのキャンバス要素を更新
      optimizedCanvas.value = canvas
      // 描画前に少し待機してサイズが確定するのを待つ
      await new Promise(resolve => setTimeout(resolve, 50))
      if (isSetup.value) {
        drawBasicWaveform()
      }
    }
  }
  
  // 録音開始時
  if (newState === RecordingState.RECORDING && oldState === RecordingState.IDLE) {
    logger.info('Starting optimized waveform visualization')
    
    // Analyser状態の定期監視を開始
    startAnalyserMonitoring()
    
    // FPS表示を開始
    startFPSDisplay()
    
    await nextTick()
    const canvas = getCurrentCanvas()
    
    if (canvas) {
      setupCanvasSize(canvas)
      // optimizedCanvasのキャンバス要素を更新
      optimizedCanvas.value = canvas
      
      // 描画前に少し待機してサイズが確定するのを待つ
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // recordingServiceの独自波形描画は使用しない
      // startVisualization(canvas) <- これを無効化
      
      // 録音開始直後の状態をチェック
      const immediateServiceReady = updateAnalyserState()
      const immediateComposableReady = isAnalyserReady.value
      const immediateServiceState = recordingService.getState()
      
      logger.info('Recording started - immediate analyser state check', {
        composableIsAnalyserReady: immediateComposableReady,
        serviceIsAnalyserReady: immediateServiceReady,
        serviceRecordingState: immediateServiceState,
        propsRecordingState: props.recordingState
      })
      
      // 既に準備完了の場合は即座にアニメーション開始
      if (immediateComposableReady || immediateServiceReady) {
        logger.info('Analyser already ready, starting animation immediately')
        startAnimation(animateWaveform)
        
        // FPSモニターの開始状態を確認
        setTimeout(() => {
          logger.info('FPS Monitor status after animation start', {
            currentFPS: performanceStats.value.currentFPS.toFixed(1),
            isWebGLSupported: performanceStats.value.isWebGLSupported
          })
        }, 100)
      } else {
        logger.info('Analyser not ready, starting wait loop')
        
        // analyserの準備を待って、独自のアニメーションのみ開始
        const waitForAnalyser = () => {
          const composableReady = isAnalyserReady.value
          const serviceReady = recordingService.isAnalyserReady()
          const serviceState = recordingService.getState()
          
          logger.debug('Checking analyser state', {
            composableIsAnalyserReady: composableReady,
            serviceIsAnalyserReady: serviceReady,
            serviceRecordingState: serviceState,
            propsRecordingState: props.recordingState,
            attempt: Date.now() - (waitForAnalyser as any).startTime || 0
          })
          
          if (composableReady || serviceReady) {
            logger.info('Analyser ready, starting WaveformDisplay animation', {
              readySource: composableReady ? 'composable' : 'service'
            })
            
            // テスト: 直接データ取得を試行
            const testData = getWaveformData()
            const serviceTestData = recordingService.getWaveformData()
            logger.info('Testing direct waveform data access', {
              composableDataLength: testData?.length || 'null',
              serviceDataLength: serviceTestData?.length || 'null',
              composableDataType: testData?.constructor.name || 'null',
              serviceDataType: serviceTestData?.constructor.name || 'null'
            })
            
            // 最適化されたアニメーションを開始（recordingServiceの描画は使わない）
            startAnimation(animateWaveform)
            
            // FPSモニターの開始状態を確認
            setTimeout(() => {
              logger.info('FPS Monitor status after delayed animation start', {
                currentFPS: performanceStats.value.currentFPS.toFixed(1),
                isWebGLSupported: performanceStats.value.isWebGLSupported
              })
            }, 100)
          } else {
            logger.debug('Waiting for analyser...', {
              currentTime: Date.now(),
              composableReady,
              serviceReady,
              serviceState,
              propsState: props.recordingState
            })
            
            // まだ録音中の場合のみ継続
            if (props.recordingState === RecordingState.RECORDING) {
              setTimeout(waitForAnalyser, 50)
            } else {
              logger.warn('Recording stopped while waiting for analyser')
            }
          }
        }
        
        // 開始時刻を記録
        ;(waitForAnalyser as any).startTime = Date.now()
        setTimeout(waitForAnalyser, 100)
      }
    }
  }
})

// hasRecordingsの状態変化も監視
watch(() => props.hasRecordings, async (newHasRecordings) => {
  if (newHasRecordings && props.recordingState === RecordingState.IDLE) {
    // 録音完了後に静的な波形を描画
    await nextTick()
    const canvas = getCurrentCanvas()
    if (canvas) {
      setupCanvasSize(canvas)
      optimizedCanvas.value = canvas
      // 描画前に少し待機してサイズが確定するのを待つ
      await new Promise(resolve => setTimeout(resolve, 50))
      if (isSetup.value) {
        drawBasicWaveform()
      }
    }
  }
})

// isAnalyserReadyの状態変化も監視
watch(() => isAnalyserReady.value, (newReady, oldReady) => {
  logger.info('Analyser ready state changed', {
    oldReady,
    newReady,
    recordingState: props.recordingState,
    component: 'WaveformDisplay'
  })
  
  // Analyserが準備完了し、録音中の場合、アニメーションを開始
  if (newReady && !oldReady && props.recordingState === RecordingState.RECORDING) {
    logger.info('Analyser became ready during recording, starting animation')
    startAnimation(animateWaveform)
    
    // FPSモニターの開始状態を確認
    setTimeout(() => {
      logger.info('FPS Monitor status after state change animation start', {
        currentFPS: performanceStats.value.currentFPS.toFixed(1),
        isWebGLSupported: performanceStats.value.isWebGLSupported
      })
    }, 100)
  }
})

// performanceStatsの変化を監視
watch(() => performanceStats.value, (newStats, oldStats) => {
  // FPS値が0以外になった場合のみログ出力
  if (newStats.currentFPS > 0 || newStats.averageFPS > 0) {
    logger.info('PerformanceStats changed', {
      oldFPS: {
        current: oldStats?.currentFPS || 0,
        average: oldStats?.averageFPS || 0
      },
      newFPS: {
        current: newStats.currentFPS,
        average: newStats.averageFPS
      },
      component: 'WaveformDisplay'
    })
  }
}, { deep: true })

// リサイズイベントハンドラー
const handleResize = () => {
  const canvas = getCurrentCanvas()
  if (canvas) {
    setupCanvasSize(canvas)
  }
}

// コンポーネント初期化
onMounted(async () => {
  // 初期状態を更新
  updateAnalyserState()
  
  // 初期FPS表示状態を設定
  displayFPS.value.isWebGLSupported = isWebGLSupported.value
  
  logger.info('WaveformDisplay mounted with optimized canvas', {
    devicePixelRatio: window.devicePixelRatio,
    isRetina: window.devicePixelRatio > 1,
    userAgent: navigator.userAgent.includes('Mac'),
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight
    },
    // Analyserの初期状態
    isAnalyserReady: isAnalyserReady.value,
    recordingState: props.recordingState,
    hasRecordings: props.hasRecordings
  })
  
  // マイクアクセス権限の確認
  if (navigator.permissions) {
    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      logger.info('Microphone permission status', {
        state: micPermission.state,
        component: 'WaveformDisplay'
      })
    } catch (error) {
      logger.warn('Could not check microphone permission', { error })
    }
  }
  
  await nextTick()
  
  // 現在の状態に応じたキャンバスを設定
  const canvas = getCurrentCanvas()
  if (canvas) {
    setupCanvasSize(canvas)
    optimizedCanvas.value = canvas
  }
  
  // 最適化されたキャンバスを初期化（自動セットアップは無効化）
  isSetup.value = true
  
  logger.info('Optimized canvas initialized successfully with manual setup')
  
  // 録音完了状態の場合は基本波形を描画
  if (props.recordingState === RecordingState.IDLE && props.hasRecordings && canvas) {
    drawBasicWaveform()
  }
  
  // リサイズイベントリスナーを追加
  window.addEventListener('resize', handleResize)
})

// クリーンアップ
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopAnalyserMonitoring()
  stopFPSDisplay()
  cleanup()
})

// Analyser状態を定期監視（デバッグ用）
const startAnalyserMonitoring = () => {
  if (debugInterval.value) {
    clearInterval(debugInterval.value)
  }
  
  debugInterval.value = window.setInterval(() => {
    const serviceReady = updateAnalyserState()
    const composableReady = isAnalyserReady.value
    const serviceState = recordingService.getState()
    
    // performanceStatsの値をデバッグ出力
    const currentStats = performanceStats.value
    
    logger.info('Periodic analyser state check', {
      timestamp: new Date().toLocaleTimeString(),
      composableIsAnalyserReady: composableReady,
      serviceIsAnalyserReady: serviceReady,
      serviceRecordingState: serviceState,
      propsRecordingState: props.recordingState,
      // FPS統計を追加（表示用の値）
      displayFPS: {
        current: displayFPS.value.currentFPS.toFixed(1)
      }
    })
    
    // 録音中でない場合は監視停止
    if (props.recordingState !== RecordingState.RECORDING) {
      if (debugInterval.value) {
        clearInterval(debugInterval.value)
        debugInterval.value = null
        logger.info('Analyser monitoring stopped - not recording')
      }
    }
  }, 1000) // 1秒間隔
  
  logger.info('Started periodic analyser monitoring')
}

const stopAnalyserMonitoring = () => {
  if (debugInterval.value) {
    clearInterval(debugInterval.value)
    debugInterval.value = null
    logger.info('Analyser monitoring stopped manually')
  }
}

// FPS表示の更新（0.5秒間隔）
const startFPSDisplay = () => {
  if (fpsDisplayInterval.value) {
    clearInterval(fpsDisplayInterval.value)
  }
  
  // 即座に一度更新
  updateFPSDisplay()
  
  fpsDisplayInterval.value = window.setInterval(() => {
    updateFPSDisplay()
  }, 500) // 0.5秒間隔
  
  logger.info('FPS display started (0.5s interval)')
}

const updateFPSDisplay = () => {
  const currentStats = performanceStats.value
  displayFPS.value = {
    currentFPS: currentStats.currentFPS,
    isWebGLSupported: currentStats.isWebGLSupported
  }
}

const stopFPSDisplay = () => {
  if (fpsDisplayInterval.value) {
    clearInterval(fpsDisplayInterval.value)
    fpsDisplayInterval.value = null
    logger.info('FPS display stopped')
  }
}
</script>

<style scoped>
.waveform-display {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.waveform-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  min-height: 200px;
  padding: var(--space-xs);
  box-sizing: border-box;
}

.waveform-container.recording {
  background: linear-gradient(135deg, var(--gray-900), #1a1a1a);
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: var(--radius-md);
  min-width: 200px;
  min-height: 100px;
  box-sizing: border-box;
}

.performance-info {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
  min-width: 120px;
}

.perf-stat {
  display: flex;
  justify-content: space-between;
  min-width: 100px;
  margin-bottom: 2px;
}

.perf-stat:last-child {
  margin-bottom: 0;
}

.perf-label {
  margin-right: 8px;
  font-size: 10px;
  opacity: 0.8;
}

.perf-value {
  font-weight: bold;
  color: #4ade80;
  font-size: 11px;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 500px;
  text-align: center;
  z-index: 5;
}

.recording-hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--gray-300);
  box-shadow: var(--shadow-sm);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-align: left;
}

.hint-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.hint-text {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

/* 分析表示コンテナ */
.analysis-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  border-radius: var(--radius-md);
  position: relative;
}

/* セクションヘッダー */
.section-header {
  display: flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-sm);
  border-bottom: 2px solid var(--primary-color);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 波形セクション */
.waveform-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.waveform-placeholder {
  flex: 1;
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-300);
  min-height: 100px;
  display: flex;
  flex-direction: column;
  padding: var(--space-xs);
  box-sizing: border-box;
}

/* スペクトログラムセクション */
.spectrogram-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.spectrogram-placeholder {
  flex: 1;
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-300);
  overflow: hidden;
}

.spectrogram-content {
  width: 100%;
  height: 100%;
  display: flex;
}

.frequency-axis {
  width: 60px;
  background: linear-gradient(to bottom, #8b5cf6, #06b6d4, #10b981);
  display: flex;
  align-items: end;
  justify-content: center;
  padding: var(--space-xs);
}

.axis-label {
  font-size: var(--font-size-xs);
  color: white;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-weight: 500;
}

.spectrogram-data {
  flex: 1;
  background: linear-gradient(
    to right,
    rgba(139, 92, 246, 0.2),
    rgba(6, 182, 212, 0.2),
    rgba(16, 185, 129, 0.2)
  );
}

.spectrogram-visual {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    transparent 0px,
    rgba(139, 92, 246, 0.1) 2px,
    transparent 4px,
    rgba(6, 182, 212, 0.1) 6px,
    transparent 8px,
    rgba(16, 185, 129, 0.1) 10px,
    transparent 12px
  );
  animation: spectrogramShimmer 3s ease-in-out infinite;
}

/* 再生バーセクション */
.playback-section {
  height: 80px;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.playback-placeholder {
  flex: 1;
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-300);
  padding: var(--space-sm);
}

.playback-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

.time-axis {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.time-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-track {
  height: 100%;
  width: 30%;
  background: linear-gradient(90deg, var(--primary-color), var(--success-color));
  border-radius: var(--radius-full);
  animation: progressPulse 2s ease-in-out infinite;
}

/* プレースホルダーオーバーレイ */
.placeholder-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  z-index: 10;
  opacity: 0.8;
  pointer-events: none;
}

.placeholder-text {
  white-space: nowrap;
}

/* 分析オーバーレイ */
.analysis-overlay {
  position: absolute;
  bottom: var(--space-sm);
  right: var(--space-sm);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  z-index: 5;
}

.analysis-label {
  white-space: nowrap;
}

.waveform-canvas.static {
  border-radius: var(--radius-sm);
  position: relative;
  z-index: 1;
}

/* アニメーション */
@keyframes spectrogramShimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.8; }
}

@keyframes progressPulse {
  0%, 100% { 
    opacity: 0.6;
    width: 30%;
  }
  50% { 
    opacity: 1;
    width: 45%;
  }
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .analysis-container {
    padding: var(--space-xs);
    gap: var(--space-xs);
  }
  
  .section-header {
    padding: var(--space-xs);
  }
  
  .section-title {
    font-size: var(--font-size-xs);
  }
  
  .frequency-axis {
    width: 50px;
  }
  
  .axis-label {
    font-size: 10px;
  }
  
  .playback-section {
    height: 60px;
  }
  
  .time-label {
    font-size: var(--font-size-xs);
    min-width: 35px;
  }
  
  .progress-bar {
    height: 6px;
  }
  
  .placeholder-overlay {
    padding: var(--space-xs);
  }
  
  .placeholder-text {
    font-size: 10px;
  }
  
  .analysis-overlay {
    bottom: var(--space-xs);
    right: var(--space-xs);
    padding: var(--space-xs);
  }
  
  .analysis-label {
    font-size: 10px;
  }
  
  .recording-hints {
    padding: var(--space-md);
    gap: var(--space-sm);
  }
  
  .hint-text {
    font-size: var(--font-size-xs);
  }
}
</style> 