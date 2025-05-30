import { container } from './container'
import { RecordingService } from '../../renderer/services/recordingService'
import { AudioWorkerService } from '../../renderer/services/audioWorkerService'

/**
 * 全サービスをDIコンテナに登録
 * アプリケーション起動時に呼び出される
 */
export function registerServices(): void {
  // RecordingServiceの登録
  container.register('recordingService', {
    constructor: RecordingService,
    singleton: true
  })

  // AudioWorkerServiceの登録
  container.register('audioWorkerService', {
    constructor: AudioWorkerService,
    singleton: true
  })

  // 他のサービスも同様に登録
  // 将来的に追加予定:
  // - AudioAnalysisService
  // - FileHandlingService
  // - SettingsService
  // - TranscriptionService
}

/**
 * 開発/テスト用の代替サービス登録
 */
export function registerMockServices(): void {
  // テスト用のモックサービスを登録
  // 開発時やテスト時にのみ使用
}

/**
 * サービスの登録状況を確認
 */
export function validateServiceRegistration(): boolean {
  const requiredServices = [
    'recordingService',
    'audioWorkerService'
  ]

  return requiredServices.every(serviceName => 
    container.isRegistered(serviceName)
  )
} 