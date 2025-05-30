<template>
  <div class="debug-section">
    <div class="system-info">
      <el-descriptions title="ブラウザ情報" :column="1" border>
        <el-descriptions-item label="User Agent">{{ systemInfo.userAgent }}</el-descriptions-item>
        <el-descriptions-item label="プラットフォーム">{{ systemInfo.platform }}</el-descriptions-item>
        <el-descriptions-item label="言語">{{ systemInfo.language }}</el-descriptions-item>
        <el-descriptions-item label="オンライン状態">{{ systemInfo.onLine ? 'オンライン' : 'オフライン' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions v-if="systemInfo.memoryInfo" title="メモリ情報" :column="1" border style="margin-top: 20px;">
        <el-descriptions-item label="使用中JSヒープ">
          {{ formatBytes(systemInfo.memoryInfo.usedJSHeapSize) }}
        </el-descriptions-item>
        <el-descriptions-item label="総JSヒープ">
          {{ formatBytes(systemInfo.memoryInfo.totalJSHeapSize) }}
        </el-descriptions-item>
        <el-descriptions-item label="JSヒープ制限">
          {{ formatBytes(systemInfo.memoryInfo.jsHeapSizeLimit) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="画面情報" :column="1" border style="margin-top: 20px;">
        <el-descriptions-item label="解像度">{{ systemInfo.screen.width }} × {{ systemInfo.screen.height }}</el-descriptions-item>
        <el-descriptions-item label="色深度">{{ systemInfo.screen.colorDepth }} bit</el-descriptions-item>
        <el-descriptions-item label="デバイスピクセル比">{{ systemInfo.screen.devicePixelRatio }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="ネットワーク情報" :column="1" border style="margin-top: 20px;">
        <el-descriptions-item label="接続タイプ">{{ systemInfo.connection?.effectiveType || '不明' }}</el-descriptions-item>
        <el-descriptions-item label="ダウンリンク">{{ systemInfo.connection?.downlink || '不明' }} Mbps</el-descriptions-item>
        <el-descriptions-item label="RTT">{{ systemInfo.connection?.rtt || '不明' }} ms</el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="Web Worker対応" :column="1" border style="margin-top: 20px;">
        <el-descriptions-item label="Worker対応">{{ systemInfo.workerSupport ? '対応' : '非対応' }}</el-descriptions-item>
        <el-descriptions-item label="SharedArrayBuffer">{{ systemInfo.sharedArrayBufferSupport ? '対応' : '非対応' }}</el-descriptions-item>
        <el-descriptions-item label="WebAssembly">{{ systemInfo.wasmSupport ? '対応' : '非対応' }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { logger } from '../../../common/logger'

// リアクティブデータ
const systemInfo = ref<any>({})

// メソッド
const updateSystemInfo = () => {
  systemInfo.value = {
    ...logger.collectSystemInfo(),
    // 追加の情報を収集
    workerSupport: typeof Worker !== 'undefined',
    sharedArrayBufferSupport: typeof SharedArrayBuffer !== 'undefined',
    wasmSupport: typeof WebAssembly !== 'undefined',
    connection: (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      devicePixelRatio: window.devicePixelRatio
    }
  }
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ライフサイクル
onMounted(() => {
  updateSystemInfo()
  
  // 定期的にメモリ情報を更新
  const interval = setInterval(updateSystemInfo, 5000)
  
  // クリーンアップ
  return () => clearInterval(interval)
})
</script>

<style scoped>
.debug-section {
  padding: 16px;
}

.system-info {
  max-height: 500px;
  overflow-y: auto;
}

:deep(.el-descriptions__header) {
  margin-bottom: 16px;
}

:deep(.el-descriptions__title) {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

:deep(.el-descriptions__body) {
  background: #fff;
}

:deep(.el-descriptions-item__cell) {
  font-size: 14px;
}

:deep(.el-descriptions-item__label) {
  font-weight: 500;
  background: #fafafa;
}
</style> 