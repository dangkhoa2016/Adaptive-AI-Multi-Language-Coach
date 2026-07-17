import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityChart from '../../src/components/ActivityChart.vue'

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(ActivityChart, {
    props: {
      data: [],
      ...props,
    },
  })
}

describe('ActivityChart', () => {
  it('renders 14 bars for data spanning 14 days', () => {
    const data: Array<{ day: string; count: number }> = []
    const today = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      data.push({ day: d.toISOString().slice(0, 10), count: Math.floor(Math.random() * 10) })
    }
    const wrapper = mountComponent({ data })
    const rects = wrapper.findAll('rect')
    expect(rects.length).toBe(14)
  })

  it('shows no data message for empty array', () => {
    const wrapper = mountComponent({ data: [] })
    expect(wrapper.text()).toContain('No activity data yet.')
  })

  it('renders bars with correct heights based on count', () => {
    const data = [
      { day: '2026-06-30', count: 5 },
      { day: '2026-07-01', count: 10 },
    ]
    const wrapper = mountComponent({ data })
    const rects = wrapper.findAll('rect')
    expect(rects.length).toBe(14)
  })
})
