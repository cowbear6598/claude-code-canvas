import { usePodStore, useViewportStore, useSelectionStore } from '@/stores/pod'
import { useOutputStyleStore, useSkillStore } from '@/stores/note'
import { useConnectionStore } from '@/stores/connectionStore'
import { useClipboardStore } from '@/stores/clipboardStore'

export function useCanvasContext() {
  const podStore = usePodStore()
  const viewportStore = useViewportStore()
  const selectionStore = useSelectionStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const connectionStore = useConnectionStore()
  const clipboardStore = useClipboardStore()

  return {
    podStore,
    viewportStore,
    selectionStore,
    outputStyleStore,
    skillStore,
    connectionStore,
    clipboardStore
  }
}
