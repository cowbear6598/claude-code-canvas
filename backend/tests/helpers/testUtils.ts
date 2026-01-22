// Test Utilities
// Helper functions and mocks for testing

import { Pod, PodColor, PodTypeName, PodStatus, Message, MessageRole } from '../../src/types/index.js';
import { Request, Response } from 'express';

/**
 * Creates a mock Pod object with default or custom values
 */
export function createMockPod(overrides?: Partial<Pod>): Pod {
  const defaultPod: Pod = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Pod',
    type: 'Code Assistant',
    color: 'blue',
    status: 'idle',
    workspacePath: '/workspaces/pod-123e4567-e89b-12d3-a456-426614174000',
    gitUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActiveAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  return { ...defaultPod, ...overrides };
}

/**
 * Creates multiple mock Pods for testing list operations
 */
export function createMockPods(count: number): Pod[] {
  const colors: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green'];
  const types: PodTypeName[] = [
    'Code Assistant',
    'Chat Companion',
    'Creative Writer',
    'Data Analyst',
    'General AI',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `pod-${i}`,
    name: `Test Pod ${i}`,
    type: types[i % types.length],
    color: colors[i % colors.length],
    status: 'idle' as PodStatus,
    workspacePath: `/workspaces/pod-${i}`,
    gitUrl: null,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  }));
}

/**
 * Creates a mock Message object
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  const defaultMessage: Message = {
    id: 'msg-123',
    podId: '123e4567-e89b-12d3-a456-426614174000',
    role: 'user',
    content: 'Test message',
    toolUse: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  return { ...defaultMessage, ...overrides };
}

/**
 * Creates a mock Express Request object
 */
export function createMockRequest(options?: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Partial<Request> {
  return {
    body: options?.body || {},
    params: options?.params || {},
    query: options?.query || {},
  };
}

/**
 * Creates a mock Express Response object with jest-like spies
 */
export function createMockResponse(): Partial<Response> & {
  status: (code: number) => Partial<Response>;
  json: (data: unknown) => Partial<Response>;
  send: (data: unknown) => Partial<Response>;
  statusCode?: number;
  jsonData?: unknown;
  sendData?: unknown;
} {
  const res: ReturnType<typeof createMockResponse> = {
    statusCode: 200,
    jsonData: undefined,
    sendData: undefined,
    status: function (code: number) {
      res.statusCode = code;
      return res as Partial<Response>;
    },
    json: function (data: unknown) {
      res.jsonData = data;
      return res as Partial<Response>;
    },
    send: function (data: unknown) {
      sendData = data;
      return res as Partial<Response>;
    },
  };

  return res;
}

/**
 * Mock ClaudeSDKClient for testing
 */
export class MockClaudeSDKClient {
  private mockMessages: string[] = [];

  constructor(private workspacePath: string) {}

  async query(prompt: string): Promise<AsyncIterable<{ type: string; content?: string }>> {
    this.mockMessages.push(prompt);

    // Return a simple async iterable that yields mock responses
    const messages = [
      { type: 'text', content: 'Mock response to: ' + prompt },
      { type: 'complete' },
    ];

    return {
      [Symbol.asyncIterator]: async function* () {
        for (const msg of messages) {
          yield msg;
        }
      },
    };
  }

  getMessages(): string[] {
    return this.mockMessages;
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }
}

/**
 * Utility to wait for async operations in tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a valid UUID v4 for testing
 */
export function generateTestUUID(): string {
  return '123e4567-e89b-12d3-a456-426614174000';
}
