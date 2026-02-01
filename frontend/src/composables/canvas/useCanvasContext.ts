import { usePodStore, useViewportStore, useSelectionStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore, useSubAgentStore, useRepositoryStore, useCommandStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { useClipboardStore } from '@/stores/clipboardStore'
import { useChatStore } from '@/stores/chat'

export function useCanvasContext(): {
  podStore: ReturnType<typeof usePodStore>
  viewportStore: ReturnType<typeof useViewportStore>
  selectionStore: ReturnType<typeof useSelectionStore>
  outputStyleStore: ReturnType<typeof useOutputStyleStore>
  skillStore: ReturnType<typeof useSkillStore>
  subAgentStore: ReturnType<typeof useSubAgentStore>
  repositoryStore: ReturnType<typeof useRepositoryStore>
  commandStore: ReturnType<typeof useCommandStore>
  connectionStore: ReturnType<typeof useConnectionStore>
  clipboardStore: ReturnType<typeof useClipboardStore>
  chatStore: ReturnType<typeof useChatStore>
} {
  const podStore = usePodStore()
  const viewportStore = useViewportStore()
  const selectionStore = useSelectionStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const subAgentStore = useSubAgentStore()
  const repositoryStore = useRepositoryStore()
  const commandStore = useCommandStore()
  const connectionStore = useConnectionStore()
  const clipboardStore = useClipboardStore()
  const chatStore = useChatStore()

  return {
    podStore,
    viewportStore,
    selectionStore,
    outputStyleStore,
    skillStore,
    subAgentStore,
    repositoryStore,
    commandStore,
    connectionStore,
    clipboardStore,
    chatStore
  }
}
