<template>
  <el-header class="settings-header">
    <div class="settings-area">
      <el-space>
        <span>保存先:</span>
        <el-input 
          :model-value="recordingDirectory" 
          readonly 
          style="width: 400px"
          placeholder="保存ディレクトリを選択してください"
        />
        <el-button @click="$emit('select-directory')" type="primary">
          フォルダを選択
        </el-button>
        <el-button @click="$emit('load-text-file')" type="info">
          テキストファイルを開く
        </el-button>
      </el-space>
    </div>
  </el-header>
</template>

<script setup lang="ts">
interface Props {
  recordingDirectory: string
}

interface Emits {
  (e: 'select-directory'): void
  (e: 'load-text-file'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped>
.settings-header {
  background-color: #f5f7fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e4e7ed;
  height: auto;
}

.settings-area {
  -webkit-app-region: no-drag;
}
</style>
