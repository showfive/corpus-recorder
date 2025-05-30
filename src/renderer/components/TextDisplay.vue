<template>
  <div class="text-display">
    <div class="text-card" v-if="props.currentText">
      <div class="card-header">
        <div class="header-left">
          <div class="header-tags">
            <el-tag v-if="props.fileFormat" type="info" size="small" class="format-tag">
              {{ props.fileFormat }}
            </el-tag>
            <el-tag v-if="props.totalTexts > 0" class="progress-tag">
              {{ props.textIndex + 1 }} / {{ props.totalTexts }}
            </el-tag>
          </div>
        </div>
        <div class="header-right">
          <el-button 
            type="text" 
            size="small"
            @click="$emit('load-text-file')"
            class="compact-load-button"
          >
            コーパスを開く
          </el-button>
          <div class="progress-indicator" v-if="props.totalTexts > 0">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${((props.textIndex + 1) / props.totalTexts) * 100}%` }"
              ></div>
            </div>
            <span class="progress-percentage">
              {{ Math.round(((props.textIndex + 1) / props.totalTexts) * 100) }}%
            </span>
          </div>
        </div>
      </div>
      
      <div class="card-content">
        <div v-if="props.currentText.label" class="text-label">
          <span class="label-icon">🏷️</span>
          <span class="label-text">{{ props.currentText.label }}</span>
        </div>
        
        <div class="main-text-container">
          <div
            class="main-text"
            v-if="props.fileFormat === 'rohan-format' && props.currentText.rubyText"
            v-html="generateRubyHtml(props.currentText.rubyText)"
          ></div>
          <div class="main-text" v-else>
            {{ props.currentText.text }}
          </div>
        </div>
        
        <div v-if="props.currentText.reading" class="text-reading">
          <span class="reading-icon">🗣️</span>
          <span class="reading-text">{{ props.currentText.reading }}</span>
        </div>
      </div>

      <!-- ナビゲーションコントロール -->
      <div class="navigation-controls" v-if="props.totalTexts > 0">
        <div class="nav-controls">
          <el-button
            :disabled="props.textIndex === 0"
            :icon="ArrowLeft"
            @click="$emit('navigate-to', props.textIndex - 1)"
            class="nav-button"
            size="small"
          >
            前の文
          </el-button>

          <el-input-number
            :model-value="props.textIndex + 1"
            :min="1"
            :max="props.totalTexts || 1"
            :disabled="props.totalTexts === 0"
            @change="handleJump"
            size="small"
            class="jump-input"
            :controls="false"
          />

          <el-button
            :disabled="props.textIndex >= props.totalTexts - 1"
            :icon="ArrowRight"
            @click="$emit('navigate-to', props.textIndex + 1)"
            class="nav-button"
            size="small"
          >
            次の文
          </el-button>
        </div>
      </div>
    </div>

    <div class="text-card empty-state" v-else>
      <div class="card-header">
        <div class="header-left">
          <!-- 空の状態ではヘッダーにボタンを表示しない -->
        </div>
      </div>
      <div class="card-content">
        <div class="empty-content">
          <el-button 
            type="primary" 
            size="large"
            @click="$emit('load-text-file')"
            class="large-load-button"
          >
            📄 コーパスを開く
          </el-button>
          <p class="empty-message">テキストファイルを開いて録音を開始してください</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CorpusText, RubySegment, TextFileFormat } from '../../common/types'; // RubySegment と TextFileFormat をインポート
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

interface Props {
  currentText: CorpusText | null; // string から CorpusText | null に変更
  textIndex: number;
  totalTexts: number;
  fileFormat: TextFileFormat | null; // 新規：ファイルフォーマットを受け取る
}

interface Emits {
  (e: 'load-text-file'): void
  (e: 'navigate-to', index: number): void
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 指定番号へジャンプ
const handleJump = (value: number | null) => {
  if (value && value >= 1 && value <= props.totalTexts) {
    emit('navigate-to', value - 1)
  }
}

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
  height: 100%;
  display: flex;
  flex-direction: column;
}

.text-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.text-card:hover {
  box-shadow: var(--shadow-lg);
}

.card-header {
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  padding: var(--space-lg);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-lg);
}

.header-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-md);
}

.header-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
}

.compact-load-button {
  color: var(--primary-color);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-md);
  background-color: transparent;
  transition: all 0.2s ease;
}

.compact-load-button:hover {
  background-color: var(--primary-color);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.header-tags {
  display: flex;
  gap: var(--space-sm);
}

.format-tag {
  font-weight: 500;
}

.progress-tag {
  background-color: var(--primary-color);
  color: white;
  border: none;
  font-weight: 600;
}

.progress-indicator {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
  min-width: auto;
}

.progress-bar {
  width: 80px;
  height: 6px;
  background-color: var(--gray-200);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-light));
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.progress-percentage {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--gray-600);
}

.card-content {
  padding: var(--space-md);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  overflow-y: auto;
}

.text-label,
.text-reading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--gray-50);
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
}

.label-icon,
.reading-icon {
  font-size: var(--font-size-base);
}

.label-text,
.reading-text {
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  font-weight: 500;
}

.main-text-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: var(--space-md);
  background: linear-gradient(135deg, var(--gray-50), var(--bg-primary));
  border-radius: var(--radius-lg);
  border: 2px dashed var(--gray-300);
}

.main-text {
  font-size: var(--font-size-2xl);
  line-height: var(--leading-relaxed);
  text-align: center;
  color: var(--gray-800);
  font-weight: 500;
  letter-spacing: 0.025em;
  max-width: 100%;
  word-wrap: break-word;
}

.main-text :deep(ruby) {
  display: inline-block;
  position: relative;
  margin: 0 0.1em;
  text-align: center;
}

.main-text :deep(rt) {
  font-size: 0.6em;
  line-height: 1;
  text-align: center;
  position: absolute;
  top: -0.8em;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  width: max-content;
  color: var(--primary-color);
  font-weight: 600;
}

/* ナビゲーションコントロール */
.navigation-controls {
  border-top: 1px solid var(--gray-200);
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  padding: var(--space-md);
}

.nav-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
}

.nav-button {
  font-weight: 500;
  transition: all 0.2s ease;
}

.jump-input {
  width: 80px;
}

/* 空の状態 */
.empty-state {
  border: 2px dashed var(--gray-300);
  background: var(--gray-50);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--space-md);
  min-height: 200px;
}

.empty-message {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--gray-700);
}

.large-load-button {
  padding: var(--space-lg) var(--space-2xl);
  font-size: var(--font-size-lg);
  font-weight: 600;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  transition: all 0.3s ease;
  min-width: 200px;
}

.large-load-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .text-display {
    max-width: 100%;
  }
  
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  
  .progress-indicator {
    align-items: stretch;
  }
  
  .main-text {
    font-size: var(--font-size-xl);
  }
  
  .card-content {
    padding: var(--space-lg);
  }
  
  .nav-controls {
    gap: var(--space-sm);
  }
  
  .nav-button {
    font-size: var(--font-size-sm);
    padding: var(--space-xs) var(--space-sm);
  }
  
  .jump-input {
    width: 70px;
  }
}
</style>