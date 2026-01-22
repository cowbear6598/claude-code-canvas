// Chat Handlers Unit Tests
// Tests for Chat WebSocket handler functions

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Socket } from 'socket.io';
import { handleChatSend } from '../../src/handlers/chatHandlers.js';
import { podStore } from '../../src/services/podStore.js';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import { socketService } from '../../src/services/socketService.js';
import { WebSocketResponseEvents } from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/services/podStore.js');
vi.mock('../../src/services/claude/queryService.js');
vi.mock('../../src/services/socketService.js');

describe('Chat Handlers', () => {
  let mockSocket: Socket;

  beforeEach(() => {
    // Create mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: vi.fn(),
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
    } as unknown as Socket;

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('handleChatSend', () => {
    it('should process chat message and emit streaming events', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Chat Companion',
        color: 'coral',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (podStore.setStatus as Mock).mockReturnValue(undefined);
      (podStore.updateLastActive as Mock).mockReturnValue(undefined);

      // Mock claudeQueryService.sendMessage to call the callback with events
      (claudeQueryService.sendMessage as Mock).mockImplementation(
        async (podId: string, message: string, callback: Function) => {
          // Simulate streaming events
          callback({ type: 'text', content: 'Hello' });
          callback({ type: 'text', content: ' world' });
          callback({
            type: 'tool_use',
            toolName: 'read_file',
            input: { path: '/test.txt' },
          });
          callback({
            type: 'tool_result',
            toolName: 'read_file',
            output: 'File content',
          });
          callback({ type: 'complete' });
        }
      );

      // Mock socketService.emitToPod
      (socketService.emitToPod as Mock).mockReturnValue(undefined);

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        message: 'Hello, Claude!',
      };

      await handleChatSend(mockSocket, payload);

      // Verify pod was checked
      expect(podStore.getById).toHaveBeenCalledWith('pod-123');

      // Verify pod status was set to busy
      expect(podStore.setStatus).toHaveBeenCalledWith('pod-123', 'busy');

      // Verify claudeQueryService.sendMessage was called
      expect(claudeQueryService.sendMessage).toHaveBeenCalledWith(
        'pod-123',
        'Hello, Claude!',
        expect.any(Function)
      );

      // Verify streaming events were emitted to pod room
      expect(socketService.emitToPod).toHaveBeenCalledWith(
        'pod-123',
        WebSocketResponseEvents.POD_CHAT_MESSAGE,
        expect.objectContaining({
          podId: 'pod-123',
          content: 'Hello',
          isPartial: true,
        })
      );

      expect(socketService.emitToPod).toHaveBeenCalledWith(
        'pod-123',
        WebSocketResponseEvents.POD_CHAT_TOOL_USE,
        expect.objectContaining({
          podId: 'pod-123',
          toolName: 'read_file',
        })
      );

      expect(socketService.emitToPod).toHaveBeenCalledWith(
        'pod-123',
        WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
        expect.objectContaining({
          podId: 'pod-123',
          toolName: 'read_file',
          output: 'File content',
        })
      );

      expect(socketService.emitToPod).toHaveBeenCalledWith(
        'pod-123',
        WebSocketResponseEvents.POD_CHAT_COMPLETE,
        expect.objectContaining({
          podId: 'pod-123',
        })
      );

      // Verify pod status was set back to idle
      expect(podStore.setStatus).toHaveBeenCalledWith('pod-123', 'idle');
      expect(podStore.updateLastActive).toHaveBeenCalledWith('pod-123');
    });

    it('should emit error when pod not found', async () => {
      (podStore.getById as Mock).mockReturnValue(null);

      const payload = {
        requestId: 'req-123',
        podId: 'non-existent',
        message: 'Hello',
      };

      await handleChatSend(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_ERROR,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('not found'),
        })
      );

      // Verify claudeQueryService was not called
      expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
    });

    it('should emit error when pod is busy', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Chat Companion',
        color: 'coral',
        status: 'busy', // Pod is busy
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        message: 'Hello',
      };

      await handleChatSend(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_ERROR,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('busy'),
        })
      );

      // Verify claudeQueryService was not called
      expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle claude query errors gracefully', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Chat Companion',
        color: 'coral',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (podStore.setStatus as Mock).mockReturnValue(undefined);

      // Mock claudeQueryService.sendMessage to throw error
      (claudeQueryService.sendMessage as Mock).mockRejectedValue(
        new Error('Claude API error')
      );

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        message: 'Hello',
      };

      await handleChatSend(mockSocket, payload);

      // Verify pod status was set to busy
      expect(podStore.setStatus).toHaveBeenCalledWith('pod-123', 'busy');

      // Verify pod status was set to error after failure
      expect(podStore.setStatus).toHaveBeenCalledWith('pod-123', 'error');

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_ERROR,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('Claude API error'),
        })
      );
    });

    it('should emit error when payload is invalid', async () => {
      const invalidPayload = {
        requestId: 'req-123',
        podId: 'pod-123',
        // Missing message
      };

      await handleChatSend(mockSocket, invalidPayload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_ERROR,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.any(String),
        })
      );

      // Verify claudeQueryService was not called
      expect(claudeQueryService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle stream error events', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Chat Companion',
        color: 'coral',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (podStore.setStatus as Mock).mockReturnValue(undefined);
      (podStore.updateLastActive as Mock).mockReturnValue(undefined);

      // Mock claudeQueryService.sendMessage to call callback with error event
      (claudeQueryService.sendMessage as Mock).mockImplementation(
        async (podId: string, message: string, callback: Function) => {
          callback({ type: 'text', content: 'Starting...' });
          callback({ type: 'error', error: 'Stream error occurred' });
        }
      );

      (socketService.emitToPod as Mock).mockReturnValue(undefined);

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        message: 'Hello',
      };

      await handleChatSend(mockSocket, payload);

      // Verify text event was emitted
      expect(socketService.emitToPod).toHaveBeenCalledWith(
        'pod-123',
        WebSocketResponseEvents.POD_CHAT_MESSAGE,
        expect.any(Object)
      );

      // Stream error is logged but doesn't stop processing
      // Pod should still return to idle
      expect(podStore.setStatus).toHaveBeenCalledWith('pod-123', 'idle');
    });
  });
});
