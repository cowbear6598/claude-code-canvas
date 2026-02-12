import { vi } from 'vitest';
import { workflowQueueService } from '../../src/services/workflow/index.js';
import { workflowExecutionService } from '../../src/services/workflow/index.js';
import type { Pod, Connection, Message, TriggerMode } from '../../src/types/index.js';
import type { TriggerStrategy } from '../../src/services/workflow/types.js';

// 常用測試 ID
export const TEST_IDS = {
  canvasId: 'canvas-1',
  sourcePodId: 'source-pod',
  targetPodId: 'target-pod',
  connectionId: 'conn-1',
} as const;

// Pod Factory
export function createMockPod(overrides?: Partial<Pod>): Pod {
  return {
    id: 'test-pod',
    name: 'Test Pod',
    model: 'sonnet',
    claudeSessionId: null,
    repositoryId: null,
    workspacePath: '/test/workspace',
    commandId: null,
    outputStyleId: null,
    status: 'idle',
    color: 'blue',
    x: 0,
    y: 0,
    rotation: 0,
    gitUrl: null,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    needsForkSession: false,
    autoClear: false,
    skillIds: [],
    subAgentIds: [],
    ...overrides,
  } as Pod;
}

// Connection Factory
export function createMockConnection(overrides?: Partial<Connection>): Connection {
  return {
    id: 'conn-1',
    sourcePodId: 'source-pod',
    sourceAnchor: 'right',
    targetPodId: 'target-pod',
    targetAnchor: 'left',
    triggerMode: 'auto' as TriggerMode,
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    createdAt: new Date(),
    ...overrides,
  } as Connection;
}

// Message Factory
export function createMockMessages(podId: string = 'source-pod'): Message[] {
  return [
    {
      id: 'msg-1',
      podId,
      role: 'user' as const,
      content: 'Test user message',
      createdAt: new Date(),
      toolUse: null,
    },
    {
      id: 'msg-2',
      podId,
      role: 'assistant' as const,
      content: 'Test assistant response',
      createdAt: new Date(),
      toolUse: null,
    },
  ] as Message[];
}

// Strategy Factory
export function createMockStrategy(mode: TriggerMode, overrides?: Partial<TriggerStrategy>): TriggerStrategy {
  const base: Partial<TriggerStrategy> = {
    mode,
    decide: vi.fn().mockResolvedValue([]),
    onTrigger: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
    onQueued: vi.fn(),
    onQueueProcessed: vi.fn(),
    ...overrides,
  };

  if (mode === 'direct' && !overrides?.collectSources) {
    base.collectSources = vi.fn();
  }

  return base as TriggerStrategy;
}

// Queue 初始化 Helper
export function initializeQueueService(strategies: {
  auto: TriggerStrategy;
  direct: TriggerStrategy;
  'ai-decide': TriggerStrategy;
}) {
  workflowQueueService.init({
    executionService: workflowExecutionService,
    strategies,
  });
}

// Queue 清空 Helper
export function clearAllQueues(targetPodIds: string[]) {
  targetPodIds.forEach((podId) => workflowQueueService.clearQueue(podId));
}
