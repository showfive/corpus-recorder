# Corpus Recorder リファクタリング計画

## 概要

このリファクタリング計画は、Corpus Recorderアプリケーションの保守性、拡張性、テスト容易性を向上させることを目的としています。計画は複数のフェーズに分かれており、段階的に改善を進めます。

## フェーズ1: 基盤整備と関心の分離

このフェーズでは、コードベースの基本的な構造を整理し、各モジュールの責務を明確に分離することを目指します。

### 1.1. IPCチャンネル名の一元管理

*   **目的**: IPC通信で使用するチャンネル名のハードコーディングを排除し、タイプミスを防ぎ、将来的な変更を容易にする。
*   **作業内容**:
    1.  `src/common/ipcChannels.ts` ファイルを新規作成します。
    2.  このファイル内に、現在 `src/main/index.ts` および `src/preload/index.ts` で使用されているIPCチャンネル名を定数として定義し、エクスポートします。
        ```typescript
        // src/common/ipcChannels.ts
        export const IPC_CHANNELS = {
          SELECT_DIRECTORY: 'select-directory',
          SAVE_AUDIO_FILE: 'save-audio-file',
          SAVE_AUDIO_FILE_WITH_METADATA: 'save-audio-file-with-metadata',
          DELETE_AUDIO_FILE: 'delete-audio-file',
          READ_TEXT_FILE: 'read-text-file',
          GET_SETTINGS: 'get-settings',
          UPDATE_SETTINGS: 'update-settings',
          APP_READY: 'app-ready'
          // 他のチャンネルがあれば追加
        } as const;
        ```
    3.  `src/main/index.ts` および `src/preload/index.ts` 内で、チャンネル名を直接文字列で指定している箇所を、`ipcChannels.ts` からインポートした定数に置き換えます。
*   **影響範囲**:
    *   `src/common/ipcChannels.ts` (新規作成)
    *   `src/main/index.ts`
    *   `src/preload/index.ts`
*   **期待効果**:
    *   タイプミスによるバグの防止。
    *   チャンネル名変更時の修正箇所の集約と作業漏れの防止。
    *   コードの可読性向上。
*   **完了の定義**:
    *   すべてのIPCチャンネル名が `ipcChannels.ts` で定義され、メインプロセスとプリロードスクリプトで参照されている。
    *   アプリケーションが以前と同様にIPC通信を介して正常に動作する。

### 1.2. `electron-store` の型付け改善

*   **目的**: `electron-store` で管理される設定オブジェクトに対する型安全性を向上させ、開発時のエラーを早期に発見できるようにする。
*   **作業内容**:
    1.  `src/common/types.ts` に `AppSettings` インターフェースが定義されていることを確認します。もし存在しない場合、または不完全な場合は定義・修正します。
        ```typescript
        // src/common/types.ts
        export interface AppSettings {
          recordingDirectory: string;
          lastOpenedTextFile?: string;
          lastTextIndex?: number;
          // 他の設定項目があれば追加
        }
        ```
    2.  `src/main/index.ts` の `Store` インスタンス生成時に、この `AppSettings` 型を適用します。
        ```typescript
        // src/main/index.ts
        // import { AppSettings } from '../common/types'; // 必要に応じてパスを調整
        // ...
        const store = new Store<AppSettings>({ // 型パラメータを指定
          defaults: {
            recordingDirectory: path.join(app.getPath('documents'), 'CorpusRecordings'),
            // lastOpenedTextFile: undefined, // defaultsで未定義にする場合はコメントアウトまたは削除
            // lastTextIndex: undefined,
          }
        });
        // store as any のキャストを削除
        ```
*   **影響範囲**:
    *   `src/common/types.ts`
    *   `src/main/index.ts`
*   **期待効果**:
    *   設定オブジェクトのプロパティへのアクセス時に型チェックが効き、タイプミスや存在しないプロパティへのアクセスを防ぐ。
    *   コード補完が有効になり、開発効率が向上する。
