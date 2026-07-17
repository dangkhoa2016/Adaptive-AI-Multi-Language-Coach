<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          role="alert"
          class="flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all"
          :class="{
            'bg-green-600 text-white': t.type === 'success',
            'bg-red-600 text-white': t.type === 'error',
            'bg-blue-600 text-white': t.type === 'info',
            'bg-amber-500 text-white': t.type === 'warning',
          }"
        >
          <span class="flex-1">{{ t.message }}</span>
          <button
            class="ml-2 text-white/80 hover:text-white"
            aria-label="Close"
            @click="dismiss(t.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(2rem);
}
</style>
