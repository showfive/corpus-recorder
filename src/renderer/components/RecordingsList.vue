<template>
  <div class="recordings-list" v-if="recordings.length > 0">
    <div class="list-card">
      <div class="card-content">
        <div class="recordings-grid">
          <div 
            v-for="recording in recordings" 
            :key="recording.id" 
            class="recording-item"
          >
            <div class="recording-card">
              <div class="recording-info">
                <span class="file-name">{{ recording.fileName }}</span>
                <div class="recording-tags">
                  <el-tag size="small" class="duration-tag">
                    {{ formatDuration(recording.duration) }}
                  </el-tag>
                  <el-tag size="small" type="warning" class="take-tag">
                    Take {{ recording.takeNumber }}
                  </el-tag>
                </div>
              </div>
              
              <div class="recording-actions">
                <el-button 
                  size="small" 
                  type="danger" 
                  :icon="Delete"
                  @click="handleDeleteRecording(recording)"
                  class="delete-button"
                >
                  削除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 空の状態 -->
  <div v-else class="empty-recordings">
    <div class="empty-content">
      <div class="empty-icon">🎤</div>
      <h3 class="empty-title">録音がありません</h3>
      <p class="empty-message">「録音開始」ボタンを押して音声を録音してみましょう</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { Recording } from '../../common/types'

interface Props {
  recordings: Recording[]
}

interface Emits {
  (e: 'delete-recording', recording: Recording): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 録音削除（確認ダイアログ付き）
const handleDeleteRecording = async (recording: Recording) => {
  try {
    await ElMessageBox.confirm(
      'この録音を削除しますか？',
      '確認',
      {
        confirmButtonText: '削除',
        cancelButtonText: 'キャンセル',
        type: 'warning'
      }
    )
    
    emit('delete-recording', recording)
  } catch (error) {
    // キャンセルされた場合は何もしない
    if (error !== 'cancel') {
      console.error('Unexpected error in delete confirmation:', error)
    }
  }
}

// 時間フォーマット
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.recordings-list {
  width: 100%;
}

.list-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  transition: all 0.2s ease;
}

.list-card:hover {
  box-shadow: var(--shadow-lg);
}

.card-content {
  padding: var(--space-lg);
  max-height: 400px;
  overflow-y: auto;
}

.recordings-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.recording-item {
  width: 100%;
}

.recording-card {
  background: var(--bg-primary);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-lg);
  transition: all 0.2s ease;
}

.recording-card:hover {
  background: var(--gray-50);
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.recording-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.file-name {
  font-weight: 600;
  color: var(--gray-800);
  font-size: var(--font-size-base);
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.recording-tags {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.duration-tag {
  background-color: var(--success-color);
  color: white;
  border: none;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.take-tag {
  font-weight: 600;
}

.recording-actions {
  flex-shrink: 0;
}

.delete-button {
  /* Element Plusのデフォルトスタイルを使用 */
}

.delete-button:hover {
  /* Element Plusのデフォルトhoverスタイルを使用 */
}

/* 空の状態 */
.empty-recordings {
  background: var(--bg-primary);
  border: 2px dashed var(--gray-300);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.empty-icon {
  font-size: 4rem;
  opacity: 0.5;
}

.empty-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--gray-700);
  margin: 0;
}

.empty-message {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin: 0;
  max-width: 300px;
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .recording-card {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  
  .recording-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }
  
  .recording-tags {
    justify-content: flex-start;
  }
  
  .recording-actions {
    align-self: flex-end;
  }
  
  .card-content {
    padding: var(--space-md);
  }
}
</style>
