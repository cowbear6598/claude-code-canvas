// Pod Handlers Unit Tests
// Tests for Pod WebSocket handler functions

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Socket } from 'socket.io';
import {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodDelete,
} from '../../src/handlers/podHandlers.js';
import { podStore } from '../../src/services/podStore.js';
import { workspaceService } from '../../src/services/workspace/index.js';
import { claudeSessionManager } from '../../src/services/claude/sessionManager.js';
import { WebSocketResponseEvents } from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/services/podStore.js');
vi.mock('../../src/services/workspace/index.js');
vi.mock('../../src/services/claude/sessionManager.js');

describe('Pod Handlers', () => {
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

  describe('handlePodCreate', () => {
    it('should create pod and emit success', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      // Mock podStore.create
      (podStore.create as Mock).mockReturnValue(mockPod);

      // Mock workspaceService.createWorkspace
      (workspaceService.createWorkspace as Mock).mockResolvedValue('/workspaces/pod-123');

      // Mock claudeSessionManager.createSession
      (claudeSessionManager.createSession as Mock).mockResolvedValue(undefined);

      const payload = {
        requestId: 'req-123',
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      await handlePodCreate(mockSocket, payload);

      // Verify podStore.create was called
      expect(podStore.create).toHaveBeenCalledWith({
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      });

      // Verify workspace was created
      expect(workspaceService.createWorkspace).toHaveBeenCalledWith('pod-123');

      // Verify Claude session was created
      expect(claudeSessionManager.createSession).toHaveBeenCalledWith(
        'pod-123',
        '/workspaces/pod-123'
      );

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_CREATED,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          pod: mockPod,
        })
      );
    });

    it('should emit error when payload is invalid', async () => {
      const invalidPayload = {
        requestId: 'req-123',
        name: 'Test Pod',
        // Missing type and color
      };

      await handlePodCreate(mockSocket, invalidPayload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_CREATED,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.any(String),
        })
      );
    });

    it('should emit error when pod creation fails', async () => {
      (podStore.create as Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const payload = {
        requestId: 'req-123',
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      await handlePodCreate(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_CREATED,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('Database error'),
        })
      );
    });
  });

  describe('handlePodList', () => {
    it('should return all pods', async () => {
      const mockPods = [
        {
          id: 'pod-1',
          name: 'Pod 1',
          type: 'Code Assistant',
          color: 'blue',
          status: 'idle',
          workspacePath: '/workspaces/pod-1',
          createdAt: new Date(),
          lastActiveAt: new Date(),
        },
        {
          id: 'pod-2',
          name: 'Pod 2',
          type: 'Chat Companion',
          color: 'coral',
          status: 'idle',
          workspacePath: '/workspaces/pod-2',
          createdAt: new Date(),
          lastActiveAt: new Date(),
        },
      ];

      (podStore.getAll as Mock).mockReturnValue(mockPods);

      const payload = { requestId: 'req-123' };

      await handlePodList(mockSocket, payload);

      // Verify podStore.getAll was called
      expect(podStore.getAll).toHaveBeenCalled();

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_LIST_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          pods: mockPods,
        })
      );
    });

    it('should return empty array when no pods exist', async () => {
      (podStore.getAll as Mock).mockReturnValue([]);

      const payload = { requestId: 'req-123' };

      await handlePodList(mockSocket, payload);

      // Verify success event was emitted with empty array
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_LIST_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          pods: [],
        })
      );
    });
  });

  describe('handlePodGet', () => {
    it('should return specific pod', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Data Analyst',
        color: 'yellow',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);

      const payload = { requestId: 'req-123', podId: 'pod-123' };

      await handlePodGet(mockSocket, payload);

      // Verify podStore.getById was called
      expect(podStore.getById).toHaveBeenCalledWith('pod-123');

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GET_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          pod: mockPod,
        })
      );
    });

    it('should emit error when pod not found', async () => {
      (podStore.getById as Mock).mockReturnValue(null);

      const payload = { requestId: 'req-123', podId: 'non-existent' };

      await handlePodGet(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GET_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('not found'),
        })
      );
    });
  });

  describe('handlePodDelete', () => {
    it('should delete pod and emit success', async () => {
      const mockPod = {
        id: 'pod-123',
        name: 'Test Pod',
        type: 'Creative Writer',
        color: 'pink',
        status: 'idle',
        workspacePath: '/workspaces/pod-123',
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (podStore.delete as Mock).mockReturnValue(true);
      (claudeSessionManager.destroySession as Mock).mockResolvedValue(undefined);
      (workspaceService.deleteWorkspace as Mock).mockResolvedValue(undefined);

      const payload = { requestId: 'req-123', podId: 'pod-123' };

      await handlePodDelete(mockSocket, payload);

      // Verify Claude session was destroyed
      expect(claudeSessionManager.destroySession).toHaveBeenCalledWith('pod-123');

      // Verify workspace was deleted
      expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith('pod-123');

      // Verify pod was deleted from store
      expect(podStore.delete).toHaveBeenCalledWith('pod-123');

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_DELETED,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          podId: 'pod-123',
        })
      );
    });

    it('should emit error when pod not found', async () => {
      (podStore.getById as Mock).mockReturnValue(null);

      const payload = { requestId: 'req-123', podId: 'non-existent' };

      await handlePodDelete(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_DELETED,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('not found'),
        })
      );

      // Verify cleanup methods were not called
      expect(claudeSessionManager.destroySession).not.toHaveBeenCalled();
      expect(workspaceService.deleteWorkspace).not.toHaveBeenCalled();
      expect(podStore.delete).not.toHaveBeenCalled();
    });
  });
});
