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
    deletedNoteIds?: {
        note?: string[]
        skillNote?: string[]
        repositoryNote?: string[]
        commandNote?: string[]
        subAgentNote?: string[]
    }
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

export interface PodChatAbortedPayload {
    podId: string
    messageId: string
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
        triggerMode?: 'auto' | 'ai-decide' | 'direct'
        decideStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'error'
        connectionStatus?: 'idle' | 'active' | 'queued' | 'waiting' | 'ai-deciding' | 'ai-approved' | 'ai-rejected' | 'ai-error'
        decideReason?: string | null
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
        triggerMode?: 'auto' | 'ai-decide' | 'direct'
        decideStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'error'
        connectionStatus?: 'idle' | 'active' | 'queued' | 'waiting' | 'ai-deciding' | 'ai-approved' | 'ai-rejected' | 'ai-error'
        decideReason?: string | null
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
    triggerMode?: 'auto' | 'ai-decide' | 'direct'
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
        triggerMode?: 'auto' | 'ai-decide' | 'direct'
        decideStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'error'
        decideReason?: string | null
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

export interface RepositoryLocalBranchesResultPayload {
    requestId: string
    success: boolean
    branches?: string[]
    currentBranch?: string
    worktreeBranches?: string[]
    error?: string
}

export interface RepositoryDirtyCheckResultPayload {
    requestId: string
    success: boolean
    isDirty?: boolean
    error?: string
}

export interface RepositoryCheckoutBranchProgressPayload {
    requestId: string
    progress: number
    message: string
    branchName: string
}

export interface RepositoryBranchCheckedOutPayload {
    requestId: string
    success: boolean
    repositoryId?: string
    branchName?: string
    action?: 'switched' | 'fetched' | 'created'
    error?: string
}

export interface RepositoryBranchDeletedPayload {
    requestId: string
    success: boolean
    branchName?: string
    error?: string
}

export interface RepositoryPullLatestProgressPayload {
    requestId: string
    progress: number
    message: string
}

export interface RepositoryPullLatestResultPayload {
    requestId: string
    success: boolean
    repositoryId?: string
    error?: string
}

export interface GroupCreatedPayload {
    requestId: string
    success: boolean
    group?: { id: string; name: string; type: 'command' | 'outputStyle' | 'subAgent' }
    error?: string
}

export interface GroupListResultPayload {
    requestId: string
    success: boolean
    groups?: Array<{ id: string; name: string; type: 'command' | 'outputStyle' | 'subAgent' }>
    error?: string
}

export interface GroupDeletedPayload {
    requestId: string
    success: boolean
    groupId?: string
    error?: string
}

export interface MovedToGroupPayload {
    requestId: string
    success: boolean
    itemId?: string
    groupId?: string | null
    error?: string
}

export interface SkillImportedPayload {
    requestId: string
    success: boolean
    skill?: { id: string; name: string; description: string }
    isOverwrite?: boolean
    error?: string
}

export interface WorkflowAiDecidePendingPayload {
    canvasId: string
    connectionIds: string[]
    sourcePodId: string
}

export interface WorkflowAiDecideResultPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
    shouldTrigger: boolean
    reason: string
}

export interface WorkflowAiDecideErrorPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
    error: string
}

export interface WorkflowAiDecideClearPayload {
    canvasId: string
    connectionIds: string[]
}

export interface WorkflowAiDecideTriggeredPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
}

export interface WorkflowDirectTriggeredPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
    transferredContent: string
    isSummarized: boolean
}

export interface WorkflowDirectWaitingPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
}

export interface WorkflowQueuedPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
    position: number
    queueSize: number
    triggerMode: 'auto' | 'ai-decide' | 'direct'
}

export interface WorkflowQueueProcessedPayload {
    canvasId: string
    connectionId: string
    sourcePodId: string
    targetPodId: string
    remainingQueueSize: number
    triggerMode: 'auto' | 'ai-decide' | 'direct'
}

export interface CursorMovedPayload {
    connectionId: string
    x: number
    y: number
    color: string
}

export interface CursorLeftPayload {
    connectionId: string
}
