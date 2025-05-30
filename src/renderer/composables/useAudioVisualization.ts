import { ref, onUnmounted, readonly, computed } from 'vue'
import { container } from '../../common/di/container'
import { RecordingService } from '../services/recordingService'
import { createLogger } from '../../common/logger'

const logger = createLogger('AudioVisualization')

export function useAudioVisualization() {
  const canvas = ref<HTMLCanvasElement | null>(null)
  const isVisualizationActive = ref(false)
  const animationId = ref<number | null>(null)

  // サービスインスタンス
  const recordingService = container.resolve<RecordingService>('recordingService')

  // analyserの準備状態を取得
  const isAnalyserReady = computed(() => recordingService.isAnalyserReady())

  const startVisualization = (canvasElement: HTMLCanvasElement) => {
    if (!recordingService.isAnalyserReady()) {
      logger.warn('Analyser is not ready for visualization', {
        component: 'AudioVisualization',
        method: 'startVisualization'
      })
      return
    }

    canvas.value = canvasElement
    isVisualizationActive.value = true
    recordingService.startWaveformDrawing(canvasElement)
  }

  const stopVisualization = () => {
    if (isVisualizationActive.value) {
      recordingService.stopWaveformDrawing()
      isVisualizationActive.value = false
    }
  }

  const getWaveformData = () => {
    return recordingService.getWaveformData()
  }

  const drawWaveform = (canvasElement: HTMLCanvasElement, data: Uint8Array) => {
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return

    const width = canvasElement.width
    const height = canvasElement.height

    // キャンバスをクリア
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    // 中央線を描画（0レベル基準線）
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // 波形を描画
    ctx.lineWidth = 2
    ctx.strokeStyle = '#00ff00'
    ctx.beginPath()

    const sliceWidth = width / data.length
    let x = 0

    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 128.0
      const y = (v * height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }

      x += sliceWidth
    }

    ctx.stroke()
  }

  // クリーンアップ
  onUnmounted(() => {
    stopVisualization()
  })

  return {
    // 状態
    canvas: readonly(canvas),
    isVisualizationActive: readonly(isVisualizationActive),
    isAnalyserReady: readonly(isAnalyserReady),
    
    // メソッド
    startVisualization,
    stopVisualization,
    getWaveformData,
    drawWaveform
  }
} 