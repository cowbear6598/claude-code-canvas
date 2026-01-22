// WebSocket Integration Tests
// Tests for complete WebSocket event flow
//
// Note: These are simplified integration tests that verify the basic WebSocket event flow.
// For production, consider using a more robust testing setup with proper connection lifecycle management.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { setupSocketHandlers } from '../../src/services/socketHandlers.js';
import { podStore } from '../../src/services/podStore.js';
import { workspaceService } from '../../src/services/workspace/index.js';
import { claudeSessionManager } from '../../src/services/claude/sessionManager.js';
import { gitService } from '../../src/services/workspace/gitService.js';
import { claudeQueryService } from '../../src/services/claude/queryService.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatedPayload,
  type PodListResultPayload,
  type PodGetResultPayload,
  type PodDeletedPayload,
} from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/services/workspace/index.js');
vi.mock('../../src/services/claude/sessionManager.js');
vi.mock('../../src/services/workspace/gitService.js');
vi.mock('../../src/services/claude/queryService.js');

describe('WebSocket Integration Tests', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;
  const PORT = 3001;

  beforeAll(async () => {
    // Mock service methods
    vi.spyOn(workspaceService, 'createWorkspace').mockResolvedValue('/workspaces/test');
    vi.spyOn(workspaceService, 'deleteWorkspace').mockResolvedValue();
    vi.spyOn(claudeSessionManager, 'createSession').mockResolvedValue();
    vi.spyOn(claudeSessionManager, 'destroySession').mockResolvedValue();
    vi.spyOn(gitService, 'clone').mockResolvedValue();
    vi.spyOn(claudeQueryService, 'sendMessage').mockImplementation(
      async (podId: string, message: string, callback: Function) => {
        // Simulate simple streaming response
        callback({ type: 'text', content: 'Response' });
        callback({ type: 'complete' });
      }
    );

    // Create HTTP server and Socket.io server
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    // Setup socket handlers
    ioServer.on('connection', (socket) => {
      setupSocketHandlers(socket);
    });

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, () => {
        resolve();
      });
    });

    // Create and connect client socket
    await new Promise<void>((resolve, reject) => {
      clientSocket = ioClient(`http://localhost:${PORT}`, {
        reconnection: false,
      });

      clientSocket.on('connect', () => resolve());
      clientSocket.on('connect_error', (error) => reject(error));

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  afterAll(async () => {
    // Close connections
    if (clientSocket) {
      clientSocket.close();
    }

    await new Promise<void>((resolve) => {
      if (ioServer) {
        ioServer.close(() => {
          if (httpServer) {
            httpServer.close(() => resolve());
          } else {
            resolve();
          }
        });
      } else if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Clear pod store before each test
    const allPods = podStore.getAll();
    allPods.forEach((pod) => podStore.delete(pod.id));
  });

  describe('Pod CRUD Operations', () => {
    it('should create pod via WebSocket', async () => {
      const response = await new Promise<PodCreatedPayload>((resolve) => {
        clientSocket.once(WebSocketResponseEvents.POD_CREATED, resolve);
        clientSocket.emit(WebSocketRequestEvents.POD_CREATE, {
          requestId: 'req-create',
          name: 'Test Pod',
          type: 'Code Assistant',
          color: 'blue',
        });
      });

      expect(response.success).toBe(true);
      expect(response.requestId).toBe('req-create');
      expect(response.pod).toBeDefined();
      expect(response.pod?.name).toBe('Test Pod');
    });

    it('should list pods via WebSocket', async () => {
      // First create a pod
      await new Promise<PodCreatedPayload>((resolve) => {
        clientSocket.once(WebSocketResponseEvents.POD_CREATED, resolve);
        clientSocket.emit(WebSocketRequestEvents.POD_CREATE, {
          requestId: 'req-create',
          name: 'Test Pod',
          type: 'Code Assistant',
          color: 'blue',
        });
      });

      // Then list pods
      const response = await new Promise<PodListResultPayload>((resolve) => {
        clientSocket.once(WebSocketResponseEvents.POD_LIST_RESULT, resolve);
        clientSocket.emit(WebSocketRequestEvents.POD_LIST, {
          requestId: 'req-list',
        });
      });

      expect(response.success).toBe(true);
      expect(response.requestId).toBe('req-list');
      expect(response.pods).toBeDefined();
      expect(response.pods!.length).toBeGreaterThan(0);
    });

    it('should handle pod not found error', async () => {
      const response = await new Promise<PodGetResultPayload>((resolve) => {
        clientSocket.once(WebSocketResponseEvents.POD_GET_RESULT, resolve);
        clientSocket.emit(WebSocketRequestEvents.POD_GET, {
          requestId: 'req-not-found',
          podId: 'non-existent-id',
        });
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error).toContain('not found');
    });
  });

  describe('Connection', () => {
    it('should be connected to WebSocket server', () => {
      expect(clientSocket.connected).toBe(true);
    });
  });
});
