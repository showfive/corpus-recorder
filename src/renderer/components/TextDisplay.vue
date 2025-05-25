<template>
  <div class="text-display">
    <el-card v-if="props.currentText">
      <template #header>
        <div class="card-header">
          <span>読み上げテキスト</span>
          <el-tag v-if="props.fileFormat" type="info" size="small">{{ props.fileFormat }}</el-tag>
          <el-tag v-if="props.totalTexts > 0" type="info">{{ props.textIndex + 1 }} / {{ props.totalTexts }}</el-tag>
        </div>
      </template>
      <div class="text-content">
        <div v-if="props.currentText.label" class="text-label">
          ラベル: {{ props.currentText.label }}
        </div>
        <div
          class="main-text"
          v-if="props.fileFormat === 'rohan-format' && props.currentText.rubyText"
          v-html="generateRubyHtml(props.currentText.rubyText)"
        ></div>
        <div class="main-text" v-else>
          {{ props.currentText.text }}
        </div>
        <div v-if="props.currentText.reading" class="text-reading">
          読み: {{ props.currentText.reading }}
        </div>
      </div>
    </el-card>
    <el-card v-else>
       <template #header>
        <div class="card-header">
          <span>読み上げテキスト</span>
        </div>
      </template>
      <div class="text-content">
        <p class="no-text">テキストファイルを読み込んでください</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { CorpusText, RubySegment, TextFileFormat } from '../../common/types'; // RubySegment と TextFileFormat をインポート

interface Props {
  currentText: CorpusText | null; // string から CorpusText | null に変更
  textIndex: number;
  totalTexts: number;
  fileFormat: TextFileFormat | null; // 新規：ファイルフォーマットを受け取る
}

const props = defineProps<Props>();

// RohanフォーマットのルビテキストからHTMLを生成するヘルパー関数
function generateRubyHtml(rubyText: RubySegment[] | undefined): string {
  if (!rubyText) return '';
  return rubyText.map(segment => {
    if (typeof segment === 'string') {
      return segment;
    } else {
      // 安全のため、基本的なエスケープ処理
      const escapeHtml = (unsafe: string) =>
        unsafe.replace(/[&<>"']/g, (match) => {
          switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return match;
          }
        });
      return `<ruby>${escapeHtml(segment.base)}<rt>${escapeHtml(segment.ruby)}</rt></ruby>`;
    }
  }).join('');
}
</script>

<style scoped>
.text-display {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-content {
  /* font-size: 18px; // main-text に移動 */
  line-height: 1.8;
  padding: 20px 0;
  min-height: 100px;
  /* display: flex; // 解除して自然なフローに */
  /* align-items: center; // 解除 */
  /* justify-content: center; // 解除 */
}

.text-label, .text-reading {
  font-size: 0.9em;
  color: #606266;
  margin-bottom: 8px;
}
.main-text {
  font-size: 18px; /* ここでフォントサイズを指定 */
  line-height: 1.8; /* main-text にも line-height を適用 */
  /* padding: 10px 0; // text-content の padding で調整 */
  /* min-height: 80px; // text-content の min-height で調整 */
}

.main-text :deep(ruby) {
  display: inline-block; /* displayをinline-blockに変更 */
  position: relative;
  margin-right: 0.1em;
  text-align: center; /* ベーステキストを中央揃えにする */
}

.main-text :deep(rt) {
  font-size: 0.6em; /* ルビのフォントサイズを小さくする */
  line-height: 1; /* ルビの行の高さを詰める */
  text-align: center; /*念のためrtにも設定*/
  position: absolute; /* 親要素(ruby)に対して絶対配置 */
  top: -0.8em; /* ルビを漢字の上に配置するための調整 */
  left: 50%;
  transform: translateX(-50%); /* 中央揃え */
  white-space: nowrap; /* ルビが改行されないようにする */
  width: max-content; /* rtの幅を内容に合わせる */
}

.no-text {
  color: #909399;
  font-style: italic;
  text-align: center; /* 中央揃え */
}
</style>