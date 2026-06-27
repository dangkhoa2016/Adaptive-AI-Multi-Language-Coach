<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) {
    auth.error = t('auth.verify_error')
    return
  }
  await auth.verify(token)
  if (!auth.error) {
    router.push({ name: 'home' })
  }
})
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16 text-center">
    <div v-if="auth.loading">
      <p class="text-lg">{{ t('auth.verify_title') }}</p>
    </div>
    <div v-else-if="auth.error" role="alert" class="rounded bg-red-50 p-4 text-red-700">
      <p class="mb-4">{{ auth.error }}</p>
      <router-link :to="{ name: 'login' }" class="text-blue-600 hover:underline">
        {{ t('common.back') }}
      </router-link>
    </div>
  </section>
</template>
