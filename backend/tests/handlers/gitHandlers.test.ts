// Git Handlers Unit Tests
// Tests for Git WebSocket handler functions

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Socket } from 'socket.io';
import { handleGitClone } from '../../src/handlers/gitHandlers.js';
import { podStore } from '../../src/services/podStore.js';
import { gitService } from '../../src/services/workspace/gitService.js';
import { WebSocketResponseEvents } from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/services/podStore.js');
vi.mock('../../src/services/workspace/gitService.js');

describe('Git Handlers', () => {
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

  describe('handleGitClone', () => {
    it('should clone repository and emit progress updates', async () => {
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

      const updatedPod = {
        ...mockPod,
        gitUrl: 'https://github.com/user/repo.git',
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (gitService.clone as Mock).mockResolvedValue(undefined);
      (podStore.update as Mock).mockReturnValue(updatedPod);

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        repoUrl: 'https://github.com/user/repo.git',
        branch: 'main',
      };

      await handleGitClone(mockSocket, payload);

      // Verify pod was checked
      expect(podStore.getById).toHaveBeenCalledWith('pod-123');

      // Verify progress events were emitted (4 times: 0%, 30%, 90%, 100%)
      const emitCalls = (mockSocket.emit as Mock).mock.calls;
      const progressCalls = emitCalls.filter(
        (call) => call[0] === WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS
      );
      expect(progressCalls.length).toBe(4);

      // Verify progress messages
      expect(progressCalls[0][1]).toMatchObject({
        podId: 'pod-123',
        progress: 0,
        message: 'Starting Git clone...',
      });
      expect(progressCalls[1][1]).toMatchObject({
        podId: 'pod-123',
        progress: 30,
        message: expect.stringContaining('Cloning'),
      });
      expect(progressCalls[2][1]).toMatchObject({
        podId: 'pod-123',
        progress: 90,
      });
      expect(progressCalls[3][1]).toMatchObject({
        podId: 'pod-123',
        progress: 100,
        message: 'Clone complete!',
      });

      // Verify git clone was called
      expect(gitService.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        '/workspaces/pod-123',
        'main'
      );

      // Verify pod was updated
      expect(podStore.update).toHaveBeenCalledWith('pod-123', {
        gitUrl: 'https://github.com/user/repo.git',
      });

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
          pod: updatedPod,
        })
      );
    });

    it('should clone without branch specified', async () => {
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

      const updatedPod = {
        ...mockPod,
        gitUrl: 'https://github.com/user/repo.git',
      };

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (gitService.clone as Mock).mockResolvedValue(undefined);
      (podStore.update as Mock).mockReturnValue(updatedPod);

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        repoUrl: 'https://github.com/user/repo.git',
        // No branch specified
      };

      await handleGitClone(mockSocket, payload);

      // Verify git clone was called without branch
      expect(gitService.clone).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        '/workspaces/pod-123',
        undefined
      );

      // Verify success event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: true,
        })
      );
    });

    it('should emit error when pod not found', async () => {
      (podStore.getById as Mock).mockReturnValue(null);

      const payload = {
        requestId: 'req-123',
        podId: 'non-existent',
        repoUrl: 'https://github.com/user/repo.git',
      };

      await handleGitClone(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('not found'),
        })
      );

      // Verify git clone was not called
      expect(gitService.clone).not.toHaveBeenCalled();
    });

    it('should emit error when git clone fails', async () => {
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

      (podStore.getById as Mock).mockReturnValue(mockPod);
      (gitService.clone as Mock).mockRejectedValue(new Error('Git clone failed'));

      const payload = {
        requestId: 'req-123',
        podId: 'pod-123',
        repoUrl: 'https://github.com/user/repo.git',
      };

      await handleGitClone(mockSocket, payload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.stringContaining('Git clone failed'),
        })
      );
    });

    it('should emit error when payload is invalid', async () => {
      const invalidPayload = {
        requestId: 'req-123',
        podId: 'pod-123',
        // Missing repoUrl
      };

      await handleGitClone(mockSocket, invalidPayload);

      // Verify error event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith(
        WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
        expect.objectContaining({
          requestId: 'req-123',
          success: false,
          error: expect.any(String),
        })
      );

      // Verify git clone was not called
      expect(gitService.clone).not.toHaveBeenCalled();
    });
  });
});
