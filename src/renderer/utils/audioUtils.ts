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
  
  // 入力検証
  if (!buffer || buffer.numberOfChannels === 0 || buffer.length === 0) {
    const error = new Error('Invalid AudioBuffer: empty or null buffer')
    logger.error('AudioBuffer validation failed', {
      hasBuffer: !!buffer,
      channels: buffer?.numberOfChannels || 0,
      length: buffer?.length || 0
    })
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声データが無効です',
      technicalMessage: 'AudioBuffer validation failed: empty or null buffer',
      suggestions: ['録音を再試行してください']
    })
  }

  // サポートされているフォーマットの確認
  if (buffer.numberOfChannels > 2) {
    logger.warn('Unsupported channel count, converting to stereo', {
      originalChannels: buffer.numberOfChannels,
      targetChannels: 2
    })
  }

  if (buffer.sampleRate < 8000 || buffer.sampleRate > 192000) {
    logger.warn('Unusual sample rate detected', {
      sampleRate: buffer.sampleRate,
      recommendedRange: '8000-192000 Hz'
    })
  }
  
  try {
    const channels = Math.min(buffer.numberOfChannels, 2) // 最大2チャンネルに制限
    const length = buffer.length * channels * 2 + 44
    const arrayBuffer = new ArrayBuffer(length)
    const view = new DataView(arrayBuffer)
    const channelData: Float32Array[] = []
    let offset = 0
    let pos = 0

    logger.debug('WAV conversion parameters calculated', {
      originalChannels: buffer.numberOfChannels,
      outputChannels: channels,
      totalLength: length,
      headerSize: 44,
      dataSize: length - 44,
      estimatedFileSize: `${(length / 1024 / 1024).toFixed(2)} MB`
    })

    // WAVファイルヘッダーを書き込む
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
    view.setUint16(pos, channels, true); pos += 2
    // サンプルレート
    view.setUint32(pos, buffer.sampleRate, true); pos += 4
    // バイトレート
    view.setUint32(pos, buffer.sampleRate * channels * 2, true); pos += 4
    // ブロックアライン
    view.setUint16(pos, channels * 2, true); pos += 2
    // ビット深度
    view.setUint16(pos, 16, true); pos += 2
    // "data"識別子
    view.setUint32(pos, 0x64617461, false); pos += 4
    // データチャンクサイズ
    view.setUint32(pos, length - pos - 4, true); pos += 4

    logger.debug('WAV header written, extracting channel data...')

    // 各チャンネルのデータを取得（最大2チャンネル）
    for (let channel = 0; channel < channels; channel++) {
      channelData.push(buffer.getChannelData(channel))
    }

    logger.debug('Interleaving audio data...', {
      samplesPerChannel: buffer.length,
      totalSamples: buffer.length * channels
    })
    
    // 音声レベル分析用
    let maxAmplitude = 0
    let totalAmplitude = 0
    let clippedSamples = 0
    
    // インターリーブしてデータを書き込む
    while (pos < length && offset < buffer.length) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][offset]))
        const amplitude = Math.abs(sample)
        
        // 統計情報収集
        maxAmplitude = Math.max(maxAmplitude, amplitude)
        totalAmplitude += amplitude
        if (amplitude >= 0.99) clippedSamples++
        
        view.setInt16(pos, sample * 0x7FFF, true)
        pos += 2
      }
      offset++
    }

    const conversionTime = logger.endPerformance('wav-conversion')
    const averageAmplitude = totalAmplitude / (buffer.length * channels)
    
    logger.info('WAV conversion completed successfully', {
      outputSize: arrayBuffer.byteLength,
      conversionTime: conversionTime?.toFixed(2) + 'ms',
      compressionRatio: (arrayBuffer.byteLength / (buffer.length * buffer.numberOfChannels * 4)).toFixed(2),
      audioQuality: {
        maxAmplitude: maxAmplitude.toFixed(4),
        averageAmplitude: averageAmplitude.toFixed(4),
        clippedSamples,
        clippingPercentage: ((clippedSamples / (buffer.length * channels)) * 100).toFixed(2) + '%'
      }
    })

    // 音質警告
    if (clippedSamples > 0) {
      logger.warn('Audio clipping detected', {
        clippedSamples,
        clippingPercentage: ((clippedSamples / (buffer.length * channels)) * 100).toFixed(2) + '%'
      })
    }

    if (averageAmplitude < 0.01) {
      logger.warn('Very low audio level detected', {
        averageAmplitude: averageAmplitude.toFixed(4),
        suggestion: 'Check microphone gain settings'
      })
    }

    return arrayBuffer
    
  } catch (error) {
    logger.error('WAV conversion failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      bufferInfo: {
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        length: buffer.length,
        duration: buffer.duration
      }
    })
    
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声データの変換に失敗しました',
      technicalMessage: `WAV conversion error: ${error instanceof Error ? error.message : error}`,
      suggestions: ['録音を再試行してください', 'マイクの設定を確認してください', 'ブラウザを再起動してください'],
      retryable: true
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
  
  // 入力検証
  if (!blob || blob.size === 0) {
    const error = new Error('Invalid Blob: empty or null blob')
    logger.error('Blob validation failed', {
      hasBlob: !!blob,
      blobSize: blob?.size || 0,
      blobType: blob?.type || 'unknown'
    })
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声データが無効です',
      technicalMessage: 'Blob validation failed: empty or null blob',
      suggestions: ['録音を再試行してください']
    })
  }

  if (audioContext.state === 'closed') {
    const error = new Error('AudioContext is closed')
    logger.error('AudioContext validation failed', {
      contextState: audioContext.state
    })
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage: '音声処理システムが無効です',
      technicalMessage: 'AudioContext is in closed state',
      suggestions: ['ページを再読み込みしてください']
    })
  }
  
  try {
    // AudioContextが suspended の場合は resume を試行
    if (audioContext.state === 'suspended') {
      logger.info('AudioContext is suspended, attempting to resume...')
      await audioContext.resume()
      logger.info('AudioContext resumed successfully')
    }

    logger.debug('Converting blob to ArrayBuffer...')
    const arrayBuffer = await blob.arrayBuffer()
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('ArrayBuffer is empty after blob conversion')
    }
    
    logger.debug('Decoding audio data...', {
      arrayBufferSize: arrayBuffer.byteLength,
      expectedFormat: blob.type
    })
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    // 出力検証
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Decoded AudioBuffer is empty')
    }
    
    const conversionTime = logger.endPerformance('blob-to-buffer')
    logger.info('Blob to AudioBuffer conversion completed', {
      outputChannels: audioBuffer.numberOfChannels,
      outputSampleRate: audioBuffer.sampleRate,
      outputLength: audioBuffer.length,
      outputDuration: audioBuffer.duration,
      conversionTime: conversionTime?.toFixed(2) + 'ms',
      compressionRatio: (arrayBuffer.byteLength / (audioBuffer.length * audioBuffer.numberOfChannels * 4)).toFixed(2)
    })
    
    return audioBuffer
    
  } catch (error) {
    logger.error('Blob to AudioBuffer conversion failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      blobInfo: {
        size: blob.size,
        type: blob.type
      },
      contextInfo: {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate,
        baseLatency: audioContext.baseLatency,
        outputLatency: audioContext.outputLatency
      }
    })
    
    // エラーの種類に応じて適切なメッセージを提供
    let userMessage = '音声データの読み込みに失敗しました'
    let suggestions = ['録音を再試行してください']
    
    if (error instanceof Error) {
      if (error.message.includes('decode')) {
        userMessage = '音声形式の解析に失敗しました'
        suggestions = ['対応している音声形式か確認してください', '録音を再試行してください']
      } else if (error.message.includes('suspended') || error.message.includes('closed')) {
        userMessage = '音声処理システムの初期化に失敗しました'
        suggestions = ['ページを再読み込みしてください', 'ブラウザを再起動してください']
      }
    }
    
    throw errorHandler.handle(error, {
      category: ErrorCategory.AUDIO_CONVERSION,
      userMessage,
      technicalMessage: `Audio decoding error: ${error instanceof Error ? error.message : error}`,
      suggestions,
      retryable: true
    })
  }
}