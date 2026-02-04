import { websocketClient, WebSocketResponseEvents } from '@/services/websocket'
import { tryResolvePendingRequest } from '@/services/websocket/createWebSocketRequest'
import { usePodStore } from '@/stores/pod/podStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useOutputStyleStore } from '@/stores/note/outputStyleStore'
import { useSkillStore } from '@/stores/note/skillStore'
import { useRepositoryStore } from '@/stores/note/repositoryStore'
import { useSubAgentStore } from '@/stores/note/subAgentStore'
import { useCommandStore } from '@/stores/note/commandStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useChatStore } from '@/stores/chat/chatStore'
import { useToast } from '@/composables/useToast'
import { truncateContent } from '@/stores/chat/chatUtils'
import { CONTENT_PREVIEW_LENGTH } from '@/lib/constants'
import type { Pod, Connection, OutputStyleNote, SkillNote, RepositoryNote, SubAgentNote, CommandNote, Canvas } from '@/types'

let registered = false

interface BasePayload {
  requestId?: string
  canvasId?: string
}

interface UnifiedHandlerOptions {
  toastMessage?: string
  skipCanvasCheck?: boolean
}

const isCurrentCanvas = (canvasId: string): boolean => {
  const canvasStore = useCanvasStore()
  return canvasStore.activeCanvasId === canvasId
}

function createUnifiedHandler<T extends BasePayload>(
  handler: (payload: T, isOwnOperation: boolean) => void,
  options?: UnifiedHandlerOptions
): (payload: T) => void {
  return (payload: T): void => {
    if (!options?.skipCanvasCheck && payload.canvasId) {
      if (!isCurrentCanvas(payload.canvasId)) {
        return
      }
    }

    const isOwnOperation = payload.requestId ? tryResolvePendingRequest(payload.requestId, payload) : false

    if (isOwnOperation && options?.toastMessage) {
      const { toast } = useToast()
      toast({ title: options.toastMessage })
    }

    handler(payload, isOwnOperation)
  }
}

const handlePodCreated = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().addPodFromEvent(payload.pod)
    }
  },
  { toastMessage: 'Pod 建立成功' }
)

const handlePodMoved = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePodPosition(payload.pod.id, payload.pod.x, payload.pod.y)
    }
  }
)

const handlePodRenamed = createUnifiedHandler<BasePayload & { podId: string; name: string; canvasId: string }>(
  (payload) => {
    usePodStore().updatePodName(payload.podId, payload.name)
  },
  { toastMessage: '重命名成功' }
)

const handlePodModelSet = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  },
  { toastMessage: '模型設定成功' }
)

const handlePodScheduleSet = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  },
  { toastMessage: '排程設定成功' }
)

const removeDeletedNotes = (deletedNoteIds: {
  note?: string[]
  skillNote?: string[]
  repositoryNote?: string[]
  commandNote?: string[]
  subAgentNote?: string[]
} | undefined): void => {
  if (!deletedNoteIds) return

  const { note, skillNote, repositoryNote, commandNote, subAgentNote } = deletedNoteIds

  if (note && note.length > 0) {
    const outputStyleStore = useOutputStyleStore()
    note.forEach(noteId => outputStyleStore.removeNoteFromEvent(noteId))
  }

  if (skillNote && skillNote.length > 0) {
    const skillStore = useSkillStore()
    skillNote.forEach(noteId => skillStore.removeNoteFromEvent(noteId))
  }

  if (repositoryNote && repositoryNote.length > 0) {
    const repositoryStore = useRepositoryStore()
    repositoryNote.forEach(noteId => repositoryStore.removeNoteFromEvent(noteId))
  }

  if (commandNote && commandNote.length > 0) {
    const commandStore = useCommandStore()
    commandNote.forEach(noteId => commandStore.removeNoteFromEvent(noteId))
  }

  if (subAgentNote && subAgentNote.length > 0) {
    const subAgentStore = useSubAgentStore()
    subAgentNote.forEach(noteId => subAgentStore.removeNoteFromEvent(noteId))
  }
}

const handlePodDeleted = createUnifiedHandler<BasePayload & {
  podId: string
  canvasId: string
  deletedNoteIds?: {
    note?: string[]
    skillNote?: string[]
    repositoryNote?: string[]
    commandNote?: string[]
    subAgentNote?: string[]
  }
}>(
  (payload) => {
    usePodStore().removePod(payload.podId)
    removeDeletedNotes(payload.deletedNoteIds)
  },
  { toastMessage: 'Pod 已刪除' }
)

const handlePodOutputStyleBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodOutputStyleUnbound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodSkillBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodRepositoryBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodRepositoryUnbound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodSubAgentBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodCommandBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodCommandUnbound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodAutoClearSet = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handleConnectionCreated = createUnifiedHandler<BasePayload & { connection?: Connection; canvasId: string }>(
  (payload) => {
    if (payload.connection) {
      useConnectionStore().addConnectionFromEvent(payload.connection)
    }
  },
  { toastMessage: '連線建立成功' }
)

const handleConnectionUpdated = createUnifiedHandler<BasePayload & { connection?: Connection; canvasId: string }>(
  (payload) => {
    if (payload.connection) {
      useConnectionStore().updateConnectionFromEvent(payload.connection)
    }
  }
)

const handleConnectionDeleted = createUnifiedHandler<BasePayload & { connectionId: string; canvasId: string }>(
  (payload) => {
    useConnectionStore().removeConnectionFromEvent(payload.connectionId)
  },
  { toastMessage: '連線已刪除' }
)

const handleOutputStyleCreated = createUnifiedHandler<BasePayload & { outputStyle?: { id: string; name: string }; canvasId: string }>(
  (payload) => {
    if (payload.outputStyle) {
      useOutputStyleStore().addItemFromEvent(payload.outputStyle)
    }
  },
  { toastMessage: '輸出風格建立成功' }
)

const handleOutputStyleUpdated = createUnifiedHandler<BasePayload & { outputStyleId: string; canvasId: string }>(
  () => {
    useOutputStyleStore().loadItems()
  },
  { toastMessage: '輸出風格更新成功' }
)

const handleOutputStyleDeleted = createUnifiedHandler<BasePayload & { outputStyleId: string; deletedNoteIds?: string[]; canvasId: string }>(
  (payload) => {
    useOutputStyleStore().removeItemFromEvent(payload.outputStyleId, payload.deletedNoteIds)
  },
  { toastMessage: '輸出風格已刪除' }
)

const handleNoteCreated = createUnifiedHandler<BasePayload & { note?: OutputStyleNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useOutputStyleStore().addNoteFromEvent(payload.note)
    }
  }
)

const handleNoteUpdated = createUnifiedHandler<BasePayload & { note?: OutputStyleNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useOutputStyleStore().updateNoteFromEvent(payload.note)
    }
  }
)

const handleNoteDeleted = createUnifiedHandler<BasePayload & { noteId: string; canvasId: string }>(
  (payload) => {
    useOutputStyleStore().removeNoteFromEvent(payload.noteId)
  }
)

const handleSkillNoteCreated = createUnifiedHandler<BasePayload & { note?: SkillNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useSkillStore().addNoteFromEvent(payload.note)
    }
  }
)

const handleSkillNoteUpdated = createUnifiedHandler<BasePayload & { note?: SkillNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useSkillStore().updateNoteFromEvent(payload.note)
    }
  }
)

const handleSkillNoteDeleted = createUnifiedHandler<BasePayload & { noteId: string; canvasId: string }>(
  (payload) => {
    useSkillStore().removeNoteFromEvent(payload.noteId)
  }
)

const handleSkillDeleted = createUnifiedHandler<BasePayload & { skillId: string; deletedNoteIds?: string[]; canvasId: string }>(
  (payload) => {
    useSkillStore().removeItemFromEvent(payload.skillId, payload.deletedNoteIds)
  },
  { toastMessage: 'Skill 已刪除' }
)

const handleRepositoryCreated = createUnifiedHandler<BasePayload & { repository?: { id: string; name: string; path: string; currentBranch?: string }; canvasId: string }>(
  (payload) => {
    if (payload.repository) {
      useRepositoryStore().addItemFromEvent(payload.repository)
    }
  },
  { toastMessage: 'Repository 建立成功' }
)

const handleRepositoryDeleted = createUnifiedHandler<BasePayload & { repositoryId: string; deletedNoteIds?: string[]; canvasId: string }>(
  (payload) => {
    useRepositoryStore().removeItemFromEvent(payload.repositoryId, payload.deletedNoteIds)
  },
  { toastMessage: 'Repository 已刪除' }
)

const handleRepositoryBranchChanged = createUnifiedHandler<BasePayload & { repositoryId: string; branchName: string; canvasId: string }>(
  (payload) => {
    const repositoryStore = useRepositoryStore()
    const repository = repositoryStore.availableItems.find((item) => item.id === payload.repositoryId)
    if (repository) {
      repository.currentBranch = payload.branchName
    }
  }
)

