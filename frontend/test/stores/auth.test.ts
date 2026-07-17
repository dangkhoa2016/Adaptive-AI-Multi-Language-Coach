import { describe, expect, it, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../../src/stores/auth'
import {
  requestMagicLink,
  verifyMagicLink,
  fetchCurrentUser,
  logout,
  exportUserData,
} from '../../src/api/client'

vi.mock('../../src/api/client', () => ({
  requestMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  fetchCurrentUser: vi.fn(),
  logout: vi.fn(),
  exportUserData: vi.fn(),
}))

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  emailVerified: true,
  activatedDate: null,
  activationMethod: null,
  timezone: 'UTC',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.linkSent).toBe(false)
  })

  describe('requestLink', () => {
    it('sets linkSent on success', async () => {
      vi.mocked(requestMagicLink).mockResolvedValueOnce({ success: true })
      const store = useAuthStore()
      await store.requestLink('test@example.com')
      expect(requestMagicLink).toHaveBeenCalledWith('test@example.com')
      expect(store.linkSent).toBe(true)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets error on failure', async () => {
      vi.mocked(requestMagicLink).mockRejectedValueOnce(new Error('Invalid email'))
      const store = useAuthStore()
      await store.requestLink('bad')
      expect(store.linkSent).toBe(false)
      expect(store.error).toBe('Invalid email')
      expect(store.loading).toBe(false)
    })

    it('sets loading during request', async () => {
      let resolve!: (v: unknown) => void
      vi.mocked(requestMagicLink).mockReturnValueOnce(
        new Promise((r) => {
          resolve = r
        }),
      )
      const store = useAuthStore()
      const promise = store.requestLink('test@example.com')
      expect(store.loading).toBe(true)
      resolve({ success: true })
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('verify', () => {
    it('sets user on success', async () => {
      vi.mocked(verifyMagicLink).mockResolvedValueOnce({ success: true, user: mockUser })
      const store = useAuthStore()
      await store.verify('token-123')
      expect(verifyMagicLink).toHaveBeenCalledWith('token-123')
      expect(store.user).toEqual(mockUser)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets error on failure', async () => {
      vi.mocked(verifyMagicLink).mockRejectedValueOnce(new Error('Token expired'))
      const store = useAuthStore()
      await store.verify('bad-token')
      expect(store.user).toBeNull()
      expect(store.error).toBe('Token expired')
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchUser', () => {
    it('sets user when authenticated', async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValueOnce({ user: mockUser })
      const store = useAuthStore()
      await store.fetchUser()
      expect(store.user).toEqual(mockUser)
    })

    it('sets user to null when not authenticated', async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValueOnce(new Error('Unauthorized'))
      const store = useAuthStore()
      await store.fetchUser()
      expect(store.user).toBeNull()
    })
  })

  describe('signOut', () => {
    it('clears user and loading state', async () => {
      vi.mocked(logout).mockResolvedValueOnce({ success: true })
      const store = useAuthStore()
      store.user = mockUser
      await store.signOut()
      expect(logout).toHaveBeenCalled()
      expect(store.user).toBeNull()
      expect(store.loading).toBe(false)
    })

    it('clears user even when logout fails', async () => {
      vi.mocked(logout).mockRejectedValueOnce(new Error('Network error'))
      const store = useAuthStore()
      store.user = mockUser
      await store.signOut()
      expect(store.user).toBeNull()
      expect(store.loading).toBe(false)
    })
  })

  describe('exportData', () => {
    it('creates and triggers download', async () => {
      const mockData = { pairs: [] }
      vi.mocked(exportUserData).mockResolvedValueOnce(mockData)
      const createObjectURL = vi.fn().mockReturnValue('blob:url')
      const revokeObjectURL = vi.fn()
      const click = vi.fn()
      window.URL.createObjectURL = createObjectURL
      window.URL.revokeObjectURL = revokeObjectURL
      document.createElement = vi
        .fn()
        .mockReturnValue({ href: '', download: '', click } as unknown as HTMLAnchorElement)

      const store = useAuthStore()
      await store.exportData()

      expect(exportUserData).toHaveBeenCalled()
      expect(createObjectURL).toHaveBeenCalled()
      expect(click).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalled()
    })
  })
})
