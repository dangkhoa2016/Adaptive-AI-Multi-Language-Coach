import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewStatsCard from '../../src/components/ReviewStatsCard.vue'

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(ReviewStatsCard, {
    props: { label: 'Due', count: 12, color: 'amber', icon: '⏰', ...props },
  })
}

describe('ReviewStatsCard', () => {
  it('renders label and count', () => {
    const wrapper = mountComponent({ label: 'Mastered', count: 42 })
    expect(wrapper.text()).toContain('Mastered')
    expect(wrapper.text()).toContain('42')
  })

  it('renders icon', () => {
    const wrapper = mountComponent({ icon: '✅' })
    expect(wrapper.text()).toContain('✅')
  })

  it('applies color class based on color prop', () => {
    const wrapper = mountComponent({ color: 'emerald' })
    expect(wrapper.find('.border-emerald-200').exists()).toBe(true)
  })

  it('renders count as a large number', () => {
    const wrapper = mountComponent({ count: 999 })
    expect(wrapper.find('p').text()).toBe('999')
  })

  it('does not render loading skeleton by default', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.animate-pulse').exists()).toBe(false)
  })
})
