import { promises as fsPromises } from 'fs'
import path from 'path'
import { CorpusText } from '../../common/types'

// テキストファイルの読み込み結果
export interface TextFileResult {
  filePath: string
  content: string
  texts: CorpusText[]
  format: TextFileFormat
}

// サポートするテキストファイルのフォーマット
export enum TextFileFormat {
  PLAIN_TEXT = 'plain-text',
  NUMBERED_LIST = 'numbered-list',
  CSV = 'csv',
  TSV = 'tsv'
}

// フォーマット検出の結果
interface FormatDetectionResult {
  format: TextFileFormat
  confidence: number
}

/**
 * テキストファイルのフォーマットを検出する
 */
function detectFormat(content: string): FormatDetectionResult {
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { format: TextFileFormat.PLAIN_TEXT, confidence: 1.0 }
  }

  // CSV形式の検出
  const csvMatches = lines.filter(line => line.includes(',') && line.split(',').length > 1)
  if (csvMatches.length > lines.length * 0.8) {
    return { format: TextFileFormat.CSV, confidence: 0.9 }
  }

  // TSV形式の検出
  const tsvMatches = lines.filter(line => line.includes('\t') && line.split('\t').length > 1)
  if (tsvMatches.length > lines.length * 0.8) {
    return { format: TextFileFormat.TSV, confidence: 0.9 }
  }

  // 番号付きリスト形式の検出（1. 2. 3. または 1) 2) 3) のパターン）
  const numberedMatches = lines.filter(line => /^\s*\d+[.)]/.test(line))
  if (numberedMatches.length > lines.length * 0.7) {
    return { format: TextFileFormat.NUMBERED_LIST, confidence: 0.8 }
  }

  // デフォルトはプレーンテキスト
  return { format: TextFileFormat.PLAIN_TEXT, confidence: 0.5 }
}

/**
 * プレーンテキスト形式を解析する
 */
function parsePlainText(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((text, index) => ({
    id: `text-${index}`,
    index,
    text: text.trim()
  }))
}

/**
 * 番号付きリスト形式を解析する
 */
function parseNumberedList(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, index) => {
    // 番号部分を除去
    const text = line.replace(/^\s*\d+[.)]\s*/, '').trim()
    return {
      id: `text-${index}`,
      index,
      text
    }
  })
}

/**
 * CSV形式を解析する
 */
function parseCSV(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, index) => {
    const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''))
    // 最初のカラムをテキストとして使用
    const text = columns[0] || ''
    return {
      id: `text-${index}`,
      index,
      text
    }
  })
}

/**
 * TSV形式を解析する
 */
function parseTSV(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, index) => {
    const columns = line.split('\t').map(col => col.trim())
    // 最初のカラムをテキストとして使用
    const text = columns[0] || ''
    return {
      id: `text-${index}`,
      index,
      text
    }
  })
}

/**
 * フォーマットに応じてテキストを解析する
 */
function parseTextContent(content: string, format: TextFileFormat): CorpusText[] {
  switch (format) {
    case TextFileFormat.NUMBERED_LIST:
      return parseNumberedList(content)
    case TextFileFormat.CSV:
      return parseCSV(content)
    case TextFileFormat.TSV:
      return parseTSV(content)
    case TextFileFormat.PLAIN_TEXT:
    default:
      return parsePlainText(content)
  }
}

/**
 * テキストファイルを読み込み、フォーマットを自動検出して解析する
 */
export async function readAndParseTextFile(filePath: string): Promise<TextFileResult> {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8')
    const detection = detectFormat(content)
    const texts = parseTextContent(content, detection.format)

    return {
      filePath,
      content,
      texts,
      format: detection.format
    }
  } catch (error) {
    throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * サポートされているファイル拡張子を取得する
 */
export function getSupportedExtensions(): string[] {
  return ['txt', 'csv', 'tsv']
}

/**
 * ファイル拡張子からフォーマットを推測する
 */
export function guessFormatFromExtension(filePath: string): TextFileFormat {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.csv':
      return TextFileFormat.CSV
    case '.tsv':
      return TextFileFormat.TSV
    case '.txt':
    default:
      return TextFileFormat.PLAIN_TEXT
  }
}
