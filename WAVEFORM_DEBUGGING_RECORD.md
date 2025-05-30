# 波形表示システム デバッグ・修正記録

**日時**: 2024年12月
**対象システム**: Corpus-Recorder (Electron + Vue3 + TypeScript)
**影響範囲**: 音声録音時のリアルタイム波形表示機能

## 概要
音声録音システムにおいて、録音中の波形表示が正常に動作しない複数の問題が発生し、段階的に解決を行った。本資料は、問題の根本原因と解決方法を記録し、将来の開発・リファクタリングで同様の問題を防ぐための参考資料とする。

---

## 問題1: 波形データが全く表示されない

### 症状
- 録音開始時に波形表示エリアが真っ黒のまま
- 音声録音自体は正常に動作
- マイクアクセス権限も正常に取得
- エラーログは特に表示されず

### 問題の根本原因
**DIコンテナによるサービスインスタンスの不一致**

```typescript
// 問題のあるコード
// recordingStore.ts
import { recordingService } from './recordingService' // シングルトンインスタンス

// useAudioVisualization.ts  
const recordingService = container.resolve<RecordingService>('recordingService') // 新しいインスタンス
```

- `recordingStore`はシングルトンの`recordingService`インスタンスを使用
- `useAudioVisualization`はDIコンテナから**別の新しいインスタンス**を取得
- 録音処理は正しいインスタンスで実行されるが、波形データ取得は空のインスタンスから行われていた

### どのように修正したか

```typescript
// 修正前: DIコンテナでクラスを登録（新しいインスタンス作成）
container.register('recordingService', RecordingService)

// 修正後: シングルトンインスタンスを登録
container.registerInstance('recordingService', recordingService)
```

### なぜそのような修正に至ったのか
1. **デバッグログの分析**: Analyser作成ログが全く出力されないことから、サービスインスタンスの問題を疑った
2. **DIコンテナの理解不足**: `register()`は新しいインスタンスを作成し、`registerInstance()`は既存インスタンスを登録することを認識
3. **シングルトンパターンの重要性**: 音声処理のような状態を持つサービスは、アプリケーション全体で一つのインスタンスを共有する必要がある

### リファクタリング時の注意点
- **DIコンテナ使用時は必ずインスタンス管理を明確化**
- シングルトンサービスの場合、`registerInstance()`を使用
- サービス間で状態を共有する場合、インスタンス一致を必ず確認
- 単体テスト時にモックを注入できるよう、DI設計を適切に行う
- **全期間保持時のメモリ管理**: 長時間録音時のメモリ使用量を監視
- 録音セッション終了時の適切なクリーンアップを実装

---

## 問題2: Vue.jsリアクティブシステムの限界

### 症状
- `recordingService.isAnalyserReady()`は`true`を返す
- `useAudioVisualization`の`isAnalyserReady`は`false`のまま
- アニメーションが開始されない
- 波形データは取得できているが描画されない

### 問題の根本原因
**Vue.jsのリアクティブシステムが外部サービスの内部状態変化を検出できない**

```typescript
// 問題のあるコード
const isAnalyserReady = computed(() => recordingService.isAnalyserReady())
// recordingService内部のanalyserプロパティ変更は、Vue.jsが検出できない
```

### どのように修正したか

```typescript
// 修正後: 手動状態管理
const isAnalyserReady = ref(false)

const updateAnalyserState = () => {
  const newState = recordingService.isAnalyserReady()
  if (isAnalyserReady.value !== newState) {
    isAnalyserReady.value = newState
  }
  return newState
}

// 必要なタイミングで手動更新
updateAnalyserState()
```

### なぜそのような修正に至ったのか
1. **Vue.jsリアクティブの制限理解**: Computed propertyは、Vueが管理するrefやreactiveオブジェクトの変化のみ検出
2. **外部サービス連携の課題**: 外部ライブラリやサービスの状態変化は、手動で同期する必要がある
3. **実用性重視**: 理想的にはObservableパターンだが、シンプルな手動更新で解決

### リファクタリング時の注意点
- **外部サービス連携時は必ず状態同期方法を設計**
- Observableパターンやイベントエミッターの導入を検討
- Vue.jsのwatch、computed依存関係を明確に理解
- 外部APIとVueリアクティブシステムの境界を明確化

---

## 問題3: FPS表示が常に0

### 症状
- 波形は正常に表示される
- パフォーマンス情報のFPS値が常に0
- アニメーション停止時のログでは正しいFPS値が出力される

### 問題の根本原因
**FPSモニターの`tick()`呼び出しタイミングの問題**