*   **完了の定義**:
    *   `Store` インスタンスが `AppSettings` 型で型付けされている。
    *   設定の読み書き時に型エラーが発生しない。
    *   アプリケーションが設定を正しく読み書きできる。

### 1.3. レンダラー側 Electron API 呼び出しの抽象化

*   **目的**: レンダラープロセスからメインプロセスへのIPC通信呼び出しを一層抽象化し、コンポーネントからの直接的な依存を減らす。テスト容易性を向上させる。
*   **作業内容**:
    1.  `src/renderer/services/electronService.ts` ファイルを新規作成します。
    2.  このファイル内で、`window.electronAPI` の各関数をラップするメソッドを持つサービスクラスまたはコンポーザブル関数を定義します。各メソッドは適切な型定義を持ちます。
        ```typescript
        // src/renderer/services/electronService.ts
        // import { AppSettings, AudioFileMetadata, CorpusText, TextFileFormat } from '../../common/types'; // 必要に応じて型をインポート

        // 例: コンポーザブル関数として実装する場合
        // import { type IpcRenderer } from 'electron'; // window.electronAPI の型を仮定
        // declare global {
        //   interface Window {
        //     electronAPI: {
        //       selectDirectory: () => Promise<string | null>;
        //       saveAudioFileWithMetadata: (arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        //       // 他のAPIメソッドの型定義
        //       readTextFile: () => Promise<{ filePath: string; content?: string; texts?: CorpusText[]; format?: TextFileFormat; error?: string } | null>;
        //       getSettings: () => Promise<Partial<AppSettings>>;
        //       updateSettings: (settings: Partial<AppSettings>) => Promise<Partial<AppSettings>>;
        //       deleteAudioFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
        //     };
        //   }
        // }

        // export function useElectronAPI() {
        //   const api = window.electronAPI;
        //   if (!api) {
        //     throw new Error('ElectronAPI is not available. Ensure preload script is loaded.');
        //   }
        //   return {
        //     selectDirectory: () => api.selectDirectory(),
        //     saveAudioFileWithMetadata: (arrayBuffer: ArrayBuffer, metadata: AudioFileMetadata) => api.saveAudioFileWithMetadata(arrayBuffer, metadata),
        //     readTextFile: () => api.readTextFile(),
        //     getSettings: () => api.getSettings(),
        //     updateSettings: (settings: Partial<AppSettings>) => api.updateSettings(settings),
        //     deleteAudioFile: (filePath: string) => api.deleteAudioFile(filePath),
        //     // 他のAPIメソッドをラップ
        //   };
        // }

        // またはサービスクラスとして
        class ElectronService {
          private api = window.electronAPI;

          constructor() {
            if (!this.api) {
              throw new Error('ElectronAPI is not available. Ensure preload script is loaded.');
            }
          }

          async selectDirectory(): Promise<string | null> {
            return this.api.selectDirectory();
          }

          async saveAudioFileWithMetadata(arrayBuffer: ArrayBuffer, metadata: any /* AudioFileMetadata */): Promise<{ success: boolean; filePath?: string; error?: string }> {
            return this.api.saveAudioFileWithMetadata(arrayBuffer, metadata);
          }

          async readTextFile(): Promise<{ filePath: string; content?: string; texts?: any[] /* CorpusText[] */; format?: any /* TextFileFormat */; error?: string } | null> {
            return this.api.readTextFile();
          }

          async getSettings(): Promise<Record<string, any> /* Partial<AppSettings> */> {
            return this.api.getSettings();
          }

          async updateSettings(settings: Record<string, any> /* Partial<AppSettings> */): Promise<Record<string, any> /* Partial<AppSettings> */> {
            return this.api.updateSettings(settings);
          }
           async deleteAudioFile(filePath: string): Promise<{ success: boolean; error?: string }> {
            return this.api.deleteAudioFile(filePath);
          }
          // 他のAPIメソッドをラップ
        }
        export const electronService = new ElectronService();
        ```
    3.  `RecordingView.vue` や他のコンポーネントで `window.electronAPI` を直接呼び出している箇所を、新しく作成したサービス/コンポーザブル関数経由の呼び出しに置き換えます。
