<template>
  <div class="recordings-list" v-if="recordings.length > 0">
    <el-divider>録音済み音声</el-divider>
    <el-space direction="vertical" :size="10" style="width: 100%">
      <div v-for="recording in recordings" :key="recording.id" class="recording-item">
        <el-card shadow="hover">
          <el-row align="middle">
            <el-col :span="16">
              <span>{{ recording.fileName }}</span>
              <el-tag size="small" style="margin-left: 10px">
                {{ formatDuration(recording.duration) }}
              </el-tag>
              <el-tag size="small" type="info" style="margin-left: 5px">
                Take {{ recording.takeNumber }}
              </el-tag>
            </el-col>
            <el-col :span="8" style="text-align: right">
              <el-button-group>
                <el-button size="small" @click="playRecording(recording)">
                  再生
                </el-button>
                <el-button size="small" type="danger" @click="handleDeleteRecording(recording)">
                  削除
                </el-button>
              </el-button-group>
            </el-col>
          </el-row>
        </el-card>
      </div>
    </el-space>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
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
</script>

<style scoped>
.recordings-list {
  margin-top: 20px;
}

.recording-item {
  width: 100%;
}
</style>
