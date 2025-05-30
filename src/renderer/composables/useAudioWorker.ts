import { ref, readonly, onUnmounted } from 'vue'
import { AudioWorkerService } from '../services/audioWorkerService'

export function useAudioWorker() {
  // 状態管理
  const isProcessing = ref(false)
  const processingProgress = ref(0)
  const lastError = ref<string | null>(null)
  const workerStats = ref({
    workerCount: 0,
    queueSize: 0,
    pendingTasks: 0,
    isInitialized: false
  })

  // サービスインスタンス
  const audioWorkerService = new AudioWorkerService()

  // 統計情報を定期的に更新
  const updateStats = () => {
    workerStats.value = audioWorkerService.getStatistics()
  }

  const statsInterval = setInterval(updateStats, 1000)

  // WAV変換処理
  const convertToWav = async (audioBuffer: AudioBuffer): Promise<ArrayBuffer | null> => {
    isProcessing.value = true
    lastError.value = null
    
    try {
      console.log('Starting WAV conversion with Web Worker...')
      const result = await audioWorkerService.convertToWav(audioBuffer)
      console.log('WAV conversion completed:', result.byteLength, 'bytes')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'WAV conversion failed'
      lastError.value = errorMessage
      console.error('WAV conversion error:', error)
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // 音量解析処理
  const analyzeVolume = async (audioBuffer: AudioBuffer): Promise<{
    peak: number
    rms: number
    averageVolume: number
  } | null> => {
    isProcessing.value = true
    lastError.value = null
    
    try {
      console.log('Starting volume analysis with Web Worker...')
      const result = await audioWorkerService.analyzeVolume(audioBuffer)
      console.log('Volume analysis completed:', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Volume analysis failed'
      lastError.value = errorMessage
      console.error('Volume analysis error:', error)
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // 波形生成処理
  const generateWaveform = async (
    audioBuffer: AudioBuffer, 
    targetWidth: number = 1000
  ): Promise<Float32Array | null> => {
    isProcessing.value = true
    lastError.value = null
    
    try {
      console.log('Starting waveform generation with Web Worker...', { targetWidth })
      const result = await audioWorkerService.generateWaveform(audioBuffer, targetWidth)
      console.log('Waveform generation completed:', result.length, 'points')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Waveform generation failed'
      lastError.value = errorMessage
      console.error('Waveform generation error:', error)
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // スペクトラム計算処理
  const calculateSpectrum = async (
    audioBuffer: AudioBuffer, 
    fftSize: number = 2048
  ): Promise<Float32Array | null> => {
    isProcessing.value = true
    lastError.value = null
    
    try {
      console.log('Starting spectrum calculation with Web Worker...', { fftSize })
      const result = await audioWorkerService.calculateSpectrum(audioBuffer, fftSize)
      console.log('Spectrum calculation completed:', result.length, 'bins')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Spectrum calculation failed'
      lastError.value = errorMessage
      console.error('Spectrum calculation error:', error)
      return null
    } finally {
      isProcessing.value = false
    }
  }

  // 複数の処理を並行実行
  const processAudioBundle = async (audioBuffer: AudioBuffer): Promise<{
    wavData: ArrayBuffer | null
    volumeAnalysis: { peak: number; rms: number; averageVolume: number } | null
    waveform: Float32Array | null
    spectrum: Float32Array | null
  }> => {
    isProcessing.value = true
    lastError.value = null
    
    try {
      console.log('Starting audio bundle processing with Web Workers...')
      
      // 並行処理でパフォーマンスを向上
      const [wavData, volumeAnalysis, waveform, spectrum] = await Promise.allSettled([
        audioWorkerService.convertToWav(audioBuffer),
        audioWorkerService.analyzeVolume(audioBuffer),
        audioWorkerService.generateWaveform(audioBuffer, 1000),
        audioWorkerService.calculateSpectrum(audioBuffer, 2048)
      ])

      return {
        wavData: wavData.status === 'fulfilled' ? wavData.value : null,
        volumeAnalysis: volumeAnalysis.status === 'fulfilled' ? volumeAnalysis.value : null,
        waveform: waveform.status === 'fulfilled' ? waveform.value : null,
        spectrum: spectrum.status === 'fulfilled' ? spectrum.value : null
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio bundle processing failed'
      lastError.value = errorMessage
      console.error('Audio bundle processing error:', error)
      
      return {
        wavData: null,
        volumeAnalysis: null,
        waveform: null,
        spectrum: null
      }
    } finally {
      isProcessing.value = false
    }
  }

  // エラーをクリア
  const clearError = () => {
    lastError.value = null
  }

  // ワーカーサービスの破棄
  const destroy = () => {
    clearInterval(statsInterval)
    audioWorkerService.destroy()
  }

  // クリーンアップ
  onUnmounted(() => {
    destroy()
  })

  return {
    // 状態
    isProcessing: readonly(isProcessing),
    processingProgress: readonly(processingProgress),
    lastError: readonly(lastError),
    workerStats: readonly(workerStats),
    
    // メソッド
    convertToWav,
    analyzeVolume,
    generateWaveform,
    calculateSpectrum,
    processAudioBundle,
    clearError,
    destroy
  }
} 