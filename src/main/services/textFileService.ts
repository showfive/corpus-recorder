import { promises as fsPromises } from 'fs'
import * as path from 'path'
import { CorpusText, RubySegment, TextFileReadResult, TextFileFormat } from '../../common/types'
import { createLogger } from '../../common/logger'

const logger = createLogger('TextFileService')

// フォーマット検出の結果
interface FormatDetectionResult {
  format: TextFileFormat
  confidence: number
}

/**
 * テキストファイルのフォーマットを検出する
 */
function detectFormat(content: string): FormatDetectionResult {
  const lines = content.split('\n').filter(line => line.trim());
  const totalLines = lines.length;
  const threshold = Math.max(1, Math.floor(totalLines * 0.7)); // 70%以上がマッチすれば該当フォーマットと判定

  logger.debug('Format detection started', {
    totalLines,
    threshold,
    component: 'TextFileService',
    method: 'detectFormat'
  })

  // Rohanフォーマットの検出
  const rohanRegex = /^[^:]+:[^,]+,[ァ-ヴー、。]+$/;
  const rohanMatchesCount = lines.filter(line => rohanRegex.test(line)).length;

  // ITAフォーマットの検出
  const itaRegex = /^[^:]+:[^,]+,[ァ-ヴー、。]+[。？]?$/;
  const itaMatchesCount = lines.filter(line => itaRegex.test(line)).length;
  const nonMatchingItaLines = lines.filter(line => !itaRegex.test(line));

  logger.debug('Format detection results', {
    rohanMatchesCount,
    itaMatchesCount,
    nonMatchingItaLinesCount: nonMatchingItaLines.length,
    component: 'TextFileService',
    method: 'detectFormat'
  })

  if (itaMatchesCount <= threshold && nonMatchingItaLines.length > 0) {
    logger.debug('Non-matching ITA lines detected', {
      sampleLines: nonMatchingItaLines.slice(0, 10),
      component: 'TextFileService',
      method: 'detectFormat'
    })
  }

  if (rohanMatchesCount > threshold) {
    logger.info('Detected ROHAN_FORMAT', {
      matchesCount: rohanMatchesCount,
      component: 'TextFileService',
      method: 'detectFormat'
    })
    // Rohanと判定されても、Rohanにマッチしなかった行があれば出力（デバッグ用）
    const stillNotMatchingRohan = lines.filter(line => !rohanRegex.test(line));
    if (stillNotMatchingRohan.length > 0) {
      logger.debug('Non-matching Rohan lines found', {
        nonMatchingCount: stillNotMatchingRohan.length,
        sampleLines: stillNotMatchingRohan.slice(0, 10),
        component: 'TextFileService',
        method: 'detectFormat'
      })
    }
    return { format: TextFileFormat.ROHAN_FORMAT, confidence: 0.9 };
  }

  if (itaMatchesCount > threshold) {
    logger.info('Detected ITA_FORMAT', {
      matchesCount: itaMatchesCount,
      component: 'TextFileService',
      method: 'detectFormat'
    })
    // ITAと判定されても、ITAにマッチしなかった行があれば出力（デバッグ用）
    const stillNotMatchingIta = lines.filter(line => !itaRegex.test(line));
    if (stillNotMatchingIta.length > 0) {
      logger.debug('Non-matching ITA lines found', {
        nonMatchingCount: stillNotMatchingIta.length,
        sampleLines: stillNotMatchingIta.slice(0, 10),
        component: 'TextFileService',
        method: 'detectFormat'
      })
    }
    return { format: TextFileFormat.ITA_FORMAT, confidence: 0.9 };
  }

  // デフォルトはプレーンテキスト
  logger.info('Defaulting to PLAIN_TEXT', {
    rohanMatchesCount,
    itaMatchesCount,
    threshold,
    component: 'TextFileService',
    method: 'detectFormat'
  })
  return { format: TextFileFormat.PLAIN_TEXT, confidence: 0.5 };
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
  const lines = content.split('\n').filter(line => line.trim());
  const texts: CorpusText[] = [];
  // 読点「、」、句点「。」、疑問符「？」を許容するように修正
  const itaRegex = /^([^:]+):(.+),([ァ-ヴー、。]+[。？]?)$/; // ★修正: 読み仮名に「。」を許可、末尾に「？」を許可

  lines.forEach((line, index) => {
    const match = line.match(itaRegex);
    if (match) {
      const label = match[1];
      const text = match[2];
      const reading = match[3];

      texts.push({
        id: `text-${index}`,
        index,
        text,
        label,
        reading
      });
    } else {
      logger.warn('Line did not match ITA format and will be skipped', {
        line,
        lineIndex: index,
        component: 'TextFileService',
        method: 'parseItaFormat'
      })
    }
  });

  return texts;
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
    // 正規表現を修正: ルビの親文字を漢字に限定
    const regex = /([\u4E00-\u9FFF]+)\(([^)]+)\)/g;
    let match;
    
    while ((match = regex.exec(rawText)) !== null) {
      // マッチした部分より前のテキストがあれば追加
      if (match.index > lastIndex) {
        const beforeText = rawText.substring(lastIndex, match.index);
        if (beforeText.trim()) {
          rubyText.push(beforeText);
        }
      }
      
      // ルビ付きテキストを追加
      rubyText.push({ 
        base: match[1], 
        ruby: match[2] 
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // 残りのテキストがあれば追加
    if (lastIndex < rawText.length) {
      const remainingText = rawText.substring(lastIndex);
      if (remainingText.trim()) {
        rubyText.push(remainingText);
      }
    }

    logger.debug('Ruby text parsed', {
      lineIndex: index,
      rubyText,
      component: 'TextFileService',
      method: 'parseRohanFormat'
    })

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
export async function readAndParseTextFile(filePath: string): Promise<TextFileReadResult> {
  try {
    let content = await fsPromises.readFile(filePath, 'utf-8');
    // BOMの除去 (U+FEFF)
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.substring(1);
      logger.info('BOM detected and removed', {
        filePath,
        component: 'TextFileService',
        method: 'readAndParseTextFile'
      })
    }
    logger.debug('Content read successfully', {
      filePath,
      contentPreview: content.substring(0, 500),
      component: 'TextFileService',
      method: 'readAndParseTextFile'
    })
    const detection = detectFormat(content);
    const texts = parseTextContent(content, detection.format);

    return {
      filePath,
      content,
      texts,
      format: detection.format
    };
  } catch (error) {
    logger.error('Failed to read or parse text file', {
      filePath,
      error: error instanceof Error ? error.message : error,
      component: 'TextFileService',
      method: 'readAndParseTextFile'
    })
    // TextFileResult に合わせてエラーをラップするか、呼び出し元で処理するためここでは投げ返す
    // 今回は呼び出し元 (main/index.ts) で catch してエラーオブジェクトを返しているので、そのまま投げ返す
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