const handleRepositoryNoteCreated = createUnifiedHandler<BasePayload & { note?: RepositoryNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useRepositoryStore().addNoteFromEvent(payload.note)
    }
  }
)

const handleRepositoryNoteUpdated = createUnifiedHandler<BasePayload & { note?: RepositoryNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useRepositoryStore().updateNoteFromEvent(payload.note)
    }
  }
)

const handleRepositoryNoteDeleted = createUnifiedHandler<BasePayload & { noteId: string; canvasId: string }>(
  (payload) => {
    useRepositoryStore().removeNoteFromEvent(payload.noteId)
  }
)

const handleSubAgentCreated = createUnifiedHandler<BasePayload & { subAgent?: { id: string; name: string }; canvasId: string }>(
  (payload) => {
    if (payload.subAgent) {
      useSubAgentStore().addItemFromEvent(payload.subAgent)
    }
  },
  { toastMessage: 'SubAgent 建立成功' }
)

const handleSubAgentUpdated = createUnifiedHandler<BasePayload & { subAgentId: string; canvasId: string }>(
  () => {
    useSubAgentStore().loadItems()
  },
  { toastMessage: 'SubAgent 更新成功' }
)

const handleSubAgentDeleted = createUnifiedHandler<BasePayload & { subAgentId: string; deletedNoteIds?: string[]; canvasId: string }>(
  (payload) => {
    useSubAgentStore().removeItemFromEvent(payload.subAgentId, payload.deletedNoteIds)
  },
  { toastMessage: 'SubAgent 已刪除' }
)

const handleSubAgentNoteCreated = createUnifiedHandler<BasePayload & { note?: SubAgentNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useSubAgentStore().addNoteFromEvent(payload.note)
    }
  }
)

const handleSubAgentNoteUpdated = createUnifiedHandler<BasePayload & { note?: SubAgentNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useSubAgentStore().updateNoteFromEvent(payload.note)
    }
  }
)

const handleSubAgentNoteDeleted = createUnifiedHandler<BasePayload & { noteId: string; canvasId: string }>(
  (payload) => {
    useSubAgentStore().removeNoteFromEvent(payload.noteId)
  }
)

const handleCommandCreated = createUnifiedHandler<BasePayload & { command?: { id: string; name: string }; canvasId: string }>(
  (payload) => {
    if (payload.command) {
      useCommandStore().addItemFromEvent(payload.command)
    }
  },
  { toastMessage: 'Command 建立成功' }
)

const handleCommandUpdated = createUnifiedHandler<BasePayload & { commandId: string; canvasId: string }>(
  () => {
    useCommandStore().loadItems()
  },
  { toastMessage: 'Command 更新成功' }
)

const handleCommandDeleted = createUnifiedHandler<BasePayload & { commandId: string; deletedNoteIds?: string[]; canvasId: string }>(
  (payload) => {
    useCommandStore().removeItemFromEvent(payload.commandId, payload.deletedNoteIds)
  },
  { toastMessage: 'Command 已刪除' }
)

const handleCommandNoteCreated = createUnifiedHandler<BasePayload & { note?: CommandNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useCommandStore().addNoteFromEvent(payload.note)
    }
  }
)

const handleCommandNoteUpdated = createUnifiedHandler<BasePayload & { note?: CommandNote; canvasId: string }>(
  (payload) => {
    if (payload.note) {
      useCommandStore().updateNoteFromEvent(payload.note)
    }
  }
)

const handleCommandNoteDeleted = createUnifiedHandler<BasePayload & { noteId: string; canvasId: string }>(
  (payload) => {
    useCommandStore().removeNoteFromEvent(payload.noteId)
  }
)

const handleCanvasCreated = createUnifiedHandler<BasePayload & { canvas?: Canvas }>(
  (payload) => {
    if (payload.canvas) {
      useCanvasStore().addCanvasFromEvent(payload.canvas)
    }
  },
  { toastMessage: 'Canvas 建立成功', skipCanvasCheck: true }
)

const handleCanvasRenamed = createUnifiedHandler<BasePayload & { canvasId: string; newName: string }>(
  (payload) => {
    useCanvasStore().renameCanvasFromEvent(payload.canvasId, payload.newName)
  },
  { toastMessage: 'Canvas 重命名成功', skipCanvasCheck: true }
)

const handleCanvasDeleted = createUnifiedHandler<BasePayload & { canvasId: string }>(
  (payload) => {
    useCanvasStore().removeCanvasFromEvent(payload.canvasId)
  },
  { skipCanvasCheck: true }
)

