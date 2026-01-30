import { usePodStore, useViewportStore, useSelectionStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { useClipboardStore } from '@/stores/clipboardStore'

export function useCanvasContext(): {
  podStore: ReturnType<typeof usePodStore>
  viewportStore: ReturnType<typeof useViewportStore>
  selectionStore: ReturnType<typeof useSelectionStore>
  outputStyleStore: ReturnType<typeof useOutputStyleStore>
  skillStore: ReturnType<typeof useSkillStore>
  subAgentStore: ReturnType<typeof useSubAgentStore>
  repositoryStore: ReturnType<typeof useRepositoryStore>
  connectionStore: ReturnType<typeof useConnectionStore>
  clipboardStore: ReturnType<typeof useClipboardStore>
} {
  const podStore = usePodStore()
  const viewportStore = useViewportStore()
  const selectionStore = useSelectionStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const subAgentStore = useSubAgentStore()
  const repositoryStore = useRepositoryStore()
  const connectionStore = useConnectionStore()
  const clipboardStore = useClipboardStore()

  return {
    podStore,
    viewportStore,
    selectionStore,
    outputStyleStore,
    skillStore,
    subAgentStore,
    repositoryStore,
    connectionStore,
    clipboardStore
  }
}
