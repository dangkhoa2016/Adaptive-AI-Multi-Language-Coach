import { ref } from 'vue'
import type { ConfirmOptions } from '../types/confirm'

const state = ref<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = { options, resolve }
    })
  }
  function resolveConfirm(value: boolean) {
    state.value?.resolve(value)
    state.value = null
  }
  return { state, confirm, resolveConfirm }
}
