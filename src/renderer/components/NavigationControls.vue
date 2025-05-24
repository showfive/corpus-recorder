<template>
  <div class="navigation-controls">
    <el-card>
      <div class="controls-container">
        <el-button
          :disabled="currentIndex === 0"
          :icon="ArrowLeft"
          @click="navigatePrevious"
        >
          前の文
        </el-button>

        <el-input-number
          v-model="jumpToIndex"
          :min="1"
          :max="totalTexts || 1"
          :disabled="totalTexts === 0"
          @change="handleJump"
          style="width: 120px"
        />

        <el-button
          :disabled="currentIndex >= totalTexts - 1"
          :icon="ArrowRight"
          @click="navigateNext"
        >
          次の文
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

interface Props {
  currentIndex: number
  totalTexts: number
}

interface Emits {
  (e: 'navigate-to', index: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const jumpToIndex = ref(props.currentIndex + 1)

// 前の文へ
const navigatePrevious = () => {
  if (props.currentIndex > 0) {
    emit('navigate-to', props.currentIndex - 1)
  }
}

// 次の文へ
const navigateNext = () => {
  if (props.currentIndex < props.totalTexts - 1) {
    emit('navigate-to', props.currentIndex + 1)
  }
}

// 指定番号へジャンプ
const handleJump = (value: number | null) => {
  if (value && value >= 1 && value <= props.totalTexts) {
    emit('navigate-to', value - 1)
  }
}

// currentIndexの変更を監視してjumpToIndexを更新
watch(() => props.currentIndex, (newIndex) => {
  jumpToIndex.value = newIndex + 1
})
</script>

<style scoped>
.navigation-controls {
  width: 100%;
}

.controls-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 10px;
}
</style> 