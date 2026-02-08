import type { Canvas } from '@/types/canvas'
import type { Pod, Schedule, PodColor, ModelType, PodStatus, FrequencyType } from '@/types/pod'
import type { Connection, TriggerMode, ConnectionStatus, AnchorPosition } from '@/types/connection'
import type { Message, MessageRole, ToolUseInfo, ToolUseStatus } from '@/types/chat'
import type { BaseNote } from '@/types/note'
import type { OutputStyleNote } from '@/types/outputStyle'
import type { SkillNote } from '@/types/skill'
import type { RepositoryNote } from '@/types/repository'
import type { SubAgentNote } from '@/types/subAgent'
import type { CommandNote } from '@/types/command'

// 計數器
let canvasCounter = 0
let podCounter = 0
let connectionCounter = 0
let messageCounter = 0
let noteCounter = 0
let scheduleCounter = 0

/**
 * 建立 Mock Canvas
 */
export function createMockCanvas(overrides?: Partial<Canvas>): Canvas {
  return {
    id: `canvas-${++canvasCounter}`,
    name: `Canvas ${canvasCounter}`,
    createdAt: new Date().toISOString(),
    sortIndex: canvasCounter,
    ...overrides,
  }
}

/**
 * 建立 Mock Schedule
 */
export function createMockSchedule(overrides?: Partial<Schedule>): Schedule {
  scheduleCounter++
  return {
    frequency: 'every-day' as FrequencyType,
    second: 0,
    intervalMinute: 1,
    intervalHour: 1,
    hour: 9,
    minute: 0,
    weekdays: [1, 2, 3, 4, 5],
    enabled: true,
    lastTriggeredAt: null,
    ...overrides,
  }
}

/**
 * 建立 Mock Pod
 */
export function createMockPod(overrides?: Partial<Pod>): Pod {
  const id = `pod-${++podCounter}`
  return {
    id,
    name: `Pod ${podCounter}`,
    x: 100 * podCounter,
    y: 100 * podCounter,
    color: 'blue' as PodColor,
    output: [],
    rotation: 0,
    status: 'idle' as PodStatus,
    model: 'opus' as ModelType,
    outputStyleId: null,
    skillIds: [],
    subAgentIds: [],
    repositoryId: null,
    autoClear: false,
    commandId: null,
    schedule: null,
    ...overrides,
  }
}

/**
 * 建立 Mock Connection
 */
export function createMockConnection(overrides?: Partial<Connection>): Connection {
  return {
    id: `connection-${++connectionCounter}`,
    sourcePodId: `pod-${connectionCounter}`,
    sourceAnchor: 'bottom' as AnchorPosition,
    targetPodId: `pod-${connectionCounter + 1}`,
    targetAnchor: 'top' as AnchorPosition,
    triggerMode: 'auto' as TriggerMode,
    status: 'idle' as ConnectionStatus,
    createdAt: new Date(),
    ...overrides,
  }
}

/**
 * 建立 Mock Message
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: `message-${++messageCounter}`,
    role: 'user' as MessageRole,
    content: `Message content ${messageCounter}`,
    isPartial: false,
    timestamp: new Date().toISOString(),
    isSummarized: false,
    ...overrides,
  }
}

/**
 * 建立 Mock Assistant Message (含 toolUse)
 */
export function createMockAssistantMessage(overrides?: Partial<Message>): Message {
  const toolUse: ToolUseInfo = {
    toolUseId: `tool-${messageCounter + 1}`,
    toolName: 'Bash',
    input: { command: 'echo "test"' },
    output: 'test',
    status: 'completed' as ToolUseStatus,
  }

  return createMockMessage({
    role: 'assistant' as MessageRole,
    content: 'Assistant response',
    toolUse: [toolUse],
    ...overrides,
  })
}

/**
 * 建立 Mock Note (依類型)
 */
export function createMockNote(
  type: 'outputStyle' | 'skill' | 'repository' | 'subAgent' | 'command',
  overrides?: Partial<BaseNote>
): OutputStyleNote | SkillNote | RepositoryNote | SubAgentNote | CommandNote {
  const baseNote: BaseNote = {
    id: `note-${++noteCounter}`,
    name: `Note ${noteCounter}`,
    x: 200 * noteCounter,
    y: 200 * noteCounter,
    boundToPodId: null,
    originalPosition: null,
    ...overrides,
  }

  switch (type) {
    case 'outputStyle':
      return {
        ...baseNote,
        outputStyleId: `output-style-${noteCounter}`,
      } as OutputStyleNote

    case 'skill':
      return {
        ...baseNote,
        skillId: `skill-${noteCounter}`,
      } as SkillNote

    case 'repository':
      return {
        ...baseNote,
        repositoryId: `repository-${noteCounter}`,
      } as RepositoryNote

    case 'subAgent':
      return {
        ...baseNote,
        subAgentId: `sub-agent-${noteCounter}`,
      } as SubAgentNote

    case 'command':
      return {
        ...baseNote,
        commandId: `command-${noteCounter}`,
      } as CommandNote
  }
}
