<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()

onMounted(() => {
  auth.fetchUser()
})
</script>

<template>
  <main class="min-h-screen">
    <nav class="flex items-center justify-between border-b px-6 py-3">
      <RouterLink :to="{ name: 'home' }" class="text-lg font-bold">AI Vocab Coach</RouterLink>
      <div class="space-x-4 text-sm">
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'profile' }"
          class="text-blue-600 hover:underline"
        >
          {{ auth.user.email }}
        </RouterLink>
        <RouterLink v-else :to="{ name: 'login' }" class="text-blue-600 hover:underline">
          Sign in
        </RouterLink>
      </div>
    </nav>
    <RouterView />
  </main>
</template>
