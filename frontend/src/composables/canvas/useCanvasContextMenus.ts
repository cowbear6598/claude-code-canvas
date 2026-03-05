import { useContextMenu } from '@/composables/canvas/useContextMenu'
import type { TriggerMode } from '@/types'

interface RepositoryContextMenuData {
  repositoryId: string
  repositoryName: string
  notePosition: { x: number; y: number }
  isWorktree: boolean
}

interface ConnectionContextMenuData {
  connectionId: string
  triggerMode: TriggerMode
}

interface PodContextMenuData {
  podId: string
}

interface RepositoryStore {
  typedNotes: Array<{ id: string; repositoryId: string; x: number; y: number }>
  typedAvailableItems: Array<{ id: string; name: string; parentRepoId?: string | null }>
}

interface ConnectionStore {
  connections: Array<{ id: string; triggerMode: TriggerMode }>
}

interface PodStore {
  getPodById: (id: string) => { id: string } | undefined
}

interface UseCanvasContextMenusOptions {
  repositoryStore: RepositoryStore
  connectionStore: ConnectionStore
  podStore: PodStore
}

export function useCanvasContextMenus(options: UseCanvasContextMenusOptions): {
  repositoryContextMenu: ReturnType<typeof useContextMenu<RepositoryContextMenuData>>['state']
  connectionContextMenu: ReturnType<typeof useContextMenu<ConnectionContextMenuData>>['state']
  podContextMenu: ReturnType<typeof useContextMenu<PodContextMenuData>>['state']
  closeRepositoryContextMenu: () => void
  closeConnectionContextMenu: () => void
  closePodContextMenu: () => void
  handleRepositoryContextMenu: (data: { noteId: string; event: MouseEvent }) => void
  handleConnectionContextMenu: (data: { connectionId: string; event: MouseEvent }) => void
  handlePodContextMenu: (data: { podId: string; event: MouseEvent }) => void
} {
  const { repositoryStore, connectionStore, podStore } = options

  const {
    state: repositoryContextMenu,
    open: openRepositoryContextMenu,
    close: closeRepositoryContextMenu,
  } = useContextMenu<RepositoryContextMenuData>({
    repositoryId: '',
    repositoryName: '',
    notePosition: { x: 0, y: 0 },
    isWorktree: false,
  })

  const {
    state: connectionContextMenu,
    open: openConnectionContextMenu,
    close: closeConnectionContextMenu,
  } = useContextMenu<ConnectionContextMenuData>({
    connectionId: '',
    triggerMode: 'auto' as TriggerMode,
  })

  const {
    state: podContextMenu,
    open: openPodContextMenu,
    close: closePodContextMenu,
  } = useContextMenu<PodContextMenuData>({
    podId: '',
  })

  const handleRepositoryContextMenu = (data: { noteId: string; event: MouseEvent }): void => {
    const note = repositoryStore.typedNotes.find(n => n.id === data.noteId)
    if (!note) return

    const repository = repositoryStore.typedAvailableItems.find(r => r.id === note.repositoryId)
    if (!repository) return

    openRepositoryContextMenu(data.event, {
      repositoryId: repository.id,
      repositoryName: repository.name,
      notePosition: { x: note.x, y: note.y },
      isWorktree: repository.parentRepoId !== undefined && repository.parentRepoId !== null,
    })
  }

  const handleConnectionContextMenu = (data: { connectionId: string; event: MouseEvent }): void => {
    const connection = connectionStore.connections.find(c => c.id === data.connectionId)
    if (!connection) return

    openConnectionContextMenu(data.event, {
      connectionId: connection.id,
      triggerMode: connection.triggerMode,
    })
  }

  const handlePodContextMenu = (data: { podId: string; event: MouseEvent }): void => {
    const pod = podStore.getPodById(data.podId)
    if (!pod) return

    openPodContextMenu(data.event, {
      podId: pod.id,
    })
  }

  return {
    repositoryContextMenu,
    connectionContextMenu,
    podContextMenu,
    closeRepositoryContextMenu,
    closeConnectionContextMenu,
    closePodContextMenu,
    handleRepositoryContextMenu,
    handleConnectionContextMenu,
    handlePodContextMenu,
  }
}
