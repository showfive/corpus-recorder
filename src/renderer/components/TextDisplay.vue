<template>
  <div class="text-display">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>読み上げテキスト</span>
          <el-tag type="info">{{ textIndex + 1 }} / {{ totalTexts }}</el-tag>
        </div>
      </template>
      <div class="text-content">
        <p v-if="text">{{ text }}</p>
        <p v-else class="no-text">テキストファイルを読み込んでください</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text: string
  textIndex: number
  totalTexts: number
}

defineProps<Props>()
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
  font-size: 18px;
  line-height: 1.8;
  padding: 20px 0;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-text {
  color: #909399;
  font-style: italic;
}
</style> 