*   **影響範囲**:
    *   `src/renderer/services/electronService.ts` (新規作成)
    *   `src/renderer/views/RecordingView.vue`
    *   その他 `window.electronAPI` を使用している可能性のあるVueコンポーネント
*   **期待効果**:
    *   IPC呼び出しロジックの集約と一元管理。
    *   コンポーネントが `window.electronAPI` の存在や詳細なインターフェースに直接依存しなくなる。
    *   ユニットテスト時に `electronService` をモックすることで、IPC通信部分のテストが容易になる。
*   **完了の定義**:
    *   すべての `window.electronAPI` 呼び出しが `electronService` (またはコンポーザブル関数) を経由している。
    *   アプリケーションが以前と同様にメインプロセスと通信し、正常に動作する。

### 1.4. 録音コアロジックの分離

*   **目的**: UIコンポーネントから録音のコアロジック（`MediaRecorder` APIの操作など）を分離し、再利用性とテスト容易性を高める。
*   **作業内容**:
    1.  `src/renderer/services/recordingService.ts` ファイルを新規作成します (または既存の `src/renderer/utils/audioUtils.ts` を拡張してサービスクラスにする)。
    2.  このサービスに、マイク入力の取得 (`navigator.mediaDevices.getUserMedia`)、`MediaRecorder` の初期化、録音開始 (`start`)、停止 (`stop`)、データ取得 (`ondataavailable` イベントの処理)、録音データの `Blob` または `ArrayBuffer` への変換といったロジックを実装します。
    3.  このサービスは、録音状態（例: `IDLE`, `RECORDING`, `STOPPED`）を内部で管理し、必要に応じてイベントを発行するか、状態を返すメソッドを提供します。
    4.  `src/renderer/components/RecordingControls.vue` (および関連する親コンポーネント `RecordingView.vue`) から、これらのコアロジックを新しい `recordingService` のメソッド呼び出しに置き換えます。`RecordingControls.vue` はUIの表示とユーザーインタラクションの受付、`recordingService` の呼び出しに専念します。
*   **影響範囲**:
    *   `src/renderer/services/recordingService.ts` (新規作成または `audioUtils.ts` を大幅変更)
    *   `src/renderer/components/RecordingControls.vue`
    *   `src/renderer/views/RecordingView.vue` (録音状態の管理や `recordingService` の利用方法が変わる可能性)
*   **期待効果**:
    *   録音に関するビジネスロジックがUIから分離され、単一責任の原則に近づく。
    *   `recordingService` が独立してテスト可能になる。
    *   `RecordingControls.vue` がUIに特化し、シンプルになる。
*   **完了の定義**:
    *   録音の開始、停止、データ処理のコアロジックが `recordingService` に実装されている。
    *   `RecordingControls.vue` が `recordingService` を利用して録音機能を実行する。
    *   録音機能が以前と同様に正常に動作する。

## フェーズ2: 状態管理の導入とコンポーネントの再設計

このフェーズでは、Vueアプリケーションの状態管理を改善し、コンポーネントの責務をより明確に分割することを目指します。

### 2.1. 状態管理ライブラリの導入 (Pinia を推奨)

