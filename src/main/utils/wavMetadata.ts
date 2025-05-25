import { AudioFileMetadata } from '../../common/types'
import iconv from 'iconv-lite';

/**
 * WAVファイルにメタデータ（INFOチャンク）を追加する
 * Windowsエクスプローラーで表示されるように最適化
 */
export function addMetadataToWav(wavBuffer: ArrayBuffer, metadata: AudioFileMetadata): ArrayBuffer {
  const originalView = new DataView(wavBuffer)
    // RIFFヘッダーの検証
  const riffSignature = String.fromCharCode(
    originalView.getUint8(0), originalView.getUint8(1), 
    originalView.getUint8(2), originalView.getUint8(3)
  )
  if (riffSignature !== 'RIFF') {
    throw new Error('Invalid WAV file: RIFF signature not found')
  }
  
  // メタデータをINFOチャンクとして準備
  const titleBytes = encodeText(metadata.text) // タイトル = 読み上げ文章
  const trackBytes = encodeText(`${metadata.takeNumber}`) // トラック番号 = take数
  const albumBytes = encodeText('音声コーパス録音') // アルバム名（日本語）
  const artistBytes = encodeText('音声コーパス') // アーティスト名（日本語）
  const commentBytes = encodeText(`録音ファイル: ${metadata.fileName} | Take: ${metadata.takeNumber}`) // 詳細コメント
  const softwareBytes = encodeText('Corpus Recorder v1.0') // ソフトウェア名
  
  // INFOサブチャンクのサイズを計算
  const infoSubchunks = [
    { id: 'INAM', data: titleBytes },    // タイトル（読み上げ文章）
    { id: 'IART', data: artistBytes },   // アーティスト名  
    { id: 'IALB', data: albumBytes },    // アルバム名
    { id: 'ITRK', data: trackBytes },    // トラック番号（take数）
    { id: 'ICMT', data: commentBytes },  // コメント（ファイル名）
    { id: 'ISFT', data: softwareBytes }  // ソフトウェア名
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

  // 元のWAVファイル全体をまずコピー
  const originalArray = new Uint8Array(wavBuffer)
  const newArray = new Uint8Array(newBuffer)
  newArray.set(originalArray, 0)

  // RIFFファイルサイズを更新（新しいファイルサイズ - 8）
  newView.setUint32(4, newFileSize - 8, true)
  // ファイルの末尾にLISTチャンクを追加
  let writePos = wavBuffer.byteLength
  
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
 * 文字列をWindows互換のバイト配列にエンコード（CP1252 + null終端）
 * Windowsエクスプローラーでの表示互換性を向上させる
 */
function encodeText(text: string): Uint8Array {
  // Shift_JIS (Windows-31J) でエンコード  -> UTF-8 に変更
  const buffer = iconv.encode(text, 'UTF-8');
  
  // null終端を追加
  const withNull = new Uint8Array(buffer.length + 1);
  withNull.set(new Uint8Array(buffer));
  withNull[buffer.length] = 0;
  return withNull;
}
