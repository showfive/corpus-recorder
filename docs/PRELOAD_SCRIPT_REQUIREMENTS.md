# Preload Script Requirements - なぜpreload.cjsが必要なのか

## **概要**

Corpus Recorderプロジェクトでは、Electronのpreloadスクリプトとして**CommonJS形式の`electron/preload.cjs`**を使用する必要があります。TypeScript形式（`src/preload/index.ts`）への統一を試みましたが、技術的制約により不可能であることが判明しました。

## **技術的背景**

### **1. Electronのpreloadスクリプトの制約**

Electronのpreloadスクリプトは特殊な実行コンテキストで動作します：

- **Node.js環境**: メインプロセスのNode.js環境で実行される
- **セキュリティサンドボックス**: レンダラープロセスから隔離された環境
- **Module Resolution**: CommonJS形式でのモジュール解決が前提

### **2. TypeScript/ESModule形式での問題**

TypeScript版preloadスクリプトを使用すると以下のエラーが発生します：

```javascript
// エラーメッセージ例
SyntaxError: Failed to construct 'ModuleWrap': Unexpected token ')'
Unable to load preload script: /path/to/preload.js
```

**原因**:
- ViteでビルドされたESModule形式のJavaScriptがElectronのpreloadコンテキストと互換性がない
- `import/export`構文の解釈でModuleWrapエラーが発生
- TypeScriptの型情報やモジュール依存関係がruntime環境で解決できない

### **3. CommonJS形式が必要な理由**

| 要素 | CommonJS (.cjs) | TypeScript/ESM (.js) |
|------|-----------------|----------------------|
| **モジュール形式** | `require()`/`module.exports` | `import`/`export` |
| **Electron互換性** | ✅ 完全対応 | ❌ ModuleWrapエラー |
| **実行コンテキスト** | ✅ Node.js環境で安定 | ❌ ESM resolverエラー |
| **ビルド依存** | ❌ 不要（直接実行） | ✅ Viteトランスパイル必要 |
| **型安全性** | ❌ JavaScript | ✅ TypeScript |

## **現在の実装方針**

### **ファイル構成**

```
electron/
└── preload.cjs          # 実際に使用されるpreloadスクリプト（CommonJS）

src/preload/
└── index.ts             # 型定義・参考用（使用されない）
```

### **開発・本番環境での使い分け**

```typescript
// src/main/index.ts
const preloadPath = process.env.VITE_DEV_SERVER_URL 
  ? path.join(process.cwd(), 'electron/preload.cjs')      // 開発環境
  : path.join(__dirname, 'preload.cjs')                   // 本番環境
```

### **ビルドプロセス**

```json
// package.json
{
  "scripts": {
    "build": "vue-tsc --noEmit && vite build && npm run copy-preload && electron-builder",
    "copy-preload": "copyfiles -u 1 electron/preload.cjs dist-electron/"
  }
}
```

## **実装上の注意点**

### **1. コード重複の管理**

- `electron/preload.cjs`: 実際に動作するCommonJS版
- `src/preload/index.ts`: 型安全性・参考用（DIVコンテナで型として使用可能）

**対策**: IPCチャンネル名などの定数は`electron/preload.cjs`内で直接定義し、型情報が必要な場合のみ`src/preload/index.ts`から参照

### **2. 型安全性の確保**

preload.cjsは型チェックが行われないため：

```javascript
// electron/preload.cjs - 型アノテーションなし、でも動作確実
const electronAPI = {
  saveAudioFile: (arrayBuffer, fileName) => {
    return ipcRenderer.invoke('save-audio-file', arrayBuffer, fileName)
  }
}
```

```typescript
// src/renderer/facades/FileFacade.ts - 型アサーションで対応
const electronAPI = (window as any).electronAPI
```

### **3. メンテナンスのベストプラクティス**

1. **preload.cjsの変更時**: 必ず手動テストでElectron動作確認
2. **新しいIPCチャンネル追加時**: メインプロセスとpreload.cjs両方で一致確認
3. **型定義更新時**: `src/renderer/env.d.ts`のElectronAPI型定義も更新

## **過去の試行錯誤**

### **試行1: TypeScript版のビルド**
```typescript
// vite.config.ts - 失敗例
{
  entry: 'src/preload/index.ts',
  vite: {
    build: {
      lib: {
        formats: ['cjs']  // CommonJS形式でビルドしても失敗
      }
    }
  }
}
```
**結果**: ModuleWrapエラーは解決されず

### **試行2: モジュール依存の除去**
```typescript
// src/preload/index.ts - 型インポートを削除しても失敗
// import { IPC_CHANNELS } from '../common/types'  // 削除
const IPC_CHANNELS = { ... }  // 直接定義
```
**結果**: ESModule形式である限りエラー継続

## **結論**

**Electronのpreloadスクリプトは技術的制約により、CommonJS形式（.cjs）でのみ確実に動作します。**

この制約は：
- **Electronのアーキテクチャ設計**: preloadスクリプトのセキュリティモデル
- **Node.jsのモジュール解決**: CommonJSとESMの互換性問題
- **ビルドツールの限界**: ViteのESMビルドとElectronの不整合

に起因しており、根本的な解決は困難です。

## **将来の対応方針**

1. **現状維持**: `electron/preload.cjs`をCommonJS形式で維持
2. **Electron更新追跡**: 将来のElectronバージョンでESM対応改善を監視
3. **代替手段**: Electron以外のクロスプラットフォーム技術への移行時に再検討

---

**⚠️ 重要**: このドキュメントの内容を理解せずに preload.cjs を削除したり TypeScript化を試みると、アプリケーションが起動しなくなります。必ずこの技術的制約を考慮してください。 