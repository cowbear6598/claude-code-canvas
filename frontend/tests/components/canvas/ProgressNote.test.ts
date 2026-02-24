import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressNote from '@/components/canvas/ProgressNote.vue'
import type { ProgressTask } from '@/components/canvas/ProgressNote.vue'

function createTask(overrides: Partial<ProgressTask> = {}): ProgressTask {
  return {
    requestId: 'req-1',
    title: 'feature-branch',
    progress: 50,
    message: '切換分支...',
    status: 'processing',
    ...overrides,
  }
}

function mountProgressNote(tasks: Map<string, ProgressTask>) {
  return mount(ProgressNote, {
    props: { tasks },
  })
}

describe('ProgressNote', () => {
  it('沒有任務時不應渲染任何內容', () => {
    const wrapper = mountProgressNote(new Map())

    expect(wrapper.find('.progress-note-panel').exists()).toBe(false)
  })

  it('有任務時應顯示分支名稱、進度條和步驟文字', () => {
    const task = createTask({
      title: 'feature-branch',
      progress: 60,
      message: '切換分支...',
      status: 'processing',
    })
    const tasks = new Map([['req-1', task]])
    const wrapper = mountProgressNote(tasks)

    expect(wrapper.find('.progress-note-panel').exists()).toBe(true)
    expect(wrapper.find('.progress-note-title').text()).toBe('feature-branch')
    expect(wrapper.find('.progress-note-message').text()).toBe('切換分支...')
    const bar = wrapper.find('.progress-note-bar')
    expect(bar.attributes('style')).toContain('width: 60%')
  })

  it('失敗任務的進度條應使用 bg-destructive 色', () => {
    const task = createTask({
      status: 'failed',
      message: '切換失敗',
    })
    const tasks = new Map([['req-1', task]])
    const wrapper = mountProgressNote(tasks)

    const bar = wrapper.find('.progress-note-bar')
    expect(bar.classes()).toContain('bg-destructive')
  })

  it('正常任務的進度條應使用 bg-doodle-orange 色', () => {
    const task = createTask({
      status: 'processing',
    })
    const tasks = new Map([['req-1', task]])
    const wrapper = mountProgressNote(tasks)

    const bar = wrapper.find('.progress-note-bar')
    expect(bar.classes()).toContain('bg-doodle-orange')
  })

  it('completed 任務的進度條應使用 bg-doodle-orange 色', () => {
    const task = createTask({
      status: 'completed',
      progress: 100,
    })
    const tasks = new Map([['req-1', task]])
    const wrapper = mountProgressNote(tasks)

    const bar = wrapper.find('.progress-note-bar')
    expect(bar.classes()).toContain('bg-doodle-orange')
  })

  it('多個任務時應同時顯示所有任務', () => {
    const task1 = createTask({ requestId: 'req-1', title: 'branch-1' })
    const task2 = createTask({ requestId: 'req-2', title: 'branch-2' })
    const tasks = new Map<string, ProgressTask>([
      ['req-1', task1],
      ['req-2', task2],
    ])
    const wrapper = mountProgressNote(tasks)

    const cards = wrapper.findAll('.progress-note-card')
    expect(cards).toHaveLength(2)
  })
})
