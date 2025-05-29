<template>
  <div class="recordings-list" v-if="recordings.length > 0">
    <div class="list-card">
      <div class="card-header">
        <h3 class="card-title">🎵 録音済み音声</h3>
        <el-tag type="info" class="count-tag">{{ recordings.length }}件</el-tag>
      </div>
      
      <div class="card-content">
        <div class="recordings-grid">
          <div 
            v-for="recording in recordings" 
            :key="recording.id" 
            class="recording-item"
          >
            <div class="recording-card">
              <div class="recording-info">
                <div class="recording-header">
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
                  <div class="recording-meta">
                  <span class="meta-item">
                    <span class="meta-icon">🕒</span>
                    <span class="meta-text">{{ formatDate(recording.createdAt) }}</span>
                  </span>
                </div>
              </div>
              
              <div class="recording-actions">
                <el-button-group class="action-group">
                  <el-button 
                    size="small" 
                    :icon="VideoPlay"
                    @click="playRecording(recording)"
                    class="play-button"
                  >
                    再生
                  </el-button>
                  <el-button 
                    size="small" 
                    type="danger" 
                    :icon="Delete"
                    @click="handleDeleteRecording(recording)"
                    class="delete-button"
                  >
                    削除
                  </el-button>
                </el-button-group>
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
import { VideoPlay, Delete } from '@element-plus/icons-vue'
import { Recording } from '../../common/types'

interface Props {
  recordings: Recording[]
}

interface Emits {
  (e: 'play-recording', recording: Recording): void
  (e: 'delete-recording', recording: Recording): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 録音再生
const playRecording = (recording: Recording) => {
  emit('play-recording', recording)
}

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

// 日付フォーマット
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
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

.card-header {
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  padding: var(--space-lg);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--gray-800);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.count-tag {
  background-color: var(--primary-color);
  color: white;
  border: none;
  font-weight: 600;
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
  flex-direction: column;
  gap: var(--space-sm);
}

.recording-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
}

.file-name {
  font-weight: 600;
  color: var(--gray-800);
  font-size: var(--font-size-base);
  word-break: break-all;
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

.recording-meta {
  display: flex;
  gap: var(--space-lg);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.meta-icon {
  font-size: var(--font-size-sm);
}

.meta-text {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  font-weight: 500;
}

.recording-actions {
  flex-shrink: 0;
}

.action-group {
  display: flex;
  gap: var(--space-xs);
}

.play-button {
  background: linear-gradient(135deg, var(--success-color), #059669);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.2s ease;
}

.play-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.delete-button {
  background: linear-gradient(135deg, var(--error-color), #dc2626);
  border: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.delete-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
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
  
  .recording-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }
  
  .recording-tags {
    justify-content: flex-start;
  }
  
  .recording-meta {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .action-group {
    width: 100%;
  }
  
  .play-button,
  .delete-button {
    flex: 1;
  }
  
  .card-content {
    padding: var(--space-md);
  }
}
</style>
