/**
 * Audio Processing Web Worker
 * 音声データの変換・解析処理をメインスレッドから分離
 */

// ワーカーで使用する型定義
interface AudioProcessingTask {
  id: string
  type: 'convert-to-wav' | 'analyze-volume' | 'generate-waveform' | 'calculate-spectrum'
  data: any
}

interface AudioProcessingResult {
  id: string
  success: boolean
  result?: any
  error?: string
  processingTime: number
}

// WAV形式への変換処理
function convertToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  
  // WAVファイルヘッダーのサイズ計算
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)
  
  // WAVヘッダーの書き込み
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + length * numberOfChannels * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // フォーマットチャンクサイズ
  view.setUint16(20, 1, true) // PCMフォーマット
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true) // バイト/秒
  view.setUint16(32, numberOfChannels * 2, true) // ブロックアライン
  view.setUint16(34, 16, true) // ビット/サンプル
  writeString(view, 36, 'data')
  view.setUint32(40, length * numberOfChannels * 2, true)
  
  // 音声データの書き込み
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }
  
  return arrayBuffer
}

// 文字列をDataViewに書き込む
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// 音量解析処理
function analyzeVolume(audioBuffer: AudioBuffer): {
  peak: number
  rms: number
  averageVolume: number
} {
  let peak = 0
  let sum = 0
  const length = audioBuffer.length
  const numberOfChannels = audioBuffer.numberOfChannels
  
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    
    for (let i = 0; i < length; i++) {
      const sample = Math.abs(channelData[i])
      peak = Math.max(peak, sample)
      sum += sample * sample
    }
  }
  
  const rms = Math.sqrt(sum / (length * numberOfChannels))
  const averageVolume = sum / (length * numberOfChannels)
  
  return { peak, rms, averageVolume }
}

// 波形データ生成処理
function generateWaveform(audioBuffer: AudioBuffer, targetWidth: number = 1000): Float32Array {
  const channelData = audioBuffer.getChannelData(0) // 最初のチャンネルを使用
  const blockSize = Math.floor(channelData.length / targetWidth)
  const waveformData = new Float32Array(targetWidth)
  
  for (let i = 0; i < targetWidth; i++) {
    let sum = 0
    let count = 0
    
    for (let j = 0; j < blockSize; j++) {
      const index = i * blockSize + j
      if (index < channelData.length) {
        sum += Math.abs(channelData[index])
        count++
      }
    }
    
    waveformData[i] = count > 0 ? sum / count : 0
  }
  
  return waveformData
}

// スペクトラム解析処理（簡易版FFT）
function calculateSpectrum(audioBuffer: AudioBuffer, fftSize: number = 2048): Float32Array {
  const channelData = audioBuffer.getChannelData(0)
  const spectrum = new Float32Array(fftSize / 2)
  
  // 簡易的なスペクトラム計算（実際のFFTライブラリを使うことを推奨）
  for (let i = 0; i < spectrum.length; i++) {
    let sum = 0
    const binSize = Math.floor(channelData.length / spectrum.length)
    
    for (let j = 0; j < binSize; j++) {
      const index = i * binSize + j
      if (index < channelData.length) {
        sum += Math.abs(channelData[index])
      }
    }
    
    spectrum[i] = sum / binSize
  }
  
  return spectrum
}

// AudioBufferをワーカー内で再構築
function reconstructAudioBuffer(bufferData: {
  sampleRate: number
  numberOfChannels: number
  length: number
  channelData: Float32Array[]
}): AudioBuffer {
  // OfflineAudioContextを使用してAudioBufferを作成
  const audioContext = new OfflineAudioContext(
    bufferData.numberOfChannels,
    bufferData.length,
    bufferData.sampleRate
  )
  
  const audioBuffer = audioContext.createBuffer(
    bufferData.numberOfChannels,
    bufferData.length,
    bufferData.sampleRate
  )
  
  for (let channel = 0; channel < bufferData.numberOfChannels; channel++) {
    audioBuffer.copyToChannel(bufferData.channelData[channel], channel)
  }
  
  return audioBuffer
}

// メインスレッドからのメッセージ処理
self.onmessage = function(event: MessageEvent<AudioProcessingTask>) {
  const { id, type, data } = event.data
  const startTime = performance.now()
  
  try {
    let result: any
    
    switch (type) {
      case 'convert-to-wav':
        const audioBuffer = reconstructAudioBuffer(data.bufferData)
        result = convertToWav(audioBuffer)
        break
        
      case 'analyze-volume':
        const volumeBuffer = reconstructAudioBuffer(data.bufferData)
        result = analyzeVolume(volumeBuffer)
        break
        
      case 'generate-waveform':
        const waveformBuffer = reconstructAudioBuffer(data.bufferData)
        result = generateWaveform(waveformBuffer, data.targetWidth)
        break
        
      case 'calculate-spectrum':
        const spectrumBuffer = reconstructAudioBuffer(data.bufferData)
        result = calculateSpectrum(spectrumBuffer, data.fftSize)
        break
        
      default:
        throw new Error(`Unknown task type: ${type}`)
    }
    
    const processingTime = performance.now() - startTime
    
    const response: AudioProcessingResult = {
      id,
      success: true,
      result,
      processingTime
    }
    
    // 結果をメインスレッドに送信
    self.postMessage(response)
    
  } catch (error) {
    const processingTime = performance.now() - startTime
    
    const response: AudioProcessingResult = {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    }
    
    self.postMessage(response)
  }
}

// ワーカー初期化完了を通知
self.postMessage({
  id: 'worker-ready',
  success: true,
  result: 'Audio processor worker initialized',
  processingTime: 0
} as AudioProcessingResult)

export {} // TypeScriptモジュールとして認識させる 