import type {Pod, PodStatus} from '../pod'
import type {OutputStyleNote} from '@/types'
import type {SkillNote} from '@/types'
import type {Repository, RepositoryNote} from '@/types'
import type {SubAgentNote} from '@/types'
import type {CommandNote} from '@/types'
import type {AnchorPosition} from '@/types'

export interface ConnectionReadyPayload {
    socketId: string
}

export interface PodCreatedPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface PodListResultPayload {
    requestId: string
    success: boolean
    pods?: Pod[]
    error?: string
}

export interface PodMovedPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface PodRenamedPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface PodModelSetPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface PodScheduleSetPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface PodDeletedPayload {
    requestId: string
    success: boolean
    podId?: string
    error?: string
}

export interface PodChatMessagePayload {
    podId: string
    messageId: string
    content: string
    isPartial: boolean
    role?: 'user' | 'assistant'
}

export interface PodChatToolUsePayload {
    podId: string
    messageId: string
    toolUseId: string
    toolName: string
    input: Record<string, unknown>
}

export interface PodChatToolResultPayload {
    podId: string
    messageId: string
    toolUseId: string
    toolName: string
    output: string
}

export interface PodChatCompletePayload {
    podId: string
    messageId: string
    fullContent: string
}

export interface PodErrorPayload {
    requestId?: string
    podId?: string
    error: string
    code: string
}

export interface PodStatusChangedPayload {
    podId: string
    status: PodStatus
    previousStatus: PodStatus
}

export interface PersistedMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    subMessages?: Array<{
        id: string
        content: string
        toolUse?: Array<{
            toolUseId: string
            toolName: string
            input: Record<string, unknown>
            output?: string
            status: string
        }>
    }>
}

export interface PodChatHistoryResultPayload {
    requestId: string
    success: boolean
    messages?: PersistedMessage[]
    error?: string
}

export interface OutputStyleCreatedPayload {
    requestId: string
    success: boolean
    outputStyle?: { id: string; name: string }
    error?: string
}

export interface OutputStyleUpdatedPayload {
    requestId: string
    success: boolean
    outputStyle?: { id: string; name: string }
    error?: string
}

export interface OutputStyleReadResultPayload {
    requestId: string
    success: boolean
    outputStyle?: { id: string; name: string; content: string }
    error?: string
}

export interface NoteCreatedPayload {
    requestId: string
    success: boolean
    note?: OutputStyleNote
    error?: string
}

export interface ConnectionCreatedPayload {
    requestId: string
    success: boolean
    connection?: {
        id: string
        sourcePodId?: string
        sourceAnchor: AnchorPosition
        targetPodId: string
        targetAnchor: AnchorPosition
        createdAt: string
        autoTrigger?: boolean
    }
    error?: string
}

export interface ConnectionListResultPayload {
    requestId: string
    success: boolean
    connections?: Array<{
        id: string
        sourcePodId?: string
        sourceAnchor: AnchorPosition
        targetPodId: string
        targetAnchor: AnchorPosition
        createdAt: string
        autoTrigger?: boolean
    }>
    error?: string
}

export interface ConnectionDeletedPayload {
    requestId: string
    success: boolean
    connectionId?: string
    error?: string
}

export interface WorkflowAutoTriggeredPayload {
    connectionId: string
    sourcePodId: string
    targetPodId: string
    transferredContent: string
    isSummarized: boolean
}

export interface WorkflowCompletePayload {
    requestId: string
    connectionId: string
    targetPodId: string
    success: boolean
    error?: string
}

export interface WorkflowGetDownstreamPodsResultPayload {
    requestId: string
    success: boolean
    pods?: Array<{ id: string; name: string }>
    error?: string
}

export interface WorkflowClearResultPayload {
    requestId: string
    success: boolean
    clearedPodIds?: string[]
    clearedPodNames?: string[]
    error?: string
}

export interface PasteError {
    type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote'
    originalId: string
    error: string
}

export interface CanvasPasteResultPayload {
    requestId: string
    success: boolean
    createdPods: Pod[]
    createdOutputStyleNotes: OutputStyleNote[]
    createdSkillNotes: SkillNote[]
    createdRepositoryNotes: RepositoryNote[]
    createdSubAgentNotes: SubAgentNote[]
    createdCommandNotes: CommandNote[]
    createdConnections: Array<{
        id: string
        sourcePodId: string
        sourceAnchor: AnchorPosition
        targetPodId: string
        targetAnchor: AnchorPosition
        createdAt: string
        autoTrigger?: boolean
    }>
    podIdMapping: Record<string, string>
    errors: PasteError[]
    error?: string
}

export interface RepositoryCreatedPayload {
    requestId: string
    success: boolean
    repository?: Repository
    error?: string
}

export interface RepositoryGitCloneProgressPayload {
    requestId: string
    progress: number
    message: string
}

export interface RepositoryGitCloneResultPayload {
    requestId: string
    success: boolean
    repository?: { id: string; name: string }
    error?: string
}

export interface PodMessagesClearedPayload {
    podId: string
}

export interface PodAutoClearSetPayload {
    requestId: string
    success: boolean
    pod?: Pod
    error?: string
}

export interface WorkflowAutoClearedPayload {
    sourcePodId: string
    clearedPodIds: string[]
    clearedPodNames: string[]
}

export interface SubAgentCreatedPayload {
    requestId: string
    success: boolean
    subAgent?: { id: string; name: string }
    error?: string
}

export interface SubAgentUpdatedPayload {
    requestId: string
    success: boolean
    subAgent?: { id: string; name: string }
    error?: string
}

export interface SubAgentReadResultPayload {
    requestId: string
    success: boolean
    subAgent?: { id: string; name: string; content: string }
    error?: string
}

export interface CommandCreatedPayload {
    requestId: string
    success: boolean
    command?: { id: string; name: string }
    error?: string
}

export interface CommandUpdatedPayload {
    requestId: string
    success: boolean
    command?: { id: string; name: string }
    error?: string
}

export interface CommandReadResultPayload {
    requestId: string
    success: boolean
    command?: { id: string; name: string; content: string }
    error?: string
}

export interface CommandNoteCreatedPayload {
    requestId: string
    success: boolean
    note?: CommandNote
    error?: string
}

export interface ScheduleFiredPayload {
    podId: string
    timestamp: string
}

export interface HeartbeatPingPayload {
    timestamp: number
}

export interface RepositoryCheckGitResultPayload {
    requestId: string
    success: boolean
    isGit: boolean
    error?: string
}

export interface RepositoryWorktreeCreatedPayload {
    requestId: string
    success: boolean
    repository?: Repository
    error?: string
}
