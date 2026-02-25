import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { setupTestPinia } from '../../helpers/mockStoreFactory'
import { useCursorStore } from '@/stores/cursorStore'
import { useViewportStore } from '@/stores/pod/viewportStore'
import RemoteCursorLayer from '@/components/canvas/RemoteCursorLayer.vue'

function mountRemoteCursorLayer() {
  return mount(RemoteCursorLayer, {
    attachTo: document.body,
  })
}

describe('RemoteCursorLayer', () => {
  beforeEach(() => {
    const pinia = setupTestPinia()
    setActivePinia(pinia)
  })

  describe('渲染', () => {
    it('無游標時不渲染任何游標元素', () => {
      const wrapper = mountRemoteCursorLayer()

      const cursors = wrapper.findAll('.remote-cursor')
      expect(cursors).toHaveLength(0)
    })

    it('有游標時渲染對應數量的游標 SVG', () => {
      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 100, y: 200, color: '#ff0000' })
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-2', x: 300, y: 400, color: '#00ff00' })

      const wrapper = mountRemoteCursorLayer()

      const cursors = wrapper.findAll('.remote-cursor')
      expect(cursors).toHaveLength(2)
    })

    it('store 新增游標後畫面應即時更新（響應式）', async () => {
      const cursorStore = useCursorStore()
      const wrapper = mountRemoteCursorLayer()

      expect(wrapper.findAll('.remote-cursor')).toHaveLength(0)

      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 50, y: 50, color: '#ff0000' })
      await nextTick()

      expect(wrapper.findAll('.remote-cursor')).toHaveLength(1)
    })

    it('store 移除游標後 DOM 應減少（響應式）', async () => {
      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 50, y: 50, color: '#ff0000' })
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-2', x: 100, y: 100, color: '#00ff00' })

      const wrapper = mountRemoteCursorLayer()
      expect(wrapper.findAll('.remote-cursor')).toHaveLength(2)

      cursorStore.removeCursor('conn-1')
      await nextTick()

      expect(wrapper.findAll('.remote-cursor')).toHaveLength(1)
    })
  })

  describe('座標轉換', () => {
    it('游標位置應根據 viewportStore 的 zoom 和 offset 轉換為螢幕座標', () => {
      const cursorStore = useCursorStore()
      const viewportStore = useViewportStore()

      viewportStore.zoom = 2
      viewportStore.setOffset(100, 50)

      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 200, y: 150, color: '#ff0000' })

      const wrapper = mountRemoteCursorLayer()

      const cursor = wrapper.find('.remote-cursor')
      const style = cursor.attributes('style') ?? ''

      // screenX = 200 * 2 + 100 = 500
      // screenY = 150 * 2 + 50 = 350
      expect(style).toContain('left: 500px')
      expect(style).toContain('top: 350px')
    })

    it('viewport zoom 改變後游標螢幕座標應響應式更新', async () => {
      const cursorStore = useCursorStore()
      const viewportStore = useViewportStore()

      viewportStore.zoom = 1
      viewportStore.setOffset(0, 0)

      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 100, y: 200, color: '#ff0000' })

      const wrapper = mountRemoteCursorLayer()

      const cursorBefore = wrapper.find('.remote-cursor')
      const styleBefore = cursorBefore.attributes('style') ?? ''

      // zoom=1: screenX = 100*1+0 = 100, screenY = 200*1+0 = 200
      expect(styleBefore).toContain('left: 100px')
      expect(styleBefore).toContain('top: 200px')

      viewportStore.zoom = 2
      await nextTick()

      const cursorAfter = wrapper.find('.remote-cursor')
      const styleAfter = cursorAfter.attributes('style') ?? ''

      // zoom=2: screenX = 100*2+0 = 200, screenY = 200*2+0 = 400
      expect(styleAfter).toContain('left: 200px')
      expect(styleAfter).toContain('top: 400px')
    })

    it('zoom 為 1、offset 為 0 時螢幕座標應等於畫布座標', () => {
      const cursorStore = useCursorStore()
      const viewportStore = useViewportStore()

      viewportStore.zoom = 1
      viewportStore.setOffset(0, 0)

      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 50, y: 75, color: '#ff0000' })

      const wrapper = mountRemoteCursorLayer()

      const cursor = wrapper.find('.remote-cursor')
      const style = cursor.attributes('style') ?? ''

      expect(style).toContain('left: 50px')
      expect(style).toContain('top: 75px')
    })
  })

  describe('樣式', () => {
    it('游標容器應設定 pointer-events: none', () => {
      const wrapper = mountRemoteCursorLayer()

      const layer = wrapper.find('.remote-cursor-layer')
      expect(layer.exists()).toBe(true)
      expect(layer.attributes('style')).toContain('pointer-events: none')
    })

    it('游標顏色應使用傳入的 color 屬性', () => {
      const cursorStore = useCursorStore()
      cursorStore.addOrUpdateCursor({ connectionId: 'conn-1', x: 0, y: 0, color: '#abcdef' })

      const wrapper = mountRemoteCursorLayer()

      const svgPath = wrapper.find('path')
      expect(svgPath.attributes('fill')).toBe('#abcdef')
    })
  })
})
