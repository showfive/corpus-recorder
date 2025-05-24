<template>
  <el-config-provider :locale="ja">
    <RecordingView />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ElConfigProvider } from 'element-plus'
import ja from 'element-plus/es/locale/lang/ja'
import RecordingView from './views/RecordingView.vue'
</script>

<style scoped>
</style> 