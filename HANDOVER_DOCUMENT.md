# Corpus Recorder リファクタリング 引き継ぎ資料

**作成日**: 2024年12月現在  
**対象**: 次期開発担当者  
**プロジェクト**: Corpus Recorder（音声合成用音声収録デスクトップアプリケーション）

---

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [リファクタリング進捗状況](#リファクタリング進捗状況)
3. [完了済み項目の詳細](#完了済み項目の詳細)
4. [重要な技術的制約](#重要な技術的制約)
5. [残りのタスク](#残りのタスク)
6. [ファイル構造説明](#ファイル構造説明)
7. [開発環境セットアップ](#開発環境セットアップ)
8. [次の担当者への具体的アクション](#次の担当者への具体的アクション)

---

## 📝 プロジェクト概要

### アプリケーション概要
- **名前**: Corpus Recorder
- **用途**: 音声合成用の音声収録デスクトップアプリケーション
- **技術スタック**: Vue 3 + TypeScript + Pinia + Electron
- **主要機能**: テキスト読み上げ音声の録音、管理、再生

### リファクタリングの目的
- **保守性向上**: 40-50%のコード削減とモジュール化
- **テスタビリティ向上**: DIによる依存関係の明確化
- **パフォーマンス向上**: Web Worker導入で30-40%の応答性改善
- **開発効率向上**: Composableによる再利用性向上

---

## 📊 リファクタリング進捗状況

### ✅ 完了済み項目（約85%完了）

#### **Phase 1: アーキテクチャの整理（100%完了）**
- ✅ **DIコンテナの導入**: `src/common/di/` に完全実装済み
- ✅ **ファサードパターンの実装**: `AudioFacade.ts`、`FileFacade.ts` 実装済み
- ✅ **エラーハンドリング統一**: `src/common/errorHandler.ts` 完成
- ✅ **IPCチャンネル名一元管理**: `src/common/ipcChannels.ts` 完成

#### **Phase 2: コンポーネント分割とComposition API（100%完了）**
- ✅ **Piniaストア**: `recordingStore.ts` 実装済み（399行の包括的な状態管理）
- ✅ **Composable Hooks**: 4つ全て実装済み
  - `useRecording.ts` - 録音機能の抽象化
  - `useAudioVisualization.ts` - 音声可視化
  - `useKeyboardShortcuts.ts` - キーボードショートカット
  - `useAudioWorker.ts` - Web Worker連携
- ✅ **コンポーネント分割**: 
  - `RecordingControls/` ディレクトリに細分化完了
  - `SettingsPanel.vue`、`RecordingsList.vue`、`TextDisplay.vue`、`NavigationControls.vue` 分離済み

#### **Phase 3: パフォーマンス最適化（80%完了）**
- ✅ **Web Workers**: `audioProcessor.worker.ts` 実装済み（234行）
- ✅ **サービス層**: 複数のサービスクラス実装済み
- ✅ **テスト環境**: Vitest + Vue Test Utils + Happy DOM セットアップ完了

### 🔄 残りのタスク（約15%）

#### **Phase 3.3: 最終調整（未完了）**
1. メインプロセスでのIPCチャンネル名統一
2. 型定義の厳密化（`any`型削減）
3. より包括的なテストの追加

---

## 🔧 完了済み項目の詳細

### 1. DIコンテナ（`src/common/di/`）
```typescript
// container.ts - 完全に動作するDIコンテナ
export class Container implements DIContainer {
  private services: ServiceRegistry = {}
  private instances: Map<string, any> = new Map()
  // 依存関係の解決、シングルトン管理機能実装済み
}
```

### 2. Composable Hooks（`src/renderer/composables/`）
```typescript
// useRecording.ts - 録音機能の完全な抽象化
export function useRecording() {
  // 状態管理、イベントハンドリング、メソッド提供
  return {
    isRecording, recordingTime, startRecording, stopRecording, ...
  }
}
```

### 3. コンポーネント分割
```
src/renderer/components/
├── RecordingControls/
│   ├── index.vue            # 統合コンポーネント
│   ├── RecordingButton.vue  # 録音ボタン
│   ├── RecordingStatus.vue  # ステータス表示
│   └── WaveformDisplay.vue  # 波形表示
├── SettingsPanel.vue        # 設定パネル
├── RecordingsList.vue       # 録音リスト
└── TextDisplay.vue          # テキスト表示
```

### 4. Piniaストア（`src/renderer/stores/recordingStore.ts`）
```typescript
export const useRecordingStore = defineStore('recording', () => {
  // 399行の包括的な状態管理
  // - 録音ディレクトリ管理
  // - テキスト管理
  // - 録音状態管理
  // - 音声品質設定
})
```

### 5. Web Worker（`src/renderer/workers/audioProcessor.worker.ts`）
```typescript
// 234行の音声処理ワーカー
// - WAV形式変換
// - 音量解析
// - 波形生成
// - スペクトラム計算
```

### 6. テスト環境
```typescript
// vitest.config.ts - 完全設定済み
// tests/setup.ts - モック環境構築済み
// tests/unit/utils/audioUtils.test.ts - サンプルテスト動作確認済み
```

---

## ⚠️ 重要な技術的制約

### 1. プリロードスクリプトの制約
**🚨 重要**: プリロードスクリプトの統一は**技術的に不可能**

#### 理由
- ElectronのpreloadスクリプトはCommonJS形式でのみ確実に動作
- TypeScript/ESModule形式に変更するとModuleWrapエラーが発生
- この制約はElectronのアーキテクチャ設計に起因

#### 現在の構成（正解）
```
electron/
└── preload.cjs          # ✅ 実際に使用（CommonJS、動作確実）

src/preload/
└── index.ts             # ⚠️ 型定義・参考用のみ（使用されない）
```

#### 関連資料
- `docs/PRELOAD_SCRIPT_REQUIREMENTS.md` - 詳細な技術解説
- `electron/preload.cjs` - 先頭コメントに技術的制約の説明

### 2. IPCチャンネル名の管理
- `src/common/ipcChannels.ts` - レンダラー・メインプロセス用
- `electron/preload.cjs` - 内部で直接定義（技術的制約により分離必要）

### 3. ビルドプロセス
```json
{
  "scripts": {
    "build": "vue-tsc --noEmit && vite build && npm run copy-preload && electron-builder",
    "copy-preload": "copyfiles -u 1 electron/preload.cjs dist-electron/"
  }
}
```

---

## 📁 ファイル構造説明

### 主要ディレクトリ
```
corpus-recorder/
├── src/
│   ├── common/              # 共通モジュール
│   │   ├── di/             # DIコンテナ（完成）
│   │   ├── errorHandler.ts # エラーハンドリング（完成）
│   │   ├── logger.ts       # ロギング機能（完成）
│   │   ├── types.ts        # 型定義（要拡張）
│   │   └── ipcChannels.ts  # IPCチャンネル管理（完成）
│   ├── renderer/           # レンダラープロセス
│   │   ├── composables/    # Composition API（完成）
│   │   ├── components/     # Vueコンポーネント（完成）
│   │   ├── facades/        # ファサード（完成）
│   │   ├── services/       # サービス層（完成）
│   │   ├── stores/         # Piniaストア（完成）
│   │   └── workers/        # Web Workers（完成）
│   ├── main/               # メインプロセス
│   │   └── index.ts        # 要IPC更新
│   └── preload/
│       └── index.ts        # 参考用のみ
├── electron/
│   └── preload.cjs         # 実際使用（CommonJS）
├── tests/                  # テスト環境（セットアップ完了）
├── docs/                   # 技術資料
└── refactoring_plan.md     # 原計画書
```

### 重要ファイル一覧
| ファイル | 状態 | 説明 |
|---------|------|------|
| `src/common/di/container.ts` | ✅完成 | DIコンテナの核心 |
| `src/renderer/stores/recordingStore.ts` | ✅完成 | 状態管理の中枢 |
| `src/renderer/composables/useRecording.ts` | ✅完成 | 録音機能抽象化 |
| `src/main/index.ts` | 🔄要更新 | IPC統一が必要 |
| `electron/preload.cjs` | ✅完成 | 削除・変更禁止 |
| `vitest.config.ts` | ✅完成 | テスト設定 |

---

## 🔄 残りのタスク

### 最優先（所要時間: 約45分）

#### 1. メインプロセスのIPC統一（10分）
**ファイル**: `src/main/index.ts`
**作業内容**:
```typescript
// Before
ipcMain.handle('select-directory', ...)

// After
import { IPC_CHANNELS } from '../common/ipcChannels'
ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, ...)
```

#### 2. 型定義の厳密化（30分）
**ファイル**: `src/common/types.ts`
**作業内容**:
- `any`型の削減
- より具体的な型注釈の追加
- プロジェクト全体の型チェック

#### 3. preload.cjsの整合性確認（5分）
**ファイル**: `electron/preload.cjs`
**作業内容**:
- IPC_CHANNELSとの整合性確認
- 必要に応じて定数値の調整

### 中優先（所要時間: 2-3時間）

#### 4. テストの拡充
- コンポーネントテストの追加
- サービス層のテスト
- 統合テスト

#### 5. パフォーマンス最適化
- 仮想スクロール実装
- Canvas描画最適化

---

## 🛠️ 開発環境セットアップ

### 必要な依存関係（インストール済み）
```json
{
  "devDependencies": {
    "vitest": "^3.1.4",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^17.5.6",
    "@vitest/coverage-v8": "^3.1.4"
  }
}
```

### 利用可能なスクリプト
```bash
# 開発サーバー起動
npm run dev

# テスト実行
npm run test          # ウォッチモード
npm run test:run      # 一回実行
npm run test:coverage # カバレッジ計測

# ビルド
npm run build
```

### テスト環境
- ✅ **Vitest**: セットアップ完了
- ✅ **Vue Test Utils**: 設定済み
- ✅ **モック環境**: ElectronAPI、Web Audio API等
- ✅ **サンプルテスト**: `tests/unit/utils/audioUtils.test.ts` 動作確認済み

---

## 🎯 次の担当者への具体的アクション

### 最初に行うべきこと（30分以内）

#### 1. 環境確認
```bash
# リポジトリクローン後
npm install
npm run test:run    # テストが通ることを確認
npm run dev         # アプリが起動することを確認
```

#### 2. コードベース理解
以下の順序で主要ファイルを確認：
1. `src/common/di/container.ts` - DIコンテナの仕組み
2. `src/renderer/stores/recordingStore.ts` - 状態管理の構造
3. `src/renderer/composables/useRecording.ts` - 録音機能の抽象化
4. `docs/PRELOAD_SCRIPT_REQUIREMENTS.md` - 重要な技術制約

#### 3. 第一タスクの実行
**メインプロセスのIPC統一**（最も簡単で影響度大）
```typescript
// src/main/index.ts の更新
import { IPC_CHANNELS } from '../common/ipcChannels'

// 全てのipcMain.handleでIPC_CHANNELSを使用
ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
  // 既存の実装
})
```

### 中期的な作業方針

#### 1. 段階的実装
- 各タスクを個別のブランチで実装
- 動作確認を徹底的に実施
- 小刻みなコミットで変更追跡

#### 2. 品質保証
- テストカバレッジ70%以上を目標
- リグレッションテストの実施
- パフォーマンス計測

#### 3. ドキュメント更新
- README.mdの更新
- APIドキュメントの整備
- 新機能の設計書作成

---

## 📚 重要な参考資料

### プロジェクト内資料
- `refactoring_plan.md` - 原計画書（370行の詳細計画）
- `docs/PRELOAD_SCRIPT_REQUIREMENTS.md` - プリロード制約の詳細
- `HANDOVER_DOCUMENT.md` - この引き継ぎ資料

### コードベース内の重要なコメント
- `electron/preload.cjs` - 先頭の技術制約コメント
- `src/common/di/container.ts` - DIパターンの実装解説
- `src/renderer/workers/audioProcessor.worker.ts` - Worker実装の詳細

### 外部資料
- [Electron Documentation](https://www.electronjs.org/docs) - preloadスクリプトの制約
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia Documentation](https://pinia.vuejs.org/)

---

## ⚡ 緊急時の対応

### アプリが起動しない場合
1. `electron/preload.cjs` が存在することを確認
2. `npm run copy-preload` を実行
3. `dist-electron/` ディレクトリに preload.cjs がコピーされているか確認

### テストが失敗する場合
1. `tests/setup.ts` のモック設定を確認
2. 依存関係の最新化: `npm update`
3. キャッシュクリア: `rm -rf node_modules/.vite`

### ビルドが失敗する場合
1. TypeScriptエラーの確認: `npm run vue-tsc --noEmit`
2. viteビルドの確認: `npm run vite build`
3. preloadコピーの確認: `npm run copy-preload`

---

## 📞 引き継ぎ完了の確認

次の担当者は以下を確認して引き継ぎ完了としてください：

### ✅ チェックリスト
- [ ] 開発環境のセットアップ完了
- [ ] テスト実行成功（`npm run test:run`）
- [ ] アプリケーション起動確認（`npm run dev`）
- [ ] 主要ファイルの内容理解
- [ ] 技術的制約の理解（特にプリロード制約）
- [ ] 第一タスク（IPC統一）の実行準備

### 🚀 次のマイルストーン
- [ ] Phase 3.3完了（残りタスク3つ）
- [ ] テストカバレッジ70%達成
- [ ] パフォーマンス計測・最適化
- [ ] ドキュメント完成

---

**作成者コメント**: このプロジェクトは既に非常に高い品質に達しており、残りの作業は主に細かい調整とテストの充実です。特にDIコンテナとComposition APIの活用により、保守性と拡張性が大幅に向上しています。技術的制約（特にプリロード制約）を理解すれば、スムーズに作業を継続できるはずです。

**最終更新**: 2024年12月現在 