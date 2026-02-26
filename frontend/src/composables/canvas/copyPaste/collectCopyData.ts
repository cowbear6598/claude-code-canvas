import type {
  SelectableElement,
  CopiedPod,
  CopiedOutputStyleNote,
  CopiedSkillNote,
  CopiedRepositoryNote,
  CopiedSubAgentNote,
  CopiedCommandNote,
  CopiedConnection,
} from '@/types'

type StoreWithNotes<TNote extends { boundToPodId: string | null }> = {
  notes: TNote[]
}

export function collectBoundNotesFromStore<T, TNote extends { boundToPodId: string | null }>(
  podId: string,
  store: StoreWithNotes<TNote>,
  mapFn: (note: TNote) => T
): T[] {
  return store.notes
    .filter(note => note.boundToPodId === podId)
    .map(mapFn)
}

export function collectBoundNotes(
  podId: string,
  outputStyleNotes: CopiedOutputStyleNote[],
  skillNotes: CopiedSkillNote[],
  repositoryNotes: CopiedRepositoryNote[],
  subAgentNotes: CopiedSubAgentNote[],
  commandNotes: CopiedCommandNote[],
  outputStyleStore: StoreWithNotes<{ id: string; outputStyleId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  skillStore: StoreWithNotes<{ id: string; skillId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  repositoryStore: StoreWithNotes<{ repositoryId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  subAgentStore: StoreWithNotes<{ id: string; subAgentId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  commandStore: StoreWithNotes<{ commandId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>
): void {
  outputStyleNotes.push(...collectBoundNotesFromStore(
    podId,
    outputStyleStore,
    (note) => ({
      id: note.id,
      outputStyleId: note.outputStyleId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  ))

  skillNotes.push(...collectBoundNotesFromStore(
    podId,
    skillStore,
    (note) => ({
      id: note.id,
      skillId: note.skillId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  ))

  repositoryNotes.push(...collectBoundNotesFromStore(
    podId,
    repositoryStore,
    (note) => ({
      repositoryId: note.repositoryId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  ))

  subAgentNotes.push(...collectBoundNotesFromStore(
    podId,
    subAgentStore,
    (note) => ({
      id: note.id,
      subAgentId: note.subAgentId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  ))

  commandNotes.push(...collectBoundNotesFromStore(
    podId,
    commandStore,
    (note) => ({
      commandId: note.commandId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  ))
}

export function createUnboundNoteCollector<T, TNote extends { id?: string; boundToPodId: string | null; x: number; y: number; name: string; originalPosition: { x: number; y: number } | null }>(
  store: { notes: TNote[] },
  mapFn: (note: TNote) => T
): (noteId: string) => T | null {
  return (noteId: string): T | null => {
    const note = store.notes.find(n => n.id === noteId)
    if (!note || note.boundToPodId !== null) return null
    return mapFn(note)
  }
}

export function collectSelectedPods(
  selectedElements: SelectableElement[],
  pods: { id: string; name: string; color: string; x: number; y: number; rotation: number; outputStyleId: string | null; skillIds: string[]; subAgentIds: string[]; model: string; repositoryId: string | null; commandId: string | null }[]
): CopiedPod[] {
  const copiedPods: CopiedPod[] = []

  for (const element of selectedElements) {
    if (element.type === 'pod') {
      const pod = pods.find(p => p.id === element.id)
      if (pod) {
        copiedPods.push({
          id: pod.id,
          name: pod.name,
          color: pod.color,
          x: pod.x,
          y: pod.y,
          rotation: pod.rotation,
          outputStyleId: pod.outputStyleId,
          skillIds: pod.skillIds,
          subAgentIds: pod.subAgentIds,
          model: pod.model,
          repositoryId: pod.repositoryId,
          commandId: pod.commandId,
        })
      }
    }
  }

  return copiedPods
}

export function collectSelectedNotes(
  selectedElements: SelectableElement[],
  selectedPodIds: Set<string>,
  outputStyleStore: StoreWithNotes<{ id: string; outputStyleId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  skillStore: StoreWithNotes<{ id: string; skillId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  repositoryStore: StoreWithNotes<{ repositoryId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  subAgentStore: StoreWithNotes<{ id: string; subAgentId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>,
  commandStore: StoreWithNotes<{ commandId: string; name: string; x: number; y: number; boundToPodId: string | null; originalPosition: { x: number; y: number } | null }>
): {
  outputStyleNotes: CopiedOutputStyleNote[]
  skillNotes: CopiedSkillNote[]
  repositoryNotes: CopiedRepositoryNote[]
  subAgentNotes: CopiedSubAgentNote[]
  commandNotes: CopiedCommandNote[]
} {
  const copiedOutputStyleNotes: CopiedOutputStyleNote[] = []
  const copiedSkillNotes: CopiedSkillNote[] = []
  const copiedRepositoryNotes: CopiedRepositoryNote[] = []
  const copiedSubAgentNotes: CopiedSubAgentNote[] = []
  const copiedCommandNotes: CopiedCommandNote[] = []

  for (const podId of selectedPodIds) {
    collectBoundNotes(podId, copiedOutputStyleNotes, copiedSkillNotes, copiedRepositoryNotes, copiedSubAgentNotes, copiedCommandNotes, outputStyleStore, skillStore, repositoryStore, subAgentStore, commandStore)
  }

  const collectUnboundOutputStyleNote = createUnboundNoteCollector<CopiedOutputStyleNote, typeof outputStyleStore.notes[0]>(
    outputStyleStore,
    (note) => ({
      id: note.id,
      outputStyleId: note.outputStyleId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundSkillNote = createUnboundNoteCollector<CopiedSkillNote, typeof skillStore.notes[0]>(
    skillStore,
    (note) => ({
      id: note.id,
      skillId: note.skillId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundRepositoryNote = createUnboundNoteCollector<CopiedRepositoryNote, typeof repositoryStore.notes[0]>(
    repositoryStore,
    (note) => ({
      repositoryId: note.repositoryId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundSubAgentNote = createUnboundNoteCollector<CopiedSubAgentNote, typeof subAgentStore.notes[0]>(
    subAgentStore,
    (note) => ({
      id: note.id,
      subAgentId: note.subAgentId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const collectUnboundCommandNote = createUnboundNoteCollector<CopiedCommandNote, typeof commandStore.notes[0]>(
    commandStore,
    (note) => ({
      commandId: note.commandId,
      name: note.name,
      x: note.x,
      y: note.y,
      boundToOriginalPodId: note.boundToPodId,
      originalPosition: note.originalPosition,
    })
  )

  const noteCollectorMap = {
    outputStyleNote: { collector: collectUnboundOutputStyleNote, array: copiedOutputStyleNotes },
    skillNote: { collector: collectUnboundSkillNote, array: copiedSkillNotes },
    repositoryNote: { collector: collectUnboundRepositoryNote, array: copiedRepositoryNotes },
    subAgentNote: { collector: collectUnboundSubAgentNote, array: copiedSubAgentNotes },
    commandNote: { collector: collectUnboundCommandNote, array: copiedCommandNotes },
  } as const

  for (const element of selectedElements) {
    const collectorInfo = noteCollectorMap[element.type as keyof typeof noteCollectorMap]
    if (collectorInfo) {
      const note = collectorInfo.collector(element.id)
      if (note) {
        collectorInfo.array.push(note as never)
      }
    }
  }

  return {
    outputStyleNotes: copiedOutputStyleNotes,
    skillNotes: copiedSkillNotes,
    repositoryNotes: copiedRepositoryNotes,
    subAgentNotes: copiedSubAgentNotes,
    commandNotes: copiedCommandNotes,
  }
}

export function collectRelatedConnections(
  selectedPodIds: Set<string>,
  connections: { id: string; sourcePodId: string; targetPodId: string; sourceAnchor: string; targetAnchor: string; autoTrigger: boolean }[]
): CopiedConnection[] {
  const copiedConnections: CopiedConnection[] = []

  for (const connection of connections) {
    if (selectedPodIds.has(connection.sourcePodId) && selectedPodIds.has(connection.targetPodId)) {
      copiedConnections.push({
        sourcePodId: connection.sourcePodId,
        sourceAnchor: connection.sourceAnchor,
        targetPodId: connection.targetPodId,
        targetAnchor: connection.targetAnchor,
        autoTrigger: connection.autoTrigger,
      })
    }
  }

  return copiedConnections
}
