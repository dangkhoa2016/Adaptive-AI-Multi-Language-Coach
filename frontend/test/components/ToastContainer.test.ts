import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

function stubTeleport() {
  return { template: '<div><slot /></div>' }
}

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when no toasts', async () => {
    const ToastContainer = (await import('../../src/components/ToastContainer.vue')).default
    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: stubTeleport() } },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('renders toasts with correct message and type', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const ToastContainer = (await import('../../src/components/ToastContainer.vue')).default
    const { show } = useToast()
    show('Test message', 'success')
    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: stubTeleport() } },
    })
    expect(wrapper.text()).toContain('Test message')
    expect(wrapper.find('.bg-green-600').exists()).toBe(true)
  })

  it('renders different types with correct styling', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const ToastContainer = (await import('../../src/components/ToastContainer.vue')).default
    const { show } = useToast()
    show('Info', 'info')
    show('Warning', 'warning')
    show('Error', 'error')
    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: stubTeleport() } },
    })
    expect(wrapper.find('.bg-blue-600').exists()).toBe(true)
    expect(wrapper.find('.bg-amber-500').exists()).toBe(true)
    expect(wrapper.find('.bg-red-600').exists()).toBe(true)
  })

  it('dismisses toast on close button click', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const ToastContainer = (await import('../../src/components/ToastContainer.vue')).default
    const { toasts, show } = useToast()
    show('Dismiss me')
    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: stubTeleport() } },
    })
    const closeBtn = wrapper.find('button')
    closeBtn.trigger('click')
    expect(toasts.value).toHaveLength(0)
  })

  it('removes toast after auto-dismiss', async () => {
    const { useToast } = await import('../../src/composables/useToast')
    const ToastContainer = (await import('../../src/components/ToastContainer.vue')).default
    const { toasts, show } = useToast()
    show('Auto dismiss')
    mount(ToastContainer, {
      global: { stubs: { Teleport: stubTeleport() } },
    })
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(toasts.value).toHaveLength(0)
  })
})
