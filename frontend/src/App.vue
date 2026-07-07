<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useI18n } from 'vue-i18n'

const auth = useAuthStore()
const { t } = useI18n()

onMounted(() => {
  auth.fetchUser()
})
</script>

<template>
  <main class="min-h-screen">
    <nav class="flex items-center justify-between border-b px-6 py-3">
      <div class="flex items-center gap-6">
        <RouterLink :to="{ name: 'home' }" class="text-lg font-bold">AI Vocab Coach</RouterLink>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'review' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.review') }}
        </RouterLink>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'reviews' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.reviewHistory') }}
        </RouterLink>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'vocabulary' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.vocabulary') }}
        </RouterLink>
      </div>
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
