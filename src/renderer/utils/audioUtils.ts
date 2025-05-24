// AudioBufferをWAV形式に変換
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  let offset = 0
  let pos = 0

  // WAVファイルヘッダーを書き込む
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true)
    pos += 2
  }

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true)
    pos += 4
  }

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

  // 各チャンネルのデータを取得
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    channels.push(buffer.getChannelData(channel))
  }

  // インターリーブしてデータを書き込む
  while (pos < length) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][offset]))
      view.setInt16(pos, sample * 0x7FFF, true)
      pos += 2
    }
    offset++
  }

  return arrayBuffer
}

// MediaStream RecorderのBlobをAudioBufferに変換
export async function blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  return await audioContext.decodeAudioData(arrayBuffer)
} 