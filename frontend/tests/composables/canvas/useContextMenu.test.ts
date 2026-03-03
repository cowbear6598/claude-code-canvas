import { describe, it, expect } from 'vitest'
import { useContextMenu } from '@/composables/canvas/useContextMenu'

describe('useContextMenu', () => {
  describe('初始狀態', () => {
    it('visible 預設為 false', () => {
      const { state } = useContextMenu({ id: '' })
      expect(state.value.visible).toBe(false)
    })

    it('position 預設為 { x: 0, y: 0 }', () => {
      const { state } = useContextMenu({ id: '' })
      expect(state.value.position).toEqual({ x: 0, y: 0 })
    })

    it('data 預設為傳入的 defaultData', () => {
      const defaultData = { id: 'default', name: 'test' }
      const { state } = useContextMenu(defaultData)
      expect(state.value.data).toEqual(defaultData)
    })
  })

  describe('open - 開啟選單', () => {
    it('open 後 visible 應為 true', () => {
      const { state, open } = useContextMenu({ id: '' })
      const event = { clientX: 100, clientY: 200 } as MouseEvent

      open(event, { id: 'item-1' })

      expect(state.value.visible).toBe(true)
    })

    it('open 後 position 應等於 event 座標', () => {
      const { state, open } = useContextMenu({ id: '' })
      const event = { clientX: 150, clientY: 300 } as MouseEvent

      open(event, { id: 'item-1' })

      expect(state.value.position).toEqual({ x: 150, y: 300 })
    })

    it('open 後 data 應更新為傳入的資料', () => {
      const { state, open } = useContextMenu({ id: '' })
      const event = { clientX: 0, clientY: 0 } as MouseEvent
      const newData = { id: 'item-99', name: 'updated' }

      open(event, newData)

      expect(state.value.data).toEqual(newData)
    })

    it('多次 open 後應以最後一次為準', () => {
      const { state, open } = useContextMenu({ id: '' })
      const event1 = { clientX: 10, clientY: 20 } as MouseEvent
      const event2 = { clientX: 50, clientY: 60 } as MouseEvent

      open(event1, { id: 'first' })
      open(event2, { id: 'second' })

      expect(state.value.position).toEqual({ x: 50, y: 60 })
      expect(state.value.data).toEqual({ id: 'second' })
    })
  })

  describe('close - 關閉選單', () => {
    it('close 後 visible 應為 false', () => {
      const { state, open, close } = useContextMenu({ id: '' })
      const event = { clientX: 100, clientY: 200 } as MouseEvent

      open(event, { id: 'item-1' })
      expect(state.value.visible).toBe(true)

      close()
      expect(state.value.visible).toBe(false)
    })

    it('close 後 position 和 data 應保持不變', () => {
      const { state, open, close } = useContextMenu({ id: '' })
      const event = { clientX: 100, clientY: 200 } as MouseEvent
      const data = { id: 'item-1' }

      open(event, data)
      close()

      expect(state.value.position).toEqual({ x: 100, y: 200 })
      expect(state.value.data).toEqual(data)
    })

    it('在未開啟的狀態下 close 應不影響 position 與 data', () => {
      const defaultData = { id: 'default' }
      const { state, close } = useContextMenu(defaultData)

      close()

      expect(state.value.visible).toBe(false)
      expect(state.value.position).toEqual({ x: 0, y: 0 })
      expect(state.value.data).toEqual(defaultData)
    })
  })

  describe('泛型支援', () => {
    it('應支援複雜資料型別', () => {
      interface RepositoryData {
        repositoryId: string
        repositoryName: string
        notePosition: { x: number; y: number }
        isWorktree: boolean
      }

      const defaultData: RepositoryData = {
        repositoryId: '',
        repositoryName: '',
        notePosition: { x: 0, y: 0 },
        isWorktree: false,
      }

      const { state, open } = useContextMenu(defaultData)
      const event = { clientX: 200, clientY: 400 } as MouseEvent
      const newData: RepositoryData = {
        repositoryId: 'repo-1',
        repositoryName: 'my-repo',
        notePosition: { x: 50, y: 60 },
        isWorktree: true,
      }

      open(event, newData)

      expect(state.value.data.repositoryId).toBe('repo-1')
      expect(state.value.data.isWorktree).toBe(true)
    })
  })
})
