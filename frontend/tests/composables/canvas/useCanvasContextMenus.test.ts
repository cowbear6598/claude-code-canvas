import { describe, it, expect } from 'vitest'
import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'
import type { TriggerMode } from '@/types'

function createRepositoryStore(overrides: Partial<{
  typedNotes: Array<{ id: string; repositoryId: string; x: number; y: number }>
  typedAvailableItems: Array<{ id: string; name: string; parentRepoId?: string | null }>
}> = {}) {
  return {
    typedNotes: [],
    typedAvailableItems: [],
    ...overrides,
  }
}

function createConnectionStore(overrides: Partial<{
  connections: Array<{ id: string; triggerMode: TriggerMode }>
}> = {}) {
  return {
    connections: [],
    ...overrides,
  }
}

function createPodStore(overrides: Partial<{
  getPodById: (id: string) => { id: string } | undefined
}> = {}) {
  return {
    getPodById: (_id: string) => undefined as { id: string } | undefined,
    ...overrides,
  }
}

function createComposable(options?: {
  repositoryStore?: ReturnType<typeof createRepositoryStore>
  connectionStore?: ReturnType<typeof createConnectionStore>
  podStore?: ReturnType<typeof createPodStore>
}) {
  return useCanvasContextMenus({
    repositoryStore: options?.repositoryStore ?? createRepositoryStore(),
    connectionStore: options?.connectionStore ?? createConnectionStore(),
    podStore: options?.podStore ?? createPodStore(),
  })
}

function createMouseEvent(x = 100, y = 200): MouseEvent {
  return { clientX: x, clientY: y } as MouseEvent
}

describe('useCanvasContextMenus', () => {
  describe('handleRepositoryContextMenu', () => {
    it('正常查到 note 和 repository 時，應開啟右鍵選單', () => {
      const repositoryStore = createRepositoryStore({
        typedNotes: [{ id: 'note-1', repositoryId: 'repo-1', x: 10, y: 20 }],
        typedAvailableItems: [{ id: 'repo-1', name: 'my-repo', parentRepoId: null }],
      })

      const { repositoryContextMenu, handleRepositoryContextMenu } = createComposable({ repositoryStore })

      handleRepositoryContextMenu({ noteId: 'note-1', event: createMouseEvent(100, 200) })

      expect(repositoryContextMenu.value.visible).toBe(true)
      expect(repositoryContextMenu.value.data.repositoryId).toBe('repo-1')
      expect(repositoryContextMenu.value.data.repositoryName).toBe('my-repo')
      expect(repositoryContextMenu.value.data.notePosition).toEqual({ x: 10, y: 20 })
    })

    it('noteId 找不到時，不應開啟右鍵選單', () => {
      const repositoryStore = createRepositoryStore({
        typedNotes: [],
        typedAvailableItems: [{ id: 'repo-1', name: 'my-repo' }],
      })

      const { repositoryContextMenu, handleRepositoryContextMenu } = createComposable({ repositoryStore })

      handleRepositoryContextMenu({ noteId: 'not-exists', event: createMouseEvent() })

      expect(repositoryContextMenu.value.visible).toBe(false)
    })

    it('parentRepoId 存在時 isWorktree 應為 true', () => {
      const repositoryStore = createRepositoryStore({
        typedNotes: [{ id: 'note-1', repositoryId: 'repo-2', x: 0, y: 0 }],
        typedAvailableItems: [{ id: 'repo-2', name: 'worktree-repo', parentRepoId: 'parent-repo-1' }],
      })

      const { repositoryContextMenu, handleRepositoryContextMenu } = createComposable({ repositoryStore })

      handleRepositoryContextMenu({ noteId: 'note-1', event: createMouseEvent() })

      expect(repositoryContextMenu.value.data.isWorktree).toBe(true)
    })

    it('parentRepoId 為 null 時 isWorktree 應為 false', () => {
      const repositoryStore = createRepositoryStore({
        typedNotes: [{ id: 'note-1', repositoryId: 'repo-1', x: 0, y: 0 }],
        typedAvailableItems: [{ id: 'repo-1', name: 'main-repo', parentRepoId: null }],
      })

      const { repositoryContextMenu, handleRepositoryContextMenu } = createComposable({ repositoryStore })

      handleRepositoryContextMenu({ noteId: 'note-1', event: createMouseEvent() })

      expect(repositoryContextMenu.value.data.isWorktree).toBe(false)
    })
  })

  describe('handleConnectionContextMenu', () => {
    it('正常查到 connection 時，應開啟右鍵選單', () => {
      const connectionStore = createConnectionStore({
        connections: [{ id: 'conn-1', triggerMode: 'auto' as TriggerMode }],
      })

      const { connectionContextMenu, handleConnectionContextMenu } = createComposable({ connectionStore })

      handleConnectionContextMenu({ connectionId: 'conn-1', event: createMouseEvent(50, 60) })

      expect(connectionContextMenu.value.visible).toBe(true)
      expect(connectionContextMenu.value.data.connectionId).toBe('conn-1')
      expect(connectionContextMenu.value.data.triggerMode).toBe('auto')
    })

    it('connectionId 找不到時，不應開啟右鍵選單', () => {
      const connectionStore = createConnectionStore({ connections: [] })

      const { connectionContextMenu, handleConnectionContextMenu } = createComposable({ connectionStore })

      handleConnectionContextMenu({ connectionId: 'not-exists', event: createMouseEvent() })

      expect(connectionContextMenu.value.visible).toBe(false)
    })
  })

  describe('handlePodContextMenu', () => {
    it('正常查到 pod 時，應開啟右鍵選單', () => {
      const podStore = createPodStore({
        getPodById: (id: string) => (id === 'pod-1' ? { id: 'pod-1' } : undefined),
      })

      const { podContextMenu, handlePodContextMenu } = createComposable({ podStore })

      handlePodContextMenu({ podId: 'pod-1', event: createMouseEvent(30, 40) })

      expect(podContextMenu.value.visible).toBe(true)
      expect(podContextMenu.value.data.podId).toBe('pod-1')
    })

    it('podId 找不到時，不應開啟右鍵選單', () => {
      const podStore = createPodStore({ getPodById: () => undefined })

      const { podContextMenu, handlePodContextMenu } = createComposable({ podStore })

      handlePodContextMenu({ podId: 'not-exists', event: createMouseEvent() })

      expect(podContextMenu.value.visible).toBe(false)
    })
  })
})
