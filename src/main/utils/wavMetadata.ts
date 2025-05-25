import { AudioFileMetadata } from '../../common/types'

/**
 * WAVファイルにメタデータ（INFOチャンク）を追加する
 */
export function addMetadataToWav(wavBuffer: ArrayBuffer, metadata: AudioFileMetadata): ArrayBuffer {
  const originalView = new DataView(wavBuffer)
  
  // メタデータをINFOチャンクとして準備
  const textBytes = encodeText(metadata.text)
  const takeBytes = encodeText(`Take ${metadata.takeNumber}`)
  const filenameBytes = encodeText(metadata.fileName)
  
  // INFOサブチャンクのサイズを計算
  const infoSubchunks = [
    { id: 'INAM', data: filenameBytes }, // タイトル（ファイル名）
    { id: 'ICMT', data: textBytes },     // コメント（読み上げ文章）
    { id: 'ITRK', data: takeBytes }      // トラック番号（take数）
  ]
  
  // 各サブチャンクのサイズ計算（ID4バイト + サイズ4バイト + データ + パディング）
  let infoDataSize = 0
  for (const subchunk of infoSubchunks) {
    const dataSize = subchunk.data.length
    const paddedSize = dataSize + (dataSize % 2) // 2バイト境界にアライメント
    infoDataSize += 4 + 4 + paddedSize // ID + size + data
  }
  
  // LISTチャンクのサイズ（'INFO'の4バイト + サブチャンクのデータ）
  const listChunkSize = 4 + infoDataSize
  
  // 新しいWAVファイルのサイズ
  const newFileSize = wavBuffer.byteLength + 8 + listChunkSize // LIST header + chunk
  const newBuffer = new ArrayBuffer(newFileSize)
  const newView = new DataView(newBuffer)
  
  let writePos = 0
  
  // 元のWAVヘッダーをコピー（最初の8バイト：'RIFF' + ファイルサイズ）
  // RIFFヘッダー
  newView.setUint32(writePos, originalView.getUint32(0, false), false) // 'RIFF'
  writePos += 4
  newView.setUint32(writePos, newFileSize - 8, true) // 新しいファイルサイズ
  writePos += 4
  
  // 元のデータの残りをコピー（WAVEヘッダー以降）
  const remainingOriginalData = new Uint8Array(wavBuffer, 8)
  const newDataArray = new Uint8Array(newBuffer)
  newDataArray.set(remainingOriginalData, writePos)
  writePos += remainingOriginalData.length
  
  // LISTチャンクを追加
  newView.setUint32(writePos, 0x5453494C, false) // 'LIST'
  writePos += 4
  newView.setUint32(writePos, listChunkSize, true) // LISTチャンクサイズ
  writePos += 4
  newView.setUint32(writePos, 0x4F464E49, false) // 'INFO'
  writePos += 4
  
  // INFOサブチャンクを書き込み
  for (const subchunk of infoSubchunks) {
    // サブチャンクID
    const idBytes = new TextEncoder().encode(subchunk.id)
    for (let i = 0; i < 4; i++) {
      newView.setUint8(writePos + i, idBytes[i] || 0)
    }
    writePos += 4
    
    // サブチャンクサイズ
    newView.setUint32(writePos, subchunk.data.length, true)
    writePos += 4
    
    // サブチャンクデータ
    const dataArray = new Uint8Array(newBuffer)
    dataArray.set(subchunk.data, writePos)
    writePos += subchunk.data.length
    
    // 2バイト境界にアライメント
    if (subchunk.data.length % 2 !== 0) {
      newView.setUint8(writePos, 0) // パディング
      writePos += 1
    }
  }
  
  return newBuffer
}

/**
 * 文字列をUTF-8バイト配列にエンコード（null終端付き）
 */
function encodeText(text: string): Uint8Array {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(text)
  // null終端を追加
  const withNull = new Uint8Array(encoded.length + 1)
  withNull.set(encoded)
  withNull[encoded.length] = 0
  return withNull
}
