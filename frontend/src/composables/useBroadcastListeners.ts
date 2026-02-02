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
import {useChatStore} from '@/stores/chat/chatStore'
import {truncateContent} from '@/stores/chat/chatUtils'
import {CONTENT_PREVIEW_LENGTH} from '@/lib/constants'
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
  BroadcastPodChatUserMessagePayload,
} from '@/types/websocket'

let registered = false

const isCurrentCanvas = (canvasId: string): boolean => {
  const canvasStore = useCanvasStore()
  return canvasStore.activeCanvasId === canvasId
}

/**
 * 建立帶有 Canvas 檢查的廣播處理器
 * 自動過濾非當前 Canvas 的廣播事件
 */
const createCanvasHandler = <T extends {canvasId: string}>(
  handler: (payload: T) => void
) => {
  return (payload: T): void => {
    if (!isCurrentCanvas(payload.canvasId)) return
    handler(payload)
  }
}

const handleBroadcastPodCreated = createCanvasHandler<BroadcastPodCreatedPayload>((payload) => {
  usePodStore().addPodFromBroadcast(payload.pod)
})

const handleBroadcastPodUpdated = createCanvasHandler<BroadcastPodUpdatedPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodDeleted = createCanvasHandler<BroadcastPodDeletedPayload>((payload) => {
  usePodStore().removePodFromBroadcast(payload.podId)
})

const handleBroadcastConnectionCreated = createCanvasHandler<BroadcastConnectionCreatedPayload>((payload) => {
  useConnectionStore().addConnectionFromBroadcast(payload.connection)
})

const handleBroadcastConnectionUpdated = createCanvasHandler<BroadcastConnectionUpdatedPayload>((payload) => {
  useConnectionStore().updateConnectionFromBroadcast(payload.connection)
})

const handleBroadcastConnectionDeleted = createCanvasHandler<BroadcastConnectionDeletedPayload>((payload) => {
  useConnectionStore().removeConnectionFromBroadcast(payload.connectionId)
})

const handleBroadcastTriggerCreated = createCanvasHandler<BroadcastTriggerCreatedPayload>((payload) => {
  useTriggerStore().addTriggerFromBroadcast(payload.trigger)
})

const handleBroadcastTriggerUpdated = createCanvasHandler<BroadcastTriggerUpdatedPayload>((payload) => {
  useTriggerStore().updateTriggerFromBroadcast(payload.trigger)
})

const handleBroadcastTriggerDeleted = createCanvasHandler<BroadcastTriggerDeletedPayload>((payload) => {
  useTriggerStore().removeTriggerFromBroadcast(payload.triggerId, payload.deletedConnectionIds)
})

const handleBroadcastOutputStyleCreated = createCanvasHandler<BroadcastOutputStyleCreatedPayload>((payload) => {
  useOutputStyleStore().addItemFromBroadcast(payload.outputStyle)
})

const handleBroadcastOutputStyleUpdated = createCanvasHandler<BroadcastOutputStyleUpdatedPayload>((_payload) => {
  // OutputStyle 更新後需要重新載入列表以取得最新的 name
  useOutputStyleStore().loadItems()
})

const handleBroadcastOutputStyleDeleted = createCanvasHandler<BroadcastOutputStyleDeletedPayload>((payload) => {
  useOutputStyleStore().removeItemFromBroadcast(payload.outputStyleId, payload.deletedNoteIds)
})

const handleBroadcastNoteCreated = createCanvasHandler<BroadcastNoteCreatedPayload>((payload) => {
  useOutputStyleStore().addNoteFromBroadcast(payload.note)
})

const handleBroadcastNoteUpdated = createCanvasHandler<BroadcastNoteUpdatedPayload>((payload) => {
  useOutputStyleStore().updateNoteFromBroadcast(payload.note)
})

const handleBroadcastNoteDeleted = createCanvasHandler<BroadcastNoteDeletedPayload>((payload) => {
  useOutputStyleStore().removeNoteFromBroadcast(payload.noteId)
})

