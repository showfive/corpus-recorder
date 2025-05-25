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
  console.log('[textFileService] detectFormat received content (first 500 chars):', content.substring(0, 500));
  const lines = content.split('\n').filter(line => line.trim());
  console.log('[textFileService] detectFormat: Number of non-empty lines:', lines.length);

  if (lines.length === 0) {
    console.log('[textFileService] detectFormat: No lines, returning PLAIN_TEXT');
    return { format: TextFileFormat.PLAIN_TEXT, confidence: 1.0 };
  }

  const threshold = lines.length * 0.8;
  console.log('[textFileService] detectFormat: Detection threshold (80% of lines):', threshold);

  // Rohanコーパス形式の検出
  const rohanRegex = /^([^:]+):(.*[(（)].*),([ァ-ヴー、。]+[。？]?)$/; // 「、」も許容
  let rohanMatchesCount = 0;
  const nonMatchingRohanLines: string[] = [];

  // ITAコーパス形式の検出
  const itaRegex = /^([^:]+):(.+),([ァ-ヴー、。]+[。？]?)$/; // ★修正: 読み仮名に「。」を許可、末尾に「？」を許可
  let itaMatchesCount = 0;
  const nonMatchingItaLines: string[] = [];

  lines.forEach(line => {
    if (rohanRegex.test(line)) {
      rohanMatchesCount++;
    } else {
      // Rohan にマッチしなかったものを記録 (ログ出力は10件まで)
      if (nonMatchingRohanLines.length < 10) {
        nonMatchingRohanLines.push(line);
      }
    }

    if (itaRegex.test(line)) {
      itaMatchesCount++;
    } else {
      // ITA にマッチしなかったものを記録 (ログ出力は10件まで)
      if (nonMatchingItaLines.length < 10) {
        nonMatchingItaLines.push(line);
      }
    }
  });

  console.log('[textFileService] detectFormat: Rohan matches count:', rohanMatchesCount);
  if (rohanMatchesCount <= threshold && nonMatchingRohanLines.length > 0) {
    console.log('[textFileService] detectFormat: First few non-matching Rohan lines (up to 10):');
    nonMatchingRohanLines.forEach(l => console.log(l));
  }

  console.log('[textFileService] detectFormat: ITA matches count:', itaMatchesCount);
  if (itaMatchesCount <= threshold && nonMatchingItaLines.length > 0) {
    console.log('[textFileService] detectFormat: First few non-matching ITA lines (up to 10):');
    nonMatchingItaLines.forEach(l => console.log(l));
  }

  if (rohanMatchesCount > threshold) {
    console.log('[textFileService] detectFormat: Detected ROHAN_FORMAT');
    // Rohanと判定されても、Rohanにマッチしなかった行があれば出力（デバッグ用）
    const stillNotMatchingRohan = lines.filter(line => !rohanRegex.test(line));
    if (stillNotMatchingRohan.length > 0) {
      console.log(`[textFileService] detectFormat: (ROHAN detected) Still ${stillNotMatchingRohan.length} non-matching Rohan lines. First few (up to 10):`);
      stillNotMatchingRohan.slice(0, 10).forEach(l => console.log(l));
    }
    return { format: TextFileFormat.ROHAN_FORMAT, confidence: 0.9 };
  }

  if (itaMatchesCount > threshold) {
    console.log('[textFileService] detectFormat: Detected ITA_FORMAT');
    // ITAと判定されても、ITAにマッチしなかった行があれば出力（デバッグ用）
    const stillNotMatchingIta = lines.filter(line => !itaRegex.test(line));
    if (stillNotMatchingIta.length > 0) {
      console.log(`[textFileService] detectFormat: (ITA detected) Still ${stillNotMatchingIta.length} non-matching ITA lines. First few (up to 10):`);
      stillNotMatchingIta.slice(0, 10).forEach(l => console.log(l));
    }
    return { format: TextFileFormat.ITA_FORMAT, confidence: 0.9 };
  }

  // デフォルトはプレーンテキスト
  console.log(`[textFileService] detectFormat: Defaulting to PLAIN_TEXT because Rohan matches (${rohanMatchesCount}) and ITA matches (${itaMatchesCount}) did not exceed threshold (${threshold})`);
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
      console.warn(`[textFileService] parseItaFormat: Line did not match ITA format and will be skipped: ${line}`);
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
    const reading = textAndReading[1];    const rubyText: RubySegment[] = [];
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

    console.log(`[textFileService] rubyText for line ${index}:`, rubyText);

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
    let content = await fsPromises.readFile(filePath, 'utf-8');
    // BOMの除去 (U+FEFF)
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.substring(1);
      console.log('[textFileService] readAndParseTextFile: BOM detected and removed.');
    }
    console.log('[textFileService] readAndParseTextFile: Content read (first 500 chars after BOM check):', content.substring(0, 500));
    const detection = detectFormat(content);
    const texts = parseTextContent(content, detection.format);

    return {
      filePath,
      content,
      texts,
      format: detection.format
    };
  } catch (error) {
    console.error(`[textFileService] Failed to read or parse text file at ${filePath}:`, error); // ★エラーログにファイルパスを追加
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
