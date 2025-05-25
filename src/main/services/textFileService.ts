import { promises as fsPromises } from 'fs'
import path from 'path'
import { CorpusText, RubySegment } from '../../common/types'

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
  ITA_FORMAT = 'ita-format', // ITAコーパス形式
  ROHAN_FORMAT = 'rohan-format' // Rohanコーパス形式
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

  // Rohanコーパス形式の検出 (ROHAN4600_xxxx:text(ruby),reading)
  const rohanMatches = lines.filter(line => /^ROHAN4600_\d+:[^:]+\(.+?\)[^,]+,[ァ-ヴー]+$/.test(line))
  if (rohanMatches.length > lines.length * 0.8) {
    return { format: TextFileFormat.ROHAN_FORMAT, confidence: 0.9 }
  }

  // ITAコーパス形式の検出
  const itaMatches = lines.filter(line => /^[^:]+:[^,]+,[ァ-ヴー]+$/.test(line))
  if (itaMatches.length > lines.length * 0.8) {
    return { format: TextFileFormat.ITA_FORMAT, confidence: 0.9 }
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
 * ITAコーパス形式を解析する
 */
function parseItaFormat(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim())
  return lines.map((line, index) => {
    const parts = line.split(':')
    const label = parts[0]
    const textAndReading = parts[1].split(',')
    const text = textAndReading[0]
    const reading = textAndReading[1]
    return {
      id: `text-${index}`,
      index,
      text,
      label,
      reading
    }
  })
}

/**
 * Rohanコーパス形式を解析する
 */
function parseRohanFormat(content: string): CorpusText[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map((line, index) => {
    const parts = line.split(':');
    const label = parts[0];
    const textAndReading = parts[1].split(',');
    const rawText = textAndReading[0];
    const reading = textAndReading[1];

    const rubyText: RubySegment[] = [];
    let lastIndex = 0;
    const regex = /(.*?)\(（(.*?)\)）/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      if (match[1]) {
        rubyText.push(match[1]);
      }
      rubyText.push({ base: match[2], ruby: match[3] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < rawText.length) {
      rubyText.push(rawText.substring(lastIndex));
    }

    return {
      id: `text-${index}`,
      index,
      text: rawText, // 元のルビ注釈付きテキストも保持
      label,
      reading,
      rubyText
    };
  });
}


/**
 * フォーマットに応じてテキストを解析する
 */
function parseTextContent(content: string, format: TextFileFormat): CorpusText[] {
  switch (format) {
    case TextFileFormat.ROHAN_FORMAT:
      return parseRohanFormat(content)
    case TextFileFormat.ITA_FORMAT:
      return parseItaFormat(content)
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
  return ['txt'] // .txt のみをサポート
}

/**
 * ファイル拡張子からフォーマットを推測する
 * 注意: この関数は拡張子のみに基づいて推測するため、.txt ファイルの正確なフォーマット
 * (PLAIN_TEXT, ITA_FORMAT, ROHAN_FORMATなど) を特定することはできません。
 * 正確なフォーマット判定はファイル内容を読み取った後に行われます。
 */
export function guessFormatFromExtension(filePath: string): TextFileFormat {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.txt':
    default:
      return TextFileFormat.PLAIN_TEXT // .txt の場合はデフォルトで PLAIN_TEXT と推測
  }
}