const handleBroadcastSkillNoteCreated = createCanvasHandler<BroadcastSkillNoteCreatedPayload>((payload) => {
  useSkillStore().addNoteFromBroadcast(payload.note)
})

const handleBroadcastSkillNoteUpdated = createCanvasHandler<BroadcastSkillNoteUpdatedPayload>((payload) => {
  useSkillStore().updateNoteFromBroadcast(payload.note)
})

const handleBroadcastSkillNoteDeleted = createCanvasHandler<BroadcastSkillNoteDeletedPayload>((payload) => {
  useSkillStore().removeNoteFromBroadcast(payload.noteId)
})

const handleBroadcastSkillDeleted = createCanvasHandler<BroadcastSkillDeletedPayload>((payload) => {
  useSkillStore().removeItemFromBroadcast(payload.skillId, payload.deletedNoteIds)
})

const handleBroadcastRepositoryNoteCreated = createCanvasHandler<BroadcastRepositoryNoteCreatedPayload>((payload) => {
  useRepositoryStore().addNoteFromBroadcast(payload.note)
})

const handleBroadcastRepositoryNoteUpdated = createCanvasHandler<BroadcastRepositoryNoteUpdatedPayload>((payload) => {
  useRepositoryStore().updateNoteFromBroadcast(payload.note)
})

const handleBroadcastRepositoryNoteDeleted = createCanvasHandler<BroadcastRepositoryNoteDeletedPayload>((payload) => {
  useRepositoryStore().removeNoteFromBroadcast(payload.noteId)
})

const handleBroadcastRepositoryCreated = createCanvasHandler<BroadcastRepositoryCreatedPayload>((payload) => {
  useRepositoryStore().addItemFromBroadcast(payload.repository)
})

const handleBroadcastRepositoryDeleted = createCanvasHandler<BroadcastRepositoryDeletedPayload>((payload) => {
  useRepositoryStore().removeItemFromBroadcast(payload.repositoryId, payload.deletedNoteIds)
})

const handleBroadcastSubAgentNoteCreated = createCanvasHandler<BroadcastSubAgentNoteCreatedPayload>((payload) => {
  useSubAgentStore().addNoteFromBroadcast(payload.note)
})

const handleBroadcastSubAgentNoteUpdated = createCanvasHandler<BroadcastSubAgentNoteUpdatedPayload>((payload) => {
  useSubAgentStore().updateNoteFromBroadcast(payload.note)
})

const handleBroadcastSubAgentNoteDeleted = createCanvasHandler<BroadcastSubAgentNoteDeletedPayload>((payload) => {
  useSubAgentStore().removeNoteFromBroadcast(payload.noteId)
})

const handleBroadcastSubAgentCreated = createCanvasHandler<BroadcastSubAgentCreatedPayload>((payload) => {
  useSubAgentStore().addItemFromBroadcast(payload.subAgent)
})

const handleBroadcastSubAgentUpdated = createCanvasHandler<BroadcastSubAgentUpdatedPayload>((_payload) => {
  // SubAgent 更新後需要重新載入列表以取得最新的 name 和 description
  useSubAgentStore().loadItems()
})

const handleBroadcastSubAgentDeleted = createCanvasHandler<BroadcastSubAgentDeletedPayload>((payload) => {
  useSubAgentStore().removeItemFromBroadcast(payload.subAgentId, payload.deletedNoteIds)
})

const handleBroadcastCommandNoteCreated = createCanvasHandler<BroadcastCommandNoteCreatedPayload>((payload) => {
  useCommandStore().addNoteFromBroadcast(payload.note)
})

const handleBroadcastCommandNoteUpdated = createCanvasHandler<BroadcastCommandNoteUpdatedPayload>((payload) => {
  useCommandStore().updateNoteFromBroadcast(payload.note)
})

const handleBroadcastCommandNoteDeleted = createCanvasHandler<BroadcastCommandNoteDeletedPayload>((payload) => {
  useCommandStore().removeNoteFromBroadcast(payload.noteId)
})

