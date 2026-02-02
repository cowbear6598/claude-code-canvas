import {websocketClient, WebSocketResponseEvents} from '@/services/websocket'
import {usePodStore} from '@/stores/pod/podStore'
import {useConnectionStore} from '@/stores/connectionStore'
import {useTriggerStore} from '@/stores/triggerStore'
import {useOutputStyleStore} from '@/stores/note/outputStyleStore'
import {useSkillStore} from '@/stores/note/skillStore'
import {useRepositoryStore} from '@/stores/note/repositoryStore'
import {useSubAgentStore} from '@/stores/note/subAgentStore'
import {useCommandStore} from '@/stores/note/commandStore'
import {useCanvasStore} from '@/stores/canvasStore'
import type {Pod} from '@/types'
import type {
  BroadcastPodCreatedPayload,
  BroadcastPodUpdatedPayload,
  BroadcastPodDeletedPayload,
  BroadcastConnectionCreatedPayload,
  BroadcastConnectionUpdatedPayload,
  BroadcastConnectionDeletedPayload,
  BroadcastTriggerCreatedPayload,
  BroadcastTriggerUpdatedPayload,
  BroadcastTriggerDeletedPayload,
  BroadcastOutputStyleCreatedPayload,
  BroadcastOutputStyleUpdatedPayload,
  BroadcastOutputStyleDeletedPayload,
  BroadcastNoteCreatedPayload,
  BroadcastNoteUpdatedPayload,
  BroadcastNoteDeletedPayload,
  BroadcastSkillNoteCreatedPayload,
  BroadcastSkillNoteUpdatedPayload,
  BroadcastSkillNoteDeletedPayload,
  BroadcastSkillDeletedPayload,
  BroadcastRepositoryNoteCreatedPayload,
  BroadcastRepositoryNoteUpdatedPayload,
  BroadcastRepositoryNoteDeletedPayload,
  BroadcastRepositoryCreatedPayload,
  BroadcastRepositoryDeletedPayload,
  BroadcastSubAgentNoteCreatedPayload,
  BroadcastSubAgentNoteUpdatedPayload,
  BroadcastSubAgentNoteDeletedPayload,
  BroadcastSubAgentCreatedPayload,
  BroadcastSubAgentUpdatedPayload,
  BroadcastSubAgentDeletedPayload,
  BroadcastCommandNoteCreatedPayload,
  BroadcastCommandNoteUpdatedPayload,
  BroadcastCommandNoteDeletedPayload,
  BroadcastCommandCreatedPayload,
  BroadcastCommandUpdatedPayload,
  BroadcastCommandDeletedPayload,
  BroadcastPodOutputStyleBoundPayload,
  BroadcastPodOutputStyleUnboundPayload,
  BroadcastPodSkillBoundPayload,
  BroadcastPodRepositoryBoundPayload,
  BroadcastPodRepositoryUnboundPayload,
  BroadcastPodSubAgentBoundPayload,
  BroadcastPodCommandBoundPayload,
  BroadcastPodCommandUnboundPayload,
  BroadcastPodAutoClearSetPayload,
  BroadcastCanvasRenamedPayload,
  BroadcastCanvasDeletedPayload,
  BroadcastCanvasPastedPayload,
  BroadcastWorkflowClearResultPayload,
} from '@/types/websocket'

let registered = false

const isCurrentCanvas = (canvasId: string): boolean => {
  const canvasStore = useCanvasStore()
  return canvasStore.activeCanvasId === canvasId
}

const handleBroadcastPodCreated = (payload: BroadcastPodCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().addPodFromBroadcast(payload.pod)
}

