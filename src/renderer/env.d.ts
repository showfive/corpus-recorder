/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron API の型定義

// src/common/types.ts からの型定義
type RubySegment = string | { base: string; ruby: string };

interface CorpusText {
  id: string;
  index: number;
  text: string; // プレーンテキスト、または読み仮名注釈付きの原文
  label?: string; // コーパス文ラベル (ITA/Rohanフォーマット用)
  reading?: string; // カタカナの読み (ITA/Rohanフォーマット用)
  rubyText?: RubySegment[]; // ルビ情報を含む解析済みテキスト (Rohanフォーマット用)
  // recordings?: Recording[]; // Recording型も必要になるが、一旦コメントアウト。必要に応じて追加
}

enum TextFileFormat {
  PLAIN_TEXT = 'plain-text',
  ITA_FORMAT = 'ita-format',
  ROHAN_FORMAT = 'rohan-format'
}

interface TextFileResult {
  filePath: string;
  content: string; // ファイルの生の内容
  texts: CorpusText[]; // 解析されたテキストオブジェクトの配列
  format: TextFileFormat; // 検出されたファイルフォーマット
  error?: string; // エラーメッセージ (読み込み失敗時)
}


interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  saveAudioFile: (arrayBuffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  saveAudioFileWithMetadata: (arrayBuffer: ArrayBuffer, metadata: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  deleteAudioFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  readTextFile: () => Promise<TextFileResult | null>;
  getSettings: () => Promise<Record<string, any>>;
  updateSettings: (settings: Record<string, any>) => Promise<Record<string, any>>;
}

interface Window {
  electronAPI: ElectronAPI;
}