```typescript
// 問題のあるコード
const optimizedDraw = performanceOptimizer.throttleFrame(
  `${componentName}-draw`,
  (drawFn) => {
    fpsMonitor.tick() // スロットリングされた関数内でtick()
    drawFn(ctx, canvas)
  },
  targetFPS
)
```

スロットリング機能により、実際のフレーム数より少ない頻度で`tick()`が呼ばれていた。

### どのように修正したか

```typescript
// 修正後: 直接tick()呼び出し
const animateWaveform = () => {
  tickFPS() // アニメーションフレーム毎に確実に呼び出し
  // ... 波形描画処理
}

// useOptimizedCanvas側でtickFPS()を公開
const tickFPS = () => {
  fpsMonitor.value.tick()
}
```

### なぜそのような修正に至ったのか
1. **パフォーマンス最適化とモニタリングの競合**: 描画のスロットリングとFPS計測の競合を認識
2. **正確な計測の重要性**: FPS計測は最適化の効果測定に必要なため、正確性を優先
3. **レイヤー分離**: 描画最適化とパフォーマンス計測を分離

### リファクタリング時の注意点
- **パフォーマンス計測は最適化機能とは独立させる**
- スロットリング・デバウンス機能使用時は副作用を考慮
- FPSモニターはrequestAnimationFrameと1:1対応させる
- デバッグ用機能も本番環境での動作を考慮

---

## 問題4: CurrentFPSとAverageFPSが同じ値 → 最終的にシンプル化

### 症状
- FPS表示は動作するが、CurrentとAverageが全く同じ値
- 差分(Diff)が常に0
- リアルタイム性の確認ができない
- **追加問題**: 20秒経過後も平均FPSの変化が激しく、理論的な安定化が見られない

### 問題の根本原因
**FPS計算アルゴリズムの実装ミス + サンプル期間の制限 + 複雑性による予期しない動作**

```typescript
// 問題のあるコード（両方とも同じ実装）
getCurrentFPS(): number {
  const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]
  const frameCount = this.frameTimestamps.length - 1
  return (frameCount / timeSpan) * 1000
}

getAverageFPS(): number {
  const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]
  const frameCount = this.frameTimestamps.length - 1  
  return (frameCount / timeSpan) * 1000 // 同じ計算
}
```

**追加の問題**: 
- `maxSamples = 60`では、60FPSで動作時に約1秒分のデータしか保持できず、「現在FPS」と「平均FPS」が事実上同じ期間のデータを使用していた
- 全期間保持に修正後も、平均FPSが理論的に期待される安定化を示さず、デバッグとメンテナンスが複雑化

### どのように修正したか

**段階1**: 技術的修正の試行
```typescript
// 修正後1: サンプル数を大幅増加（全期間データ保持）
constructor(maxSamples: number = 36000) { // 60FPSで10分間 ≈ 実質全録音期間
  this.maxSamples = maxSamples
}

// 修正後2: 異なる期間で計算
getCurrentFPS(): number {
  // 直近0.2秒間のフレームレート（瞬間的）
  const now = this.frameTimestamps[this.frameTimestamps.length - 1]
  const recentTimestamps = this.frameTimestamps.filter(timestamp => now - timestamp <= 200)
  // ... 計算
}

getAverageFPS(): number {
  // 録音開始からの全期間の平均フレームレート（真の平均）
  const timeSpan = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]
  // ... 計算
}
```

**段階2**: 問題継続による設計変更
- 平均FPS計算の複雑性とデバッグの困難性を考慮
- パフォーマンス監視の実用性を優先し、シンプル化を決定

**最終解決策**: **平均FPS表示の完全廃止**
```typescript
// 最終的なシンプル化
// 表示用FPS値（0.5秒間隔で更新）
const displayFPS = ref({
  currentFPS: 0,        // 瞬間的FPS（0.2秒間）のみ
  isWebGLSupported: false
})

// UI表示も大幅にシンプル化
<div class="perf-stat">
  <span class="perf-label">FPS:</span>
  <span class="perf-value">{{ displayFPS.currentFPS.toFixed(1) }}</span>
</div>
<div class="perf-stat">
  <span class="perf-label">WebGL:</span>
  <span class="perf-value">{{ displayFPS.isWebGLSupported ? '✓' : '✗' }}</span>
</div>
```