const handleBroadcastPodUpdated = (payload: BroadcastPodUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodDeleted = (payload: BroadcastPodDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().removePodFromBroadcast(payload.podId)
}

const handleBroadcastConnectionCreated = (payload: BroadcastConnectionCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useConnectionStore().addConnectionFromBroadcast(payload.connection)
}

const handleBroadcastConnectionUpdated = (payload: BroadcastConnectionUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useConnectionStore().updateConnectionFromBroadcast(payload.connection)
}

const handleBroadcastConnectionDeleted = (payload: BroadcastConnectionDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useConnectionStore().removeConnectionFromBroadcast(payload.connectionId)
}

const handleBroadcastTriggerCreated = (payload: BroadcastTriggerCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useTriggerStore().addTriggerFromBroadcast(payload.trigger)
}

const handleBroadcastTriggerUpdated = (payload: BroadcastTriggerUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useTriggerStore().updateTriggerFromBroadcast(payload.trigger)
}

const handleBroadcastTriggerDeleted = (payload: BroadcastTriggerDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useTriggerStore().removeTriggerFromBroadcast(payload.triggerId, payload.deletedConnectionIds)
}

const handleBroadcastOutputStyleCreated = (payload: BroadcastOutputStyleCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useOutputStyleStore().addItemFromBroadcast(payload.outputStyle)
}

const handleBroadcastOutputStyleUpdated = (payload: BroadcastOutputStyleUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
}

const handleBroadcastOutputStyleDeleted = (payload: BroadcastOutputStyleDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useOutputStyleStore().removeItemFromBroadcast(payload.outputStyleId, payload.deletedNoteIds)
}

const handleBroadcastNoteCreated = (payload: BroadcastNoteCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useOutputStyleStore().addNoteFromBroadcast(payload.note)
}

const handleBroadcastNoteUpdated = (payload: BroadcastNoteUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useOutputStyleStore().updateNoteFromBroadcast(payload.note)
}

const handleBroadcastNoteDeleted = (payload: BroadcastNoteDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useOutputStyleStore().removeNoteFromBroadcast(payload.noteId)
}

const handleBroadcastSkillNoteCreated = (payload: BroadcastSkillNoteCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSkillStore().addNoteFromBroadcast(payload.note)
}

const handleBroadcastSkillNoteUpdated = (payload: BroadcastSkillNoteUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSkillStore().updateNoteFromBroadcast(payload.note)
}

const handleBroadcastSkillNoteDeleted = (payload: BroadcastSkillNoteDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSkillStore().removeNoteFromBroadcast(payload.noteId)
}

const handleBroadcastSkillDeleted = (payload: BroadcastSkillDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSkillStore().removeItemFromBroadcast(payload.skillId, payload.deletedNoteIds)
}

const handleBroadcastRepositoryNoteCreated = (payload: BroadcastRepositoryNoteCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useRepositoryStore().addNoteFromBroadcast(payload.note)
}

const handleBroadcastRepositoryNoteUpdated = (payload: BroadcastRepositoryNoteUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useRepositoryStore().updateNoteFromBroadcast(payload.note)
}

const handleBroadcastRepositoryNoteDeleted = (payload: BroadcastRepositoryNoteDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useRepositoryStore().removeNoteFromBroadcast(payload.noteId)
}

const handleBroadcastRepositoryCreated = (payload: BroadcastRepositoryCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useRepositoryStore().addItemFromBroadcast(payload.repository)
}

const handleBroadcastRepositoryDeleted = (payload: BroadcastRepositoryDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useRepositoryStore().removeItemFromBroadcast(payload.repositoryId, payload.deletedNoteIds)
}

const handleBroadcastSubAgentNoteCreated = (payload: BroadcastSubAgentNoteCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSubAgentStore().addNoteFromBroadcast(payload.note)
}

const handleBroadcastSubAgentNoteUpdated = (payload: BroadcastSubAgentNoteUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSubAgentStore().updateNoteFromBroadcast(payload.note)
}

const handleBroadcastSubAgentNoteDeleted = (payload: BroadcastSubAgentNoteDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSubAgentStore().removeNoteFromBroadcast(payload.noteId)
}

const handleBroadcastSubAgentCreated = (payload: BroadcastSubAgentCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSubAgentStore().addItemFromBroadcast(payload.subAgent)
}

const handleBroadcastSubAgentUpdated = (payload: BroadcastSubAgentUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
}

const handleBroadcastSubAgentDeleted = (payload: BroadcastSubAgentDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useSubAgentStore().removeItemFromBroadcast(payload.subAgentId, payload.deletedNoteIds)
}

const handleBroadcastCommandNoteCreated = (payload: BroadcastCommandNoteCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useCommandStore().addNoteFromBroadcast(payload.note)
}

const handleBroadcastCommandNoteUpdated = (payload: BroadcastCommandNoteUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useCommandStore().updateNoteFromBroadcast(payload.note)
}

const handleBroadcastCommandNoteDeleted = (payload: BroadcastCommandNoteDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useCommandStore().removeNoteFromBroadcast(payload.noteId)
}

const handleBroadcastCommandCreated = (payload: BroadcastCommandCreatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useCommandStore().addItemFromBroadcast(payload.command)
}

const handleBroadcastCommandUpdated = (payload: BroadcastCommandUpdatedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
}

const handleBroadcastCommandDeleted = (payload: BroadcastCommandDeletedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  useCommandStore().removeItemFromBroadcast(payload.commandId, payload.deletedNoteIds)
}

const handleBroadcastPodOutputStyleBound = (payload: BroadcastPodOutputStyleBoundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodOutputStyleUnbound = (payload: BroadcastPodOutputStyleUnboundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodSkillBound = (payload: BroadcastPodSkillBoundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodRepositoryBound = (payload: BroadcastPodRepositoryBoundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodRepositoryUnbound = (payload: BroadcastPodRepositoryUnboundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodSubAgentBound = (payload: BroadcastPodSubAgentBoundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodCommandBound = (payload: BroadcastPodCommandBoundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodCommandUnbound = (payload: BroadcastPodCommandUnboundPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastPodAutoClearSet = (payload: BroadcastPodAutoClearSetPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return
  usePodStore().updatePodFromBroadcast(payload.pod)
}

const handleBroadcastCanvasRenamed = (payload: BroadcastCanvasRenamedPayload): void => {
  useCanvasStore().renameCanvasFromBroadcast(payload.canvasId, payload.newName)
}

const handleBroadcastCanvasDeleted = (payload: BroadcastCanvasDeletedPayload): void => {
  useCanvasStore().removeCanvasFromBroadcast(payload.canvasId)
}

const handleBroadcastCanvasPasted = (payload: BroadcastCanvasPastedPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return

  const podStore = usePodStore()
  const connectionStore = useConnectionStore()
  const outputStyleStore = useOutputStyleStore()
  const skillStore = useSkillStore()
  const repositoryStore = useRepositoryStore()
  const subAgentStore = useSubAgentStore()
  const commandStore = useCommandStore()

  if (payload.createdPods) {
    for (const pod of payload.createdPods) {
      podStore.addPodFromBroadcast(pod)
    }
  }

  if (payload.createdOutputStyleNotes) {
    for (const note of payload.createdOutputStyleNotes) {
      outputStyleStore.addNoteFromBroadcast(note)
    }
  }

  if (payload.createdSkillNotes) {
    for (const note of payload.createdSkillNotes) {
      skillStore.addNoteFromBroadcast(note)
    }
  }

  if (payload.createdRepositoryNotes) {
    for (const note of payload.createdRepositoryNotes) {
      repositoryStore.addNoteFromBroadcast(note)
    }
  }

  if (payload.createdSubAgentNotes) {
    for (const note of payload.createdSubAgentNotes) {
      subAgentStore.addNoteFromBroadcast(note)
    }
  }

  if (payload.createdCommandNotes) {
    for (const note of payload.createdCommandNotes) {
      commandStore.addNoteFromBroadcast(note)
    }
  }

  if (payload.createdConnections) {
    for (const connection of payload.createdConnections) {
      connectionStore.addConnectionFromBroadcast(connection)
    }
  }
}

const handleBroadcastWorkflowClearResult = (payload: BroadcastWorkflowClearResultPayload): void => {
  if (!isCurrentCanvas(payload.canvasId)) return

  const podStore = usePodStore()

  if (payload.clearedPodIds) {
    for (const podId of payload.clearedPodIds) {
      const pod = podStore.getPodById(podId)
      if (pod) {
        const updatedPod: Pod = {...pod, output: []}
        podStore.updatePodFromBroadcast(updatedPod)
      }
    }
  }
}

export const registerBroadcastListeners = (): void => {
  if (registered) return
  registered = true

  const listeners = [
    {event: WebSocketResponseEvents.BROADCAST_POD_CREATED, handler: handleBroadcastPodCreated},
    {event: WebSocketResponseEvents.BROADCAST_POD_UPDATED, handler: handleBroadcastPodUpdated},
    {event: WebSocketResponseEvents.BROADCAST_POD_DELETED, handler: handleBroadcastPodDeleted},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_CREATED, handler: handleBroadcastConnectionCreated},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_UPDATED, handler: handleBroadcastConnectionUpdated},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_DELETED, handler: handleBroadcastConnectionDeleted},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_CREATED, handler: handleBroadcastTriggerCreated},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_UPDATED, handler: handleBroadcastTriggerUpdated},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_DELETED, handler: handleBroadcastTriggerDeleted},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_CREATED, handler: handleBroadcastOutputStyleCreated},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_UPDATED, handler: handleBroadcastOutputStyleUpdated},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_DELETED, handler: handleBroadcastOutputStyleDeleted},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_CREATED, handler: handleBroadcastNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_UPDATED, handler: handleBroadcastNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_DELETED, handler: handleBroadcastNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_CREATED, handler: handleBroadcastSkillNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_UPDATED, handler: handleBroadcastSkillNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_DELETED, handler: handleBroadcastSkillNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_DELETED, handler: handleBroadcastSkillDeleted},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_CREATED, handler: handleBroadcastRepositoryNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_UPDATED, handler: handleBroadcastRepositoryNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_DELETED, handler: handleBroadcastRepositoryNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_CREATED, handler: handleBroadcastRepositoryCreated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_DELETED, handler: handleBroadcastRepositoryDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_CREATED, handler: handleBroadcastSubAgentNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_UPDATED, handler: handleBroadcastSubAgentNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_DELETED, handler: handleBroadcastSubAgentNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_CREATED, handler: handleBroadcastSubAgentCreated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_UPDATED, handler: handleBroadcastSubAgentUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_DELETED, handler: handleBroadcastSubAgentDeleted},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_CREATED, handler: handleBroadcastCommandNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_UPDATED, handler: handleBroadcastCommandNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_DELETED, handler: handleBroadcastCommandNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_CREATED, handler: handleBroadcastCommandCreated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_UPDATED, handler: handleBroadcastCommandUpdated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_DELETED, handler: handleBroadcastCommandDeleted},
    {event: WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_BOUND, handler: handleBroadcastPodOutputStyleBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_UNBOUND, handler: handleBroadcastPodOutputStyleUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_SKILL_BOUND, handler: handleBroadcastPodSkillBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_BOUND, handler: handleBroadcastPodRepositoryBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_UNBOUND, handler: handleBroadcastPodRepositoryUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_SUBAGENT_BOUND, handler: handleBroadcastPodSubAgentBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_COMMAND_BOUND, handler: handleBroadcastPodCommandBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_COMMAND_UNBOUND, handler: handleBroadcastPodCommandUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_AUTO_CLEAR_SET, handler: handleBroadcastPodAutoClearSet},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_RENAMED, handler: handleBroadcastCanvasRenamed},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_DELETED, handler: handleBroadcastCanvasDeleted},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_PASTED, handler: handleBroadcastCanvasPasted},
    {event: WebSocketResponseEvents.BROADCAST_WORKFLOW_CLEAR_RESULT, handler: handleBroadcastWorkflowClearResult},
  ]

  for (const {event, handler} of listeners) {
    websocketClient.on(event, handler)
  }
}