const handleCanvasReordered = createUnifiedHandler<BasePayload & { canvasIds: string[] }>(
  (payload) => {
    useCanvasStore().reorderCanvasesFromEvent(payload.canvasIds)
  },
  { skipCanvasCheck: true }
)

const addCreatedItems = <T>(
  items: T[] | undefined,
  addFn: (item: T) => void
): void => {
  if (items) {
    for (const item of items) {
      addFn(item)
    }
  }
}

const handleCanvasPasted = createUnifiedHandler<BasePayload & {
  canvasId: string
  createdPods?: Pod[]
  createdOutputStyleNotes?: OutputStyleNote[]
  createdSkillNotes?: SkillNote[]
  createdRepositoryNotes?: RepositoryNote[]
  createdSubAgentNotes?: SubAgentNote[]
  createdCommandNotes?: CommandNote[]
  createdConnections?: Connection[]
}>(
  (payload) => {
    const podStore = usePodStore()
    const connectionStore = useConnectionStore()
    const outputStyleStore = useOutputStyleStore()
    const skillStore = useSkillStore()
    const repositoryStore = useRepositoryStore()
    const subAgentStore = useSubAgentStore()
    const commandStore = useCommandStore()

    addCreatedItems(payload.createdPods, pod => podStore.addPod(pod))
    addCreatedItems(payload.createdOutputStyleNotes, note => outputStyleStore.addNoteFromEvent(note))
    addCreatedItems(payload.createdSkillNotes, note => skillStore.addNoteFromEvent(note))
    addCreatedItems(payload.createdRepositoryNotes, note => repositoryStore.addNoteFromEvent(note))
    addCreatedItems(payload.createdSubAgentNotes, note => subAgentStore.addNoteFromEvent(note))
    addCreatedItems(payload.createdCommandNotes, note => commandStore.addNoteFromEvent(note))
    addCreatedItems(payload.createdConnections, connection => connectionStore.addConnectionFromEvent(connection))
  },
  { toastMessage: '貼上成功' }
)

const handleWorkflowClearResult = createUnifiedHandler<BasePayload & { canvasId: string; clearedPodIds?: string[] }>(
  (payload) => {
    if (payload.clearedPodIds) {
      const chatStore = useChatStore()
      chatStore.clearMessagesByPodIds(payload.clearedPodIds)

      const podStore = usePodStore()
      podStore.clearPodOutputsByIds(payload.clearedPodIds)
    }
  },
  { toastMessage: '已清空訊息' }
)

