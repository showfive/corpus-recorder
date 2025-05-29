import { createLogger } from '../../common/logger'
import { errorHandler, ErrorCategory } from '../../common/errorHandler'

const logger = createLogger('AudioUtils')

// AudioBufferをWAV形式に変換
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  logger.info('Starting AudioBuffer to WAV conversion', {
    channels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    duration: buffer.duration
  })
  logger.startPerformance('wav-conversion')
  
  try {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44
    const arrayBuffer = new ArrayBuffer(length)
    const view = new DataView(arrayBuffer)
    const channels: Float32Array[] = []
    let offset = 0
    let pos = 0

    logger.debug('WAV conversion parameters calculated', {
      totalLength: length,
      headerSize: 44,
      dataSize: length - 44
    })

    // WAVファイルヘッダーを書き込む
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true)
      pos += 2
    }

    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true)
      pos += 4
    }

    logger.debug('Writing WAV header...')
    
    // WAVファイルヘッダー
    // "RIFF"識別子
    view.setUint32(pos, 0x52494646, false); pos += 4
    // ファイルサイズ - 8
    view.setUint32(pos, length - 8, true); pos += 4
    // "WAVE"識別子
    view.setUint32(pos, 0x57415645, false); pos += 4
    // "fmt "識別子
    view.setUint32(pos, 0x666d7420, false); pos += 4
    // fmtチャンクサイズ
    view.setUint32(pos, 16, true); pos += 4
    // オーディオフォーマット (1 = PCM)
    view.setUint16(pos, 1, true); pos += 2
    // チャンネル数
    view.setUint16(pos, buffer.numberOfChannels, true); pos += 2
    // サンプルレート
    view.setUint32(pos, buffer.sampleRate, true); pos += 4
    // バイトレート
    view.setUint32(pos, buffer.sampleRate * buffer.numberOfChannels * 2, true); pos += 4
    // ブロックアライン
    view.setUint16(pos, buffer.numberOfChannels * 2, true); pos += 2
    // ビット深度
    view.setUint16(pos, 16, true); pos += 2
    // "data"識別子
    view.setUint32(pos, 0x64617461, false); pos += 4
    // データチャンクサイズ
    view.setUint32(pos, length - pos - 4, true); pos += 4

    logger.debug('WAV header written, extracting channel data...')

    // 各チャンネルのデータを取得
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      channels.push(buffer.getChannelData(channel))    }

    logger.debug('Interleaving audio data...')
    
    // インターリーブしてデータを書き込む
    while (pos < length) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][offset]))
        view.setInt16(pos, sample * 0x7FFF, true)
        pos += 2
      }
      offset++
    }

    const conversionTime = logger.endPerformance('wav-conversion')
    logger.info('WAV conversion completed successfully', {
      outputSize: arrayBuffer.byteLength,
      conversionTime: conversionTime?.toFixed(2) + 'ms',
      compressionRatio: (arrayBuffer.byteLength / (buffer.length * buffer.numberOfChannels * 4)).toFixed(2)
    })

    return arrayBuffer
    
  } catch (error) {
    logger.error('WAV conversion failed', {
      error: error instanceof Error ? error.message : error,
      bufferInfo: {
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        length: buffer.length
      }
    })
    
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声データの変換に失敗しました',
      technicalMessage: `WAV conversion error: ${error instanceof Error ? error.message : error}`,
      suggestions: ['録音を再試行してください', 'マイクの設定を確認してください']
    })
  }
}

// MediaStream RecorderのBlobをAudioBufferに変換
export async function blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
  logger.info('Starting Blob to AudioBuffer conversion', {
    blobSize: blob.size,
    blobType: blob.type,
    contextState: audioContext.state,
    sampleRate: audioContext.sampleRate
  })
  logger.startPerformance('blob-to-buffer')
  
  try {
    logger.debug('Converting blob to ArrayBuffer...')
    const arrayBuffer = await blob.arrayBuffer()
    
    logger.debug('Decoding audio data...', {
      arrayBufferSize: arrayBuffer.byteLength
    })
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    const conversionTime = logger.endPerformance('blob-to-buffer')
    logger.info('Blob to AudioBuffer conversion completed', {
      outputChannels: audioBuffer.numberOfChannels,
      outputSampleRate: audioBuffer.sampleRate,
      outputLength: audioBuffer.length,
      outputDuration: audioBuffer.duration,
      conversionTime: conversionTime?.toFixed(2) + 'ms'
    })
    
    return audioBuffer
    
  } catch (error) {
    logger.error('Blob to AudioBuffer conversion failed', {
      error: error instanceof Error ? error.message : error,
      blobInfo: {
        size: blob.size,
        type: blob.type
      },
      contextInfo: {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate
      }
    })
    
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声データの読み込みに失敗しました',
      technicalMessage: `Audio decoding error: ${error instanceof Error ? error.message : error}`,
      suggestions: ['対応している音声形式か確認してください', '録音を再試行してください']
    })
  }
}