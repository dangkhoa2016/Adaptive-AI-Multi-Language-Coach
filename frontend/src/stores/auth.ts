import { defineStore } from 'pinia'
import type { User } from '../api/client'
import {
  requestMagicLink,
  verifyMagicLink,
  fetchCurrentUser,
  logout,
  exportUserData,
} from '../api/client'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  linkSent: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loading: false,
    error: null,
    linkSent: false,
  }),
  actions: {
    async requestLink(email: string) {
      this.loading = true
      this.error = null
      this.linkSent = false
      try {
        await requestMagicLink(email)
        this.linkSent = true
      } catch (e) {
        this.error = (e as Error).message
      } finally {
        this.loading = false
      }
    },

    async verify(token: string) {
      this.loading = true
      this.error = null
      try {
        const res = await verifyMagicLink(token)
        this.user = res.user
      } catch (e) {
        this.error = (e as Error).message
      } finally {
        this.loading = false
      }
    },

    async fetchUser() {
      try {
        const res = await fetchCurrentUser()
        this.user = res.user
      } catch {
        this.user = null
      }
    },

    async signOut() {
      this.loading = true
      try {
        await logout()
      } catch {
        // still clear local state
      } finally {
        this.user = null
        this.loading = false
      }
    },

    async exportData() {
      const data = await exportUserData()
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = 'user-data.json'
      a.click()
      URL.revokeObjectURL(url)
    },
  },
})