### なぜそのような修正に至ったのか
1. **機能の明確な分離**: 瞬間的FPS（0.2秒）と真の平均FPS（全期間）の役割を明確化 → **試行したが問題継続**
2. **デバッグ情報の価値**: システム負荷の変動を正確に検出するため → **複雑すぎてメンテナンス困難**
3. **サンプル期間の最適化**: 0.2秒 vs 全録音期間で明確かつ意味のある差を作る → **期待した安定化が見られず**
4. **真の平均値の実現**: 録音開始からの全期間データにより、本当の平均パフォーマンスを測定 → **実装複雑性がメリットを上回る**
5. **実用性重視**: パフォーマンス監視に必要十分な情報は瞬間的FPSのみで達成可能
6. **シンプル設計の価値**: 複雑な機能より、確実に動作するシンプルな機能を優先

### リファクタリング時の注意点
- **計算アルゴリズムの目的を明確化**
- 瞬間値と平均値の計算期間を適切に設計
- サンプルサイズとメモリ使用量のバランス
- パフォーマンス計測機能自体のオーバーヘッドを考慮
- **全期間保持時のメモリ管理**: 長時間録音時のメモリ使用量を監視
- 録音セッション終了時の適切なクリーンアップを実装
- **機能の実用性 vs 実装複雑性のトレードオフを慎重に評価**
- **シンプルで確実な機能 > 高機能だが不安定な機能** の原則を適用

---

## 問題5: Retina対応とキャンバスサイズ

### 症状（解決済み、以前の修正）
- 高DPIディスプレイで波形がぼやける
- キャンバスサイズの不整合
- 描画パフォーマンスの低下

### 修正内容
- `devicePixelRatio`による適切なスケーリング
- CSS表示サイズと物理ピクセルサイズの分離
- Retina対応の描画コンテキスト設定

---

## 全体的な教訓とベストプラクティス

### 1. デバッグアプローチ
- **段階的な問題分離**: 複雑な問題は小さな問題に分解
- **ログ駆動デバッグ**: 各段階で詳細なログを出力
- **仮説検証**: 問題の仮説を立て、ログで検証

### 2. アーキテクチャ設計
- **責任の分離**: UI、ビジネスロジック、パフォーマンス監視を分離
- **依存関係の明確化**: DIコンテナ使用時は特に注意
- **状態管理の一元化**: 重要な状態は一箇所で管理

### 3. Vue.js特有の注意点
- **リアクティブシステムの限界を理解**
- 外部サービス連携時は手動同期を検討
- computedとrefの使い分けを明確に

### 4. パフォーマンス監視
- **監視機能は最適化機能と独立**
- デバッグ情報も本番品質で実装
- 計測オーバーヘッドを最小限に

### 5. 設計原則の重要性
- **シンプルさが最優先**: 複雑な機能より確実に動作するシンプルな機能
- **実用性 vs 実装コストのトレードオフ**: 機能の価値を実装コストで評価
- **段階的な改善**: 完璧を目指さず、動作する最小限の機能から開始
- **メンテナンス性重視**: 将来の修正・拡張が容易な設計

### 6. Electron特有の考慮点
- メインプロセスとレンダラープロセスの分離
- ネイティブAPI（Web Audio API）の適切な使用
- クロスプラットフォーム対応

---

## 今後の改善提案

### 1. パフォーマンス監視の拡張
- **CPUとメモリ使用量**: システムリソースの監視
- **音声品質指標**: 入力レベル、クリッピング検出
- **ストレージI/O**: 録音ファイル書き込みパフォーマンス
- **ただし**: 全て現在のシンプル設計原則に従い、段階的に実装

### 2. エラーハンドリング
- Web Audio API例外の詳細キャッチ
- デバイス接続/切断の検出
- 自動復旧機能の実装

### 3. ユーザー体験
- 波形表示のカスタマイズ機能
- スペクトログラム表示の実装
- 再生バーとシークバー機能

### 4. アーキテクチャ改善
- **マイクロサービス化**: 機能単位での分離を検討
- **プラグインアーキテクチャ**: 拡張可能な設計
- **テスト自動化**: 音声機能の自動テスト

---

## 関連ファイル

### 主要修正ファイル
- `src/common/di/serviceRegistry.ts` - DIコンテナ設定
- `src/renderer/components/RecordingControls/WaveformDisplay.vue` - UI表示
- `src/renderer/composables/useOptimizedCanvas.ts` - 描画最適化
- `src/common/performance/index.ts` - FPSモニター

### 関連するサービス
- `src/renderer/services/recordingService.ts` - 音声録音サービス
- `src/renderer/composables/useAudioVisualization.ts` - 音声可視化

---

**記録作成者**: Claude (Assistant)  
**レビュー推奨**: システム設計者、フロントエンド開発者  
**更新**: 新しい問題発見時に本資料を更新 