export const unregisterBroadcastListeners = (): void => {
  if (!registered) return
  registered = false

  const listeners = [
    {event: WebSocketResponseEvents.BROADCAST_POD_CREATED, handler: handleBroadcastPodCreated},
    {event: WebSocketResponseEvents.BROADCAST_POD_UPDATED, handler: handleBroadcastPodUpdated},
    {event: WebSocketResponseEvents.BROADCAST_POD_DELETED, handler: handleBroadcastPodDeleted},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_CREATED, handler: handleBroadcastConnectionCreated},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_UPDATED, handler: handleBroadcastConnectionUpdated},
    {event: WebSocketResponseEvents.BROADCAST_CONNECTION_DELETED, handler: handleBroadcastConnectionDeleted},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_CREATED, handler: handleBroadcastTriggerCreated},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_UPDATED, handler: handleBroadcastTriggerUpdated},
    {event: WebSocketResponseEvents.BROADCAST_TRIGGER_DELETED, handler: handleBroadcastTriggerDeleted},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_CREATED, handler: handleBroadcastOutputStyleCreated},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_UPDATED, handler: handleBroadcastOutputStyleUpdated},
    {event: WebSocketResponseEvents.BROADCAST_OUTPUT_STYLE_DELETED, handler: handleBroadcastOutputStyleDeleted},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_CREATED, handler: handleBroadcastNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_UPDATED, handler: handleBroadcastNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_NOTE_DELETED, handler: handleBroadcastNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_CREATED, handler: handleBroadcastSkillNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_UPDATED, handler: handleBroadcastSkillNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_NOTE_DELETED, handler: handleBroadcastSkillNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SKILL_DELETED, handler: handleBroadcastSkillDeleted},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_CREATED, handler: handleBroadcastRepositoryNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_UPDATED, handler: handleBroadcastRepositoryNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_NOTE_DELETED, handler: handleBroadcastRepositoryNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_CREATED, handler: handleBroadcastRepositoryCreated},
    {event: WebSocketResponseEvents.BROADCAST_REPOSITORY_DELETED, handler: handleBroadcastRepositoryDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_CREATED, handler: handleBroadcastSubAgentNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_UPDATED, handler: handleBroadcastSubAgentNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_NOTE_DELETED, handler: handleBroadcastSubAgentNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_CREATED, handler: handleBroadcastSubAgentCreated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_UPDATED, handler: handleBroadcastSubAgentUpdated},
    {event: WebSocketResponseEvents.BROADCAST_SUBAGENT_DELETED, handler: handleBroadcastSubAgentDeleted},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_CREATED, handler: handleBroadcastCommandNoteCreated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_UPDATED, handler: handleBroadcastCommandNoteUpdated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_NOTE_DELETED, handler: handleBroadcastCommandNoteDeleted},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_CREATED, handler: handleBroadcastCommandCreated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_UPDATED, handler: handleBroadcastCommandUpdated},
    {event: WebSocketResponseEvents.BROADCAST_COMMAND_DELETED, handler: handleBroadcastCommandDeleted},
    {event: WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_BOUND, handler: handleBroadcastPodOutputStyleBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_OUTPUT_STYLE_UNBOUND, handler: handleBroadcastPodOutputStyleUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_SKILL_BOUND, handler: handleBroadcastPodSkillBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_BOUND, handler: handleBroadcastPodRepositoryBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_REPOSITORY_UNBOUND, handler: handleBroadcastPodRepositoryUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_SUBAGENT_BOUND, handler: handleBroadcastPodSubAgentBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_COMMAND_BOUND, handler: handleBroadcastPodCommandBound},
    {event: WebSocketResponseEvents.BROADCAST_POD_COMMAND_UNBOUND, handler: handleBroadcastPodCommandUnbound},
    {event: WebSocketResponseEvents.BROADCAST_POD_AUTO_CLEAR_SET, handler: handleBroadcastPodAutoClearSet},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_RENAMED, handler: handleBroadcastCanvasRenamed},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_DELETED, handler: handleBroadcastCanvasDeleted},
    {event: WebSocketResponseEvents.BROADCAST_CANVAS_PASTED, handler: handleBroadcastCanvasPasted},
    {event: WebSocketResponseEvents.BROADCAST_WORKFLOW_CLEAR_RESULT, handler: handleBroadcastWorkflowClearResult},
  ]

  for (const {event, handler} of listeners) {
    websocketClient.off(event, handler)
  }
}

export const useBroadcastListeners = () => {
  return {
    registerBroadcastListeners,
    unregisterBroadcastListeners,
  }
}
