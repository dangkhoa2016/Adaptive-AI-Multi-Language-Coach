import { ref } from 'vue'
import type { Toast } from '../types/toast'

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  function show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      const idx = toasts.value.findIndex((t) => t.id === id)
      if (idx !== -1) toasts.value.splice(idx, 1)
    }, 3000)
  }

  function dismiss(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, show, dismiss }
}
