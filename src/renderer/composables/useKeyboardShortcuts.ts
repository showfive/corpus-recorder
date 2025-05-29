import { onMounted, onUnmounted, ref } from 'vue'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts() {
  const shortcuts = ref<KeyboardShortcut[]>([])

  const addShortcut = (shortcut: KeyboardShortcut) => {
    shortcuts.value.push(shortcut)
  }

  const removeShortcut = (key: string) => {
    shortcuts.value = shortcuts.value.filter((s: KeyboardShortcut) => s.key !== key)
  }

  const handleKeydown = (event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.value.find((shortcut: KeyboardShortcut) => {
      return shortcut.key.toLowerCase() === event.key.toLowerCase() &&
             !!shortcut.ctrl === event.ctrlKey &&
             !!shortcut.alt === event.altKey &&
             !!shortcut.shift === event.shiftKey
    })

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      matchingShortcut.action()
    }
  }

  // デフォルトショートカットの設定
  const setupDefaultShortcuts = (actions: {
    startRecording?: () => void
    stopRecording?: () => void
    toggleRecording?: () => void
    reset?: () => void
  }) => {
    if (actions.startRecording) {
      addShortcut({
        key: 'r',
        ctrl: true,
        action: actions.startRecording,
        description: 'Start recording (Ctrl+R)'
      })
    }

    if (actions.stopRecording) {
      addShortcut({
        key: 's',
        ctrl: true,
        action: actions.stopRecording,
        description: 'Stop recording (Ctrl+S)'
      })
    }

    if (actions.toggleRecording) {
      addShortcut({
        key: ' ',
        action: actions.toggleRecording,
        description: 'Toggle recording (Space)'
      })
    }

    if (actions.reset) {
      addShortcut({
        key: 'Escape',
        action: actions.reset,
        description: 'Reset recording state (Escape)'
      })
    }
  }

  const getShortcutsList = () => {
    return shortcuts.value.map((s: KeyboardShortcut) => ({
      keys: [
        s.ctrl && 'Ctrl',
        s.alt && 'Alt', 
        s.shift && 'Shift',
        s.key
      ].filter(Boolean).join('+'),
      description: s.description
    }))
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    addShortcut,
    removeShortcut,
    setupDefaultShortcuts,
    getShortcutsList
  }
} 