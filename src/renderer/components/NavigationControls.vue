<template>
  <div class="navigation-controls">
    <div class="nav-controls">
      <el-button
        :disabled="currentIndex === 0"
        :icon="ArrowLeft"
        @click="navigatePrevious"
        class="nav-button"
        size="small"
      >
        前の文
      </el-button>

      <el-input-number
        v-model="jumpToIndex"
        :min="1"
        :max="totalTexts || 1"
        :disabled="totalTexts === 0"
        @change="handleJump"
        size="small"
        class="jump-input"
        :controls="false"
      />

      <el-button
        :disabled="currentIndex >= totalTexts - 1"
        :icon="ArrowRight"
        @click="navigateNext"
        class="nav-button"
        size="small"
      >
        次の文
      </el-button>
    </div>
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

.nav-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
}

.nav-button {
  font-weight: 500;
  transition: all 0.2s ease;
}

.jump-input {
  width: 80px;
}

/* レスポンシブデザイン */
@media (max-width: 768px) {
  .nav-controls {
    gap: var(--space-sm);
    padding: var(--space-sm);
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