const handleBroadcastCommandCreated = createCanvasHandler<BroadcastCommandCreatedPayload>((payload) => {
  useCommandStore().addItemFromBroadcast(payload.command)
})

const handleBroadcastCommandUpdated = createCanvasHandler<BroadcastCommandUpdatedPayload>((_payload) => {
  // Command 更新後需要重新載入列表以取得最新的 name
  useCommandStore().loadItems()
})

const handleBroadcastCommandDeleted = createCanvasHandler<BroadcastCommandDeletedPayload>((payload) => {
  useCommandStore().removeItemFromBroadcast(payload.commandId, payload.deletedNoteIds)
})

const handleBroadcastPodOutputStyleBound = createCanvasHandler<BroadcastPodOutputStyleBoundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodOutputStyleUnbound = createCanvasHandler<BroadcastPodOutputStyleUnboundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodSkillBound = createCanvasHandler<BroadcastPodSkillBoundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodRepositoryBound = createCanvasHandler<BroadcastPodRepositoryBoundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodRepositoryUnbound = createCanvasHandler<BroadcastPodRepositoryUnboundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodSubAgentBound = createCanvasHandler<BroadcastPodSubAgentBoundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodCommandBound = createCanvasHandler<BroadcastPodCommandBoundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodCommandUnbound = createCanvasHandler<BroadcastPodCommandUnboundPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastPodAutoClearSet = createCanvasHandler<BroadcastPodAutoClearSetPayload>((payload) => {
  usePodStore().updatePodFromBroadcast(payload.pod)
})

const handleBroadcastCanvasRenamed = (payload: BroadcastCanvasRenamedPayload): void => {
  useCanvasStore().renameCanvasFromBroadcast(payload.canvasId, payload.newName)
}

const handleBroadcastCanvasDeleted = (payload: BroadcastCanvasDeletedPayload): void => {
  useCanvasStore().removeCanvasFromBroadcast(payload.canvasId)
}

const handleBroadcastCanvasPasted = createCanvasHandler<BroadcastCanvasPastedPayload>((payload) => {
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
})

const handleBroadcastWorkflowClearResult = createCanvasHandler<BroadcastWorkflowClearResultPayload>((payload) => {
  if (payload.clearedPodIds) {
    const chatStore = useChatStore()
    chatStore.clearMessagesByPodIds(payload.clearedPodIds)

    const podStore = usePodStore()
    podStore.clearPodOutputsByIds(payload.clearedPodIds)
  }
})

const handleBroadcastPodChatUserMessage = (payload: BroadcastPodChatUserMessagePayload): void => {
  const chatStore = useChatStore()
  const podStore = usePodStore()
  const messages = chatStore.messagesByPodId.get(payload.podId) || []

  const userMessage = {
    id: payload.messageId,
    role: 'user' as const,
    content: payload.content,
    timestamp: payload.timestamp
  }

  chatStore.messagesByPodId.set(payload.podId, [...messages, userMessage])

  // 更新 Pod 的 output，讓小螢幕能顯示用戶訊息
  const pod = podStore.getPodById(payload.podId)
  if (pod) {
    const truncatedContent = `> ${truncateContent(payload.content, CONTENT_PREVIEW_LENGTH)}`
    podStore.updatePod({
      ...pod,
      output: [...pod.output, truncatedContent]
    })
  }
}

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
  {event: WebSocketResponseEvents.BROADCAST_POD_CHAT_USER_MESSAGE, handler: handleBroadcastPodChatUserMessage},
]

export const registerBroadcastListeners = (): void => {
  if (registered) return
  registered = true

  for (const {event, handler} of listeners) {
    websocketClient.on(event, handler)
  }
}

export const unregisterBroadcastListeners = (): void => {
  if (!registered) return
  registered = false

  for (const {event, handler} of listeners) {
    websocketClient.off(event, handler)
  }
}

export const useBroadcastListeners = (): {
  registerBroadcastListeners: () => void
  unregisterBroadcastListeners: () => void
} => {
  return {
    registerBroadcastListeners,
    unregisterBroadcastListeners,
  }
}
