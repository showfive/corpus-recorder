import { describe, it, expect } from 'vitest'

// 簡単なユーティリティ関数のテスト
describe('Audio Utils', () => {
  it('should format time correctly', () => {
    const formatTime = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(30)).toBe('00:30')
    expect(formatTime(60)).toBe('01:00')
    expect(formatTime(125)).toBe('02:05')
  })

  it('should validate audio file extensions', () => {
    const isValidAudioFile = (filename: string): boolean => {
      const validExtensions = ['.wav', '.mp3', '.m4a', '.ogg']
      return validExtensions.some(ext => filename.toLowerCase().endsWith(ext))
    }

    expect(isValidAudioFile('test.wav')).toBe(true)
    expect(isValidAudioFile('test.mp3')).toBe(true)
    expect(isValidAudioFile('test.txt')).toBe(false)
    expect(isValidAudioFile('test')).toBe(false)
  })

  it('should calculate audio duration from buffer size', () => {
    const calculateDuration = (bufferSize: number, sampleRate: number): number => {
      return bufferSize / sampleRate
    }

    expect(calculateDuration(44100, 44100)).toBe(1) // 1秒
    expect(calculateDuration(88200, 44100)).toBe(2) // 2秒
    expect(calculateDuration(22050, 44100)).toBe(0.5) // 0.5秒
  })
}) 