*   **目的**: アプリケーション全体の状態を一元的に管理し、コンポーネント間の状態の受け渡しを簡素化する。`RecordingView.vue` の肥大化を防ぐ。
*   **作業内容**:
    1.  Pinia をプロジェクトにインストールします: `npm install pinia` または `yarn add pinia`。
    2.  `src/renderer/main.ts` で Pinia をセットアップします。
        ```typescript
        // src/renderer/main.ts
        import { createApp } from 'vue'
        import { createPinia } from 'pinia' // Piniaをインポート
        // ... 他のインポート
        import App from './App.vue'

        const app = createApp(App)
        app.use(createPinia()) // Piniaをuse
        // ... ElementPlusなど他のプラグイン
        app.mount('#app')
        ```
    3.  `src/renderer/stores/recordingStore.ts` (または適切な名前のストアファイル) を作成します。
    4.  このストアに、`RecordingView.vue` で管理されている主要な状態（例: `recordingDirectory`, `texts`, `currentTextIndex`, `recordingState`, `recordings`, `currentFileFormat`）を `state` として定義します。
    5.  これらの状態を操作するロジックを `actions` として定義します（例: `loadSettings`, `selectDirectory`, `loadTextFile`, `startRecording`, `stopRecording`, `navigateToText` など）。これらのアクション内で、フェーズ1で作成した `electronService` や `recordingService` を呼び出します。
    6.  派生状態を `getters` として定義します（例: `currentTextObject`, `currentRecordings`）。
    7.  `RecordingView.vue` および関連する子コンポーネントで、ローカルの `ref` や `computed` で管理していた状態を Pinia ストアから取得するように変更します。状態の変更はストアのアクションを呼び出すことで行います。
*   **影響範囲**:
    *   `package.json` (Piniaの追加)
    *   `src/renderer/main.ts` (Piniaのセットアップ)
    *   `src/renderer/stores/recordingStore.ts` (新規作成)
    *   `src/renderer/views/RecordingView.vue` (大幅な変更)
    *   `src/renderer/components/TextDisplay.vue`
    *   `src/renderer/components/RecordingControls.vue`
    *   `src/renderer/components/NavigationControls.vue`
*   **期待効果**:
    *   状態管理ロジックの一元化とコンポーネントからの分離。
    *   `RecordingView.vue` の大幅な簡素化。
    *   状態変更の追跡とデバッグの容易性向上。
    *   コンポーネント間の状態共有が容易になる（Props drillingの削減）。
    *   ストア自体がユニットテスト可能になる。
*   **完了の定義**:
    *   主要なアプリケーション状態と関連ロジックがPiniaストアに移行されている。
    *   各コンポーネントが必要な状態をストアから取得し、アクションを介して状態を変更する。
    *   アプリケーションが以前と同様に正常に動作し、状態が正しく管理・反映される。

### 2.2. コンポーネントの責務分割の推進

*   **目的**: `RecordingView.vue` の責務をさらに分割し、各コンポーネントをより小さく、単一責任に近づける。
*   **作業内容**:
    *   `RecordingView.vue` のテンプレートとロジックを見直し、論理的に分離可能な部分を新しい子コンポーネントとして切り出すことを検討します。
        *   **候補1: `RecordingsList.vue`**:
            *   責務: 特定のテキストに関連する録音済み音声のリスト表示、各音声の再生・削除UIの提供。
            *   `RecordingView.vue` から録音リスト (`currentRecordings` ゲッターから取得) をPropsとして受け取るか、Piniaストアから直接取得します。
            *   再生・削除のアクションはPiniaストアのアクションを呼び出します。
        *   **候補2: `SettingsPanel.vue`**:
            *   責務: 保存先ディレクトリの表示・選択ボタン、テキストファイルを開くボタンなどの設定関連UIの提供。
            *   関連する状態（例: `recordingDirectory`）はPiniaストアから取得し、操作はストアのアクションを呼び出します。
    *   新しいコンポーネントを作成し、`RecordingView.vue` のテンプレート内で使用します。PropsやEvents、またはPiniaストアを通じて親子間のデータフローを確立します。
*   **影響範囲**:
    *   `src/renderer/views/RecordingView.vue` (テンプレートとスクリプトの変更)
    *   `src/renderer/components/` (新しいコンポーネントファイルの追加)
*   **期待効果**:
    *   各コンポーネントの責務がより明確になり、コードの可読性と保守性が向上する。
    *   再利用可能なUI部品が増える。
    *   `RecordingView.vue` がさらにシンプルになり、オーケストレーションの役割に近づく。
*   **完了の定義**:
    *   `RecordingView.vue` から論理的なUI部品が新しいコンポーネントとして切り出されている。
    *   新しいコンポーネントが期待通りに動作し、PiniaストアまたはProps/Eventsを通じて適切に連携している。

## フェーズ3: 品質向上と仕上げ

このフェーズでは、エラーハンドリングの共通化、型定義の厳密化、そしてテストの導入を通じて、アプリケーション全体の品質と堅牢性を高めます。

### 3.1. エラーハンドリングの共通化・強化

*   **目的**: アプリケーション全体で一貫性のあるエラー処理方法を確立し、コードの重複を減らす。ユーザーへのフィードバックを改善する。
*   **作業内容**:
    1.  `src/renderer/utils/errorHandler.ts` (または類似の名称のファイル) を作成します。
    2.  このファイルに、共通のエラー処理関数を実装します。この関数はエラーオブジェクトを引数に取り、`ElMessage.error` を使ったユーザー通知、`console.error` でのログ出力などを行います。必要に応じて、エラーの種類 (`instanceof`) やエラーコードに基づいて異なるメッセージを表示するロジックも追加できます。
        ```typescript
        // src/renderer/utils/errorHandler.ts
        // import { ElMessage } from 'element-plus';

        // export function handleGlobalError(error: unknown, context?: string): void {
        //   let message = '不明なエラーが発生しました。';
        //   if (error instanceof Error) {
        //     message = error.message;
        //   } else if (typeof error === 'string') {
        //     message = error;
        //   }

        //   const displayMessage = context ? `[${context}] ${message}` : message;
        //   ElMessage.error(displayMessage);
        //   console.error(context || 'Global Error Handler:', error);
        // }
        ```
    3.  Piniaストアのアクション内や、その他の非同期処理を行う箇所（例: `electronService`）の `try...catch` ブロックで、この共通エラーハンドラを呼び出すように修正します。
*   **影響範囲**:
    *   `src/renderer/utils/errorHandler.ts` (新規作成)
    *   Piniaストアファイル (`src/renderer/stores/*.ts`)
    *   サービスファイル (`src/renderer/services/*.ts`)
    *   その他、エラーハンドリングを行っているVueコンポーネント
*   **期待効果**:
    *   エラー処理ロジックのDRY原則遵守。
    *   ユーザーへのエラー通知方法の一貫性向上。
    *   エラーログの集約と管理の容易化。
*   **完了の定義**:
    *   共通エラーハンドラが実装され、アプリケーション内の主要なエラー発生箇所で利用されている。
    *   エラー発生時に一貫した方法でユーザーに通知され、ログが出力される。

### 3.2. 型定義の網羅性と厳密性の向上

*   **目的**: `any` 型の使用を極力排除し、より具体的で厳密な型を使用することで、コードの安全性と可読性を高める。
*   **作業内容**:
    1.  プロジェクト全体 (`src` フォルダ以下) を対象に、`any` 型が使用されている箇所を特定します。
    2.  可能な限り、具体的な型（既存のインターフェース、カスタム型、ユーティリティ型など）に置き換えます。
    3.  特に以下の箇所の型定義を重点的に見直します:
        *   Piniaストアの `state`, `actions` の引数と戻り値、`getters` の戻り値。
        *   Vueコンポーネントの `props`、`emits`、`setup` 関数の戻り値。
        *   IPC通信で送受信されるデータオブジェクトの型 (`src/common/types.ts` を拡充)。
        *   サービス関数・メソッドの引数と戻り値。
    4.  `tsconfig.json` で `"noImplicitAny": true` や `"strictNullChecks": true` などのstrictオプションが有効になっていることを確認し、もし無効であれば有効化を検討します。
