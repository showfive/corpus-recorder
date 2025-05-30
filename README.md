# Corpus Recorder

音声合成用の音声収録デスクトップアプリケーション

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D)](https://vuejs.org/)
[![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)](https://www.electronjs.org/)
[![Pinia](https://img.shields.io/badge/Pinia-ffd859?style=for-the-badge&logo=pinia&logoColor=black)](https://pinia.vuejs.org/)

## 🎯 概要

Corpus Recorderは、音声合成のためのコーパス（音声データセット）を効率的に収録するためのElectronベースのデスクトップアプリケーションです。

**✨ 最新リファクタリング完了**: モダンなアーキテクチャと高い保守性を実現

## 🚀 主な機能

### 📝 テキスト管理
- 複数形式のテキストファイル読み込み（.txt, .csv, Rohan形式）
- ルビ（ふりがな）対応
- 効率的なナビゲーション（前後移動、番号指定ジャンプ）

### 🎙️ 高品質録音
- Web Audio API による高品質録音（WAV形式）
- リアルタイム波形可視化
- ノイズサプレッション・エコーキャンセレーション設定
- Web Worker による音声処理の最適化

### 📊 音声管理
- 録音音声の再生・削除
- メタデータ管理（録音日時、テイク番号等）
- 効率的なファイル管理

### 🔧 開発者機能
- 包括的なデバッグパネル
- ログ管理・エラー追跡
- システム情報表示

## 🏗️ アーキテクチャ

### 最新の技術スタック

| 技術 | 用途 | バージョン |
|------|------|------------|
| **Electron** | クロスプラットフォーム | ^36.3.1 |
| **Vue.js 3** | リアクティブUI | ^3.5.14 |
| **TypeScript** | 型安全開発 | ^5.8.3 |
| **Pinia** | 状態管理 | ^3.0.2 |
| **Element Plus** | UIコンポーネント | ^2.9.11 |
| **Vite** | 高速ビルド | ^6.3.5 |
| **Vitest** | テスト環境 | ^3.1.4 |

### 🎨 設計パターン

#### **Dependency Injection (DI)** 
```typescript
// DIコンテナによる依存関係管理
import { container } from '@/common/di/container'
const recordingService = container.resolve<RecordingService>('recordingService')
```

#### **Composition API**
```typescript
// 再利用可能なComposable Hooks
export function useRecording() {
  return {
    isRecording, recordingTime, startRecording, stopRecording
  }
}
```

#### **Facade Pattern**
```typescript
// 外部サービスの統一インターフェース
export class AudioFacade {
  async startRecording(): Promise<void>
  async stopRecording(): Promise<ArrayBuffer>
}
```

## 📁 プロジェクト構造

```
corpus-recorder/
├── src/
│   ├── common/              # 共通モジュール
│   │   ├── di/             # 依存関係注入コンテナ
│   │   ├── errorHandler.ts # エラーハンドリング
│   │   ├── logger.ts       # ロギングシステム
│   │   ├── types.ts        # 型定義
│   │   └── ipcChannels.ts  # IPC通信管理
│   ├── renderer/           # レンダラープロセス（Vue.js）
│   │   ├── composables/    # Composition API Hooks
│   │   ├── components/     # Vueコンポーネント
│   │   ├── facades/        # ファサードレイヤー
│   │   ├── services/       # ビジネスロジック
│   │   ├── stores/         # Pinia状態管理
│   │   ├── workers/        # Web Workers
│   │   └── views/          # ページコンポーネント
│   ├── main/               # メインプロセス（Electron）
│   └── preload/            # プリロードスクリプト（参考用）
├── electron/
│   └── preload.cjs         # 実際のプリロードスクリプト
├── tests/                  # テストスイート
├── docs/                   # 技術文書
└── dist-electron/          # ビルド出力
```

### 🔧 主要コンポーネント

| コンポーネント | 責務 | ファイル |
|---------------|------|----------|
| **RecordingControls** | 録音制御UI | `components/RecordingControls/` |
| **TextDisplay** | テキスト表示 | `components/TextDisplay.vue` |
| **SettingsPanel** | 設定管理 | `components/SettingsPanel.vue` |
| **RecordingsList** | 音声リスト | `components/RecordingsList.vue` |

## ⚠️ 重要な技術的制約

### 🚨 Preload Script 制約

**ElectronのpreloadスクリプトはCommonJS形式でのみ動作します**

```
❌ 削除禁止: electron/preload.cjs
❌ TypeScript化不可: ModuleWrapエラーが発生
✅ 現在の実装: CommonJS形式で安定動作
```

**詳細**: [`docs/PRELOAD_SCRIPT_REQUIREMENTS.md`](docs/PRELOAD_SCRIPT_REQUIREMENTS.md)

### 🔐 セキュリティ考慮事項

- コンテキスト分離による安全なIPC通信
- サンドボックス環境でのレンダラープロセス実行
- 最小権限の原則に基づくAPI公開

## 🛠️ 開発環境セットアップ

### 必要な環境

- **Node.js** 16以上
- **npm** または **yarn**
- **Git**

### クイックスタート

```bash
# 1. リポジトリクローン
git clone https://github.com/yourusername/corpus-recorder.git
cd corpus-recorder

# 2. 依存関係インストール
npm install

# 3. 開発サーバー起動
npm run dev

# 4. テスト実行（確認用）
npm run test:run
```

## 📝 開発・ビルド・テスト

### 🔄 開発コマンド

```bash
# 開発モード起動（ホットリロード）
npm run dev

# TypeScript型チェック
npm run vue-tsc --noEmit

# Electronアプリ直接起動
npm run electron
```

### 🧪 テストコマンド

```bash
# テスト実行（ウォッチモード）
npm run test

# テスト一回実行
npm run test:run

# カバレッジ計測
npm run test:coverage

# テストUI起動
npm run test:ui
```

### 📦 ビルドコマンド

```bash
# フルビルド（型チェック + ビルド + パッケージング）
npm run build

# 型チェックをスキップした高速ビルド
npm run build-skip-tsc

# プレビュー（ビルド結果確認）
npm run preview
```

## 🎮 使い方

### 基本的な録音フロー

1. **📂 保存先設定**
   - 「フォルダを選択」で音声ファイル保存先を指定

2. **📄 テキスト読み込み**
   - 「コーパスを開く」で読み上げテキストを選択

3. **🎙️ 録音**
   - 「録音開始」→ テキスト読み上げ → 「録音停止」

4. **📊 確認・管理**
   - 録音音声の再生・削除
   - 次のテキストへ移動

### ⌨️ キーボードショートカット

| キー | 動作 |
|------|------|
| `Space` | 録音開始/停止 |
| `←` | 前のテキスト |
| `→` | 次のテキスト |
| `Ctrl+O` | ファイルを開く |

### 🔧 高度な設定

- **音声品質調整**: ノイズサプレッション、エコーキャンセレーション
- **デバッグモード**: ログ確認、システム情報表示
- **音声形式**: WAV（44.1kHz, 16bit）

## 🧪 テスト

### テスト構成

- **ユニットテスト**: Vitest + Vue Test Utils
- **モック環境**: Electron API、Web Audio API
- **カバレッジ**: V8プロバイダー

### テスト実行例

```bash
# 基本テスト
npm run test:run

# 結果例
✓ tests/unit/utils/audioUtils.test.ts (3 tests) 1ms
  ✓ Audio Utils > should format time correctly
  ✓ Audio Utils > should validate audio file extensions  
  ✓ Audio Utils > should calculate audio duration

Test Files  1 passed (1)
Tests  3 passed (3)
```

## 🐛 トラブルシューティング

### よくある問題

#### ❌ アプリが起動しない
```bash
# preloadスクリプト確認
ls -la electron/preload.cjs
npm run copy-preload
```

#### ❌ テストが失敗する
```bash
# キャッシュクリア
rm -rf node_modules/.vite
npm run test:run
```

#### ❌ ビルドエラー
```bash
# TypeScript確認
npm run vue-tsc --noEmit
```

### 🆘 サポート

問題が解決しない場合：

1. [Issues](https://github.com/yourusername/corpus-recorder/issues)で既存の問題を確認
2. 新しいIssueを作成（環境情報、エラーログを含める）
3. [Technical Documentation](docs/)で詳細を確認

## 🚀 パフォーマンス

### 最適化機能

- **Web Workers**: 音声処理をメインスレッドから分離
- **DIコンテナ**: 効率的な依存関係管理
- **Lazy Loading**: 必要時のみコンポーネント読み込み
- **Memory Management**: 適切なリソース解放

### ベンチマーク

- **起動時間**: < 3秒
- **録音レスポンス**: < 100ms
- **メモリ使用量**: < 200MB
- **音声処理**: Web Worker並列処理

## 🔮 ロードマップ

### 完了済み（v1.0）
- ✅ 基本録音機能
- ✅ Vue 3 + TypeScript リファクタリング
- ✅ DIアーキテクチャ
- ✅ テスト環境構築

### 計画中（v1.1）
- 🔄 リアルタイム音声解析
- 🔄 クラウド同期機能
- 🔄 多言語対応
- 🔄 プラグインシステム

## 🤝 貢献

### 貢献方法

1. **Fork** このリポジトリ
2. **Feature Branch** を作成: `git checkout -b feature/amazing-feature`
3. **コミット**: `git commit -m 'Add amazing feature'`
4. **Push**: `git push origin feature/amazing-feature`
5. **Pull Request** を作成

### 開発ガイドライン

- **コーディング規約**: ESLint + Prettier
- **型安全性**: strict TypeScript
- **テスト**: 新機能には必ずテストを追加
- **ドキュメント**: READMEとコメントの更新

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

## 🙏 謝辞

- **Electron Team** - 素晴らしいフレームワークの提供
- **Vue.js Community** - モダンなフロントエンド技術
- **Contributors** - このプロジェクトへの貢献

---

**💡 ヒント**: 開発を始める前に `docs/` ディレクトリの技術文書をご確認ください。

**📧 連絡先**: issues@corpus-recorder.com

**🌟 Star this repo** if you find it useful! 