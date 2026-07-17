<script setup lang="ts">
import { useConfirm } from '../composables/useConfirm'

const { state, resolveConfirm } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="state"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="resolveConfirm(false)"
      >
        <div class="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ state.options.title }}
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ state.options.message }}
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              @click="resolveConfirm(false)"
            >
              {{ state.options.cancelText || 'Cancel' }}
            </button>
            <button
              class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
              :class="
                state.options.variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              "
              @click="resolveConfirm(true)"
            >
              {{ state.options.confirmText || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
</style>
