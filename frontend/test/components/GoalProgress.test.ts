import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GoalProgress from '../../src/components/GoalProgress.vue'

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(GoalProgress, {
    props: {
      current: 0,
      target: 10,
      label: 'Goal',
      ...props,
    },
  })
}

describe('GoalProgress', () => {
  it('renders current / target text', () => {
    const wrapper = mountComponent({ current: 3, target: 10 })
    expect(wrapper.text()).toContain('3 / 10')
  })

  it('bar width proportional to progress', () => {
    const wrapper = mountComponent({ current: 5, target: 10 })
    const bar = wrapper.find('.bg-indigo-500')
    expect(bar.attributes('style')).toContain('width: 50%')
  })

  it('caps at 100% when current exceeds target', () => {
    const wrapper = mountComponent({ current: 15, target: 10 })
    const bar = wrapper.find('.bg-indigo-500')
    expect(bar.attributes('style')).toContain('width: 100%')
  })

  it('handles zero target without division by zero', () => {
    const wrapper = mountComponent({ current: 0, target: 0 })
    expect(wrapper.text()).toContain('0 / 0')
    const bar = wrapper.find('.bg-indigo-500')
    expect(bar.attributes('style')).toContain('width: 0%')
  })
})