*   **影響範囲**:
    *   プロジェクト全体の `.ts` および `.vue` ファイル。
    *   `src/common/types.ts` (型の追加・修正が頻繁に発生する可能性)。
*   **期待効果**:
    *   コンパイル時の型チェックによるエラーの早期発見。
    *   コード補完の精度向上と開発効率の向上。
    *   コードの意図が明確になり、可読性と保守性が向上する。
*   **完了の定義**:
    *   プロジェクト内の `any` 型の使用が大幅に削減され、適切な型注釈が付与されている。
    *   TypeScriptのコンパイルエラーが発生しない。

### 3.3. テストの導入 (Vitest + Vue Test Utils)

*   **目的**: コードの品質を保証し、リファクタリングや機能追加時のリグレッションを防止する。変更に対する自信を高める。
*   **作業内容**:
    1.  Vitest と Vue Test Utils をプロジェクトにインストールします: `npm install -D vitest @vue/test-utils happy-dom` (または `jsdom`)。
    2.  `vite.config.ts` (または `vitest.config.ts`) にVitestの設定を追加します。
    3.  まずはユニットテストから作成を開始します。
        *   **対象候補**:
            *   ユーティリティ関数 (例: `src/renderer/utils/audioUtils.ts` の `audioBufferToWav`)
            *   サービス (例: `src/renderer/services/electronService.ts` の各メソッドのモック呼び出し確認、`src/renderer/services/recordingService.ts` のロジック)
            *   Piniaストア (アクションが正しくstateを変更するか、ゲッターが正しい値を返すかなど)
            *   `src/main/services/textFileService.ts` の各パーサー関数
    4.  次に、主要なVueコンポーネントのコンポーネントテストを作成します。
        *   **対象候補**:
            *   `TextDisplay.vue` (Propsに応じて正しく表示されるか)
            *   `RecordingControls.vue` (ボタンクリックでイベントがemitされるか、状態に応じて表示が変わるか)
            *   `NavigationControls.vue`
    5.  テストカバレッジを計測し、重要なロジックがテストでカバーされていることを確認します。
*   **影響範囲**:
    *   `package.json` (テストライブラリの追加)
    *   `vite.config.ts` または `vitest.config.ts` (テスト設定)
    *   各テスト対象ファイルの隣または `__tests__` ディレクトリなどにテストファイル (`*.spec.ts` または `*.test.ts`) を作成。
*   **期待効果**:
    *   コードの信頼性向上。
    *   バグの早期発見と修正コストの削減。
    *   安全なリファクタリングの実施。
    *   ドキュメントとしての役割も果たす。
*   **完了の定義**:
    *   主要なユーティリティ、サービス、ストア、コンポーネントに対してユニットテストまたはコンポーネントテストが作成されている。
    *   テストがCI/CDパイプライン（もしあれば）に組み込まれ、自動実行される。
    *   一定のカバレッジ目標を達成している（例: 70%以上）。

## 進め方と留意点

*   **段階的実施**: 上記のフェーズ、ステップごとにブランチを作成し、プルリクエスト（またはチーム内のレビュープロセス）を経てマージすることを推奨します。
*   **動作確認**: 各ステップ完了後には、必ず手動での動作確認を行い、既存機能が損なわれていないことを徹底的に確認します。
*   **小刻みなコミット**: 各タスク内でも、意味のある単位で小刻みにコミットし、変更内容を追いやすくします。
*   **チーム連携**: 複数人で作業する場合は、担当範囲を明確にし、定期的に進捗を共有します。
*   **ドキュメント更新**: リファクタリングに伴い、READMEやコード内のコメントなど、関連ドキュメントも適宜更新します。

この計画はあくまで提案であり、プロジェクトの状況や優先度に応じて調整可能です。
