# Corpus Recorder

音声合成用の音声収録デスクトップアプリケーション

## 概要

Corpus Recorderは、音声合成のためのコーパス（音声データセット）を効率的に収録するためのElectronベースのデスクトップアプリケーションです。

## 主な機能

- 📝 テキストファイル（.txt, .csv）からの読み込み
- 🎙️ 高品質な音声録音（WAV形式）
- 📊 リアルタイム波形表示
- ⏯️ 録音した音声の再生・削除
- 🔄 効率的なナビゲーション（前の文、次の文、番号指定）
- 💾 カスタマイズ可能な保存先ディレクトリ

## 技術スタック

- **Electron** - クロスプラットフォームデスクトップアプリケーション
- **Vue.js 3** - リアクティブなUIフレームワーク
- **TypeScript** - 型安全な開発
- **Element Plus** - モダンなUIコンポーネントライブラリ
- **Vite** - 高速なビルドツール
- **Web Audio API** - 音声録音・処理

## ⚠️ 重要な技術的制約

### Preload Script Requirements

このプロジェクトでは、Electronのpreloadスクリプトとして**CommonJS形式の`electron/preload.cjs`**を使用する必要があります。

- ❌ **削除禁止**: `electron/preload.cjs`ファイルを削除するとアプリケーションが起動しなくなります
- ❌ **TypeScript化不可**: preloadスクリプトをTypeScript形式に変更することはできません
- ⚠️ **技術的理由**: ElectronのpreloadコンテキストとESModuleの非互換性

詳細については [`docs/PRELOAD_SCRIPT_REQUIREMENTS.md`](docs/PRELOAD_SCRIPT_REQUIREMENTS.md) を参照してください。

## 開発環境のセットアップ

### 必要な環境

- Node.js 16以上
- npm または yarn

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/corpus-recorder.git
cd corpus-recorder

# 依存関係のインストール
npm install
```

### 開発モードで実行

```bash
npm run dev
```

### ビルド

```bash
# すべてのプラットフォーム向けにビルド
npm run build

# プラットフォーム別のビルド
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## 使い方

1. アプリケーションを起動
2. 「フォルダを選択」ボタンで音声ファイルの保存先を指定
3. 「テキストファイルを開く」ボタンで読み上げるテキストファイルを選択
4. 「録音開始」ボタンで録音を開始
5. テキストを読み上げたら「録音停止」ボタンで停止
6. 「次の文」ボタンで次のテキストに移動
7. 必要に応じて録音した音声を再生・削除

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。 