// Claude SDK Mock
// 完全 Mock @anthropic-ai/claude-agent-sdk 模組
// 支援設定回應內容、模擬 streaming events

import { vi } from 'vitest';

export type ClaudeEventType = 'text' | 'tool_use' | 'tool_result' | 'complete' | 'error';

export interface ClaudeEvent {
  type: ClaudeEventType;
  data?: unknown;
}

export interface MockTextEvent {
  type: 'text';
  content: string;
  isPartial?: boolean;
}

export interface MockToolUseEvent {
  type: 'tool_use';
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
}

export interface MockToolResultEvent {
  type: 'tool_result';
  toolUseId: string;
  output: string;
}

export interface MockCompleteEvent {
  type: 'complete';
  fullContent: string;
}

export interface MockErrorEvent {
  type: 'error';
  error: string;
}

export type MockClaudeEvent =
  | MockTextEvent
  | MockToolUseEvent
  | MockToolResultEvent
  | MockCompleteEvent
  | MockErrorEvent;

// Mock 設定
let mockEvents: MockClaudeEvent[] = [];
let mockDelay: number = 0;

/**
 * 設定 Mock 回應
 */
export function setMockResponse(events: MockClaudeEvent[], delay: number = 0): void {
  mockEvents = events;
  mockDelay = delay;
}

/**
 * 重置 Mock 狀態
 */
export function resetMock(): void {
  mockEvents = [];
  mockDelay = 0;
}

/**
 * 產生預設的文字回應
 */
export function createDefaultTextResponse(content: string): MockClaudeEvent[] {
  return [
    { type: 'text', content, isPartial: false },
    { type: 'complete', fullContent: content },
  ];
}

/**
 * 產生 Streaming 文字回應
 */
export function createStreamingTextResponse(chunks: string[]): MockClaudeEvent[] {
  const events: MockClaudeEvent[] = chunks.map((chunk) => ({
    type: 'text',
    content: chunk,
    isPartial: true,
  }));

  const fullContent = chunks.join('');
  events.push({ type: 'complete', fullContent });

  return events;
}

/**
 * 產生包含工具使用的回應
 */
export function createToolUseResponse(
  toolName: string,
  input: Record<string, unknown>,
  output: string,
  finalContent: string
): MockClaudeEvent[] {
  return [
    {
      type: 'tool_use',
      toolName,
      toolUseId: `tool-${Date.now()}`,
      input,
    },
    {
      type: 'tool_result',
      toolUseId: `tool-${Date.now()}`,
      output,
    },
    { type: 'text', content: finalContent, isPartial: false },
    { type: 'complete', fullContent: finalContent },
  ];
}

/**
 * 產生錯誤回應
 */
export function createErrorResponse(error: string): MockClaudeEvent[] {
  return [{ type: 'error', error }];
}

/**
 * Mock 的 query 函數
 * 模擬 Claude Agent SDK 的 query 行為
 */
async function* mockQuery(): AsyncGenerator<MockClaudeEvent> {
  // 如果設定了延遲，先等待
  if (mockDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, mockDelay));
  }

  // 依序產生設定的事件
  for (const event of mockEvents) {
    yield event;
    // 在事件之間加入小延遲，模擬真實 streaming
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// Mock @anthropic-ai/claude-agent-sdk 模組
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(() => mockQuery()),
}));