const handlePodChatUserMessage = (payload: { podId: string; messageId: string; content: string; timestamp: string }): void => {
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
  { event: WebSocketResponseEvents.POD_CREATED, handler: handlePodCreated },
  { event: WebSocketResponseEvents.POD_MOVED, handler: handlePodMoved },
  { event: WebSocketResponseEvents.POD_RENAMED, handler: handlePodRenamed },
  { event: WebSocketResponseEvents.POD_MODEL_SET, handler: handlePodModelSet },
  { event: WebSocketResponseEvents.POD_SCHEDULE_SET, handler: handlePodScheduleSet },
  { event: WebSocketResponseEvents.POD_DELETED, handler: handlePodDeleted },
  { event: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND, handler: handlePodOutputStyleBound },
  { event: WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND, handler: handlePodOutputStyleUnbound },
  { event: WebSocketResponseEvents.POD_SKILL_BOUND, handler: handlePodSkillBound },
  { event: WebSocketResponseEvents.POD_REPOSITORY_BOUND, handler: handlePodRepositoryBound },
  { event: WebSocketResponseEvents.POD_REPOSITORY_UNBOUND, handler: handlePodRepositoryUnbound },
  { event: WebSocketResponseEvents.POD_SUBAGENT_BOUND, handler: handlePodSubAgentBound },
  { event: WebSocketResponseEvents.POD_COMMAND_BOUND, handler: handlePodCommandBound },
  { event: WebSocketResponseEvents.POD_COMMAND_UNBOUND, handler: handlePodCommandUnbound },
  { event: WebSocketResponseEvents.POD_AUTO_CLEAR_SET, handler: handlePodAutoClearSet },
  { event: WebSocketResponseEvents.CONNECTION_CREATED, handler: handleConnectionCreated },
  { event: WebSocketResponseEvents.CONNECTION_UPDATED, handler: handleConnectionUpdated },
  { event: WebSocketResponseEvents.CONNECTION_DELETED, handler: handleConnectionDeleted },
  { event: WebSocketResponseEvents.OUTPUT_STYLE_CREATED, handler: handleOutputStyleCreated },
  { event: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED, handler: handleOutputStyleUpdated },
  { event: WebSocketResponseEvents.OUTPUT_STYLE_DELETED, handler: handleOutputStyleDeleted },
  { event: WebSocketResponseEvents.NOTE_CREATED, handler: handleNoteCreated },
  { event: WebSocketResponseEvents.NOTE_UPDATED, handler: handleNoteUpdated },
  { event: WebSocketResponseEvents.NOTE_DELETED, handler: handleNoteDeleted },
  { event: WebSocketResponseEvents.SKILL_NOTE_CREATED, handler: handleSkillNoteCreated },
  { event: WebSocketResponseEvents.SKILL_NOTE_UPDATED, handler: handleSkillNoteUpdated },
  { event: WebSocketResponseEvents.SKILL_NOTE_DELETED, handler: handleSkillNoteDeleted },
  { event: WebSocketResponseEvents.SKILL_DELETED, handler: handleSkillDeleted },
  { event: WebSocketResponseEvents.REPOSITORY_CREATED, handler: handleRepositoryCreated },
  { event: WebSocketResponseEvents.REPOSITORY_DELETED, handler: handleRepositoryDeleted },
  { event: WebSocketResponseEvents.REPOSITORY_BRANCH_CHECKED_OUT, handler: handleRepositoryBranchChanged },
  { event: WebSocketResponseEvents.REPOSITORY_NOTE_CREATED, handler: handleRepositoryNoteCreated },
  { event: WebSocketResponseEvents.REPOSITORY_NOTE_UPDATED, handler: handleRepositoryNoteUpdated },
  { event: WebSocketResponseEvents.REPOSITORY_NOTE_DELETED, handler: handleRepositoryNoteDeleted },
  { event: WebSocketResponseEvents.SUBAGENT_CREATED, handler: handleSubAgentCreated },
  { event: WebSocketResponseEvents.SUBAGENT_UPDATED, handler: handleSubAgentUpdated },
  { event: WebSocketResponseEvents.SUBAGENT_DELETED, handler: handleSubAgentDeleted },
  { event: WebSocketResponseEvents.SUBAGENT_NOTE_CREATED, handler: handleSubAgentNoteCreated },
  { event: WebSocketResponseEvents.SUBAGENT_NOTE_UPDATED, handler: handleSubAgentNoteUpdated },
  { event: WebSocketResponseEvents.SUBAGENT_NOTE_DELETED, handler: handleSubAgentNoteDeleted },
  { event: WebSocketResponseEvents.COMMAND_CREATED, handler: handleCommandCreated },
  { event: WebSocketResponseEvents.COMMAND_UPDATED, handler: handleCommandUpdated },
  { event: WebSocketResponseEvents.COMMAND_DELETED, handler: handleCommandDeleted },
  { event: WebSocketResponseEvents.COMMAND_NOTE_CREATED, handler: handleCommandNoteCreated },
  { event: WebSocketResponseEvents.COMMAND_NOTE_UPDATED, handler: handleCommandNoteUpdated },
  { event: WebSocketResponseEvents.COMMAND_NOTE_DELETED, handler: handleCommandNoteDeleted },
  { event: WebSocketResponseEvents.CANVAS_CREATED, handler: handleCanvasCreated },
  { event: WebSocketResponseEvents.CANVAS_RENAMED, handler: handleCanvasRenamed },
  { event: WebSocketResponseEvents.CANVAS_DELETED, handler: handleCanvasDeleted },
  { event: WebSocketResponseEvents.CANVAS_REORDERED, handler: handleCanvasReordered },
  { event: WebSocketResponseEvents.CANVAS_PASTE_RESULT, handler: handleCanvasPasted },
  { event: WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT, handler: handleWorkflowClearResult },
] as const

export function registerUnifiedListeners(): void {
  if (registered) return
  registered = true

  for (const { event, handler } of listeners) {
    websocketClient.on(event, handler as (payload: unknown) => void)
  }

  websocketClient.on('pod:chat:user-message', handlePodChatUserMessage as (payload: unknown) => void)
}

export function unregisterUnifiedListeners(): void {
  if (!registered) return
  registered = false

  for (const { event, handler } of listeners) {
    websocketClient.off(event, handler as (payload: unknown) => void)
  }

  websocketClient.off('pod:chat:user-message', handlePodChatUserMessage as (payload: unknown) => void)
}

export const useUnifiedEventListeners = (): {
  registerUnifiedListeners: () => void
  unregisterUnifiedListeners: () => void
} => {
  return {
    registerUnifiedListeners,
    unregisterUnifiedListeners,
  }
}
