import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { createPod, FAKE_UUID, createSkillFile, createSubAgent, getCanvasId} from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodBindSkillPayload,
  type PodBindSubAgentPayload,
  type ConnectionCreatePayload,
  type ConnectionDeletePayload,
} from '../../src/schemas/index.js';
import {
  type PodSkillBoundPayload,
  type PodSubAgentBoundPayload,
  type PodStatusChangedPayload,
  type ConnectionCreatedPayload,
  type ConnectionDeletedPayload,
} from '../../src/types/index.js';
// 注意：podStore 和 connectionStore 使用動態 import，避免在測試配置覆蓋前載入

describe('Store 覆蓋率測試', () => {
  let server: TestServerInstance;
  let client: Socket;
  let podStore: Awaited<typeof import('../../src/services/podStore.js')>['podStore'];
  let connectionStore: Awaited<typeof import('../../src/services/connectionStore.js')>['connectionStore'];

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
    // 動態 import stores（確保使用測試配置）
    const podStoreModule = await import('../../src/services/podStore.js');
    const connectionStoreModule = await import('../../src/services/connectionStore.js');
    podStore = podStoreModule.podStore;
    connectionStore = connectionStoreModule.connectionStore;
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('PodStore', () => {
    it('success_when_canvas_pods_lazy_initialized', async () => {
      const canvasId = 'new-canvas-' + uuidv4();
      const pods = podStore.getAll(canvasId);

      expect(Array.isArray(pods)).toBe(true);
      expect(pods).toHaveLength(0);
    });

    it('success_when_status_same_skips_update', async () => {
      const pod = await createPod(client);
      const canvasId = server.canvasId;

      const statusChanges: PodStatusChangedPayload[] = [];
      const listener = (payload: PodStatusChangedPayload): void => {
        statusChanges.push(payload);
      };

      client.on(WebSocketResponseEvents.POD_STATUS_CHANGED, listener);

      podStore.setStatus(canvasId, pod.id, 'idle');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(statusChanges).toHaveLength(0);

      client.off(WebSocketResponseEvents.POD_STATUS_CHANGED, listener);
    });

    it('success_when_status_different_emits_event', async () => {
      const pod = await createPod(client);
      const canvasId = server.canvasId;

      const socketServiceModule = await import('../../src/services/socketService.js');
      socketServiceModule.socketService.joinPodRoom(client.id!, pod.id);

      const statusChanges: PodStatusChangedPayload[] = [];
      const listener = (payload: PodStatusChangedPayload): void => {
        statusChanges.push(payload);
      };

      client.on(WebSocketResponseEvents.POD_STATUS_CHANGED, listener);

      podStore.setStatus(canvasId, pod.id, 'chatting');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(statusChanges).toHaveLength(1);
      expect(statusChanges[0].podId).toBe(pod.id);
      expect(statusChanges[0].status).toBe('chatting');
      expect(statusChanges[0].previousStatus).toBe('idle');

      client.off(WebSocketResponseEvents.POD_STATUS_CHANGED, listener);
    });

    it('success_when_skill_not_in_list_adds', async () => {
      const pod = await createPod(client);
      const skillId = await createSkillFile(`skill-${uuidv4()}`, '# Test');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.skillIds).toContain(skillId);
    });

    it('success_when_skill_already_in_list_skips', async () => {
      const pod = await createPod(client);
      const skillId = await createSkillFile(`skill-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);

      await emitAndWaitResponse<PodBindSkillPayload, PodSkillBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SKILL,
        WebSocketResponseEvents.POD_SKILL_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, skillId }
      );

      const beforeLength = podStore.getById(canvasId, pod.id)!.skillIds.length;

      podStore.addSkillId(canvasId, pod.id, skillId);

      const afterLength = podStore.getById(canvasId, pod.id)!.skillIds.length;

      expect(beforeLength).toBe(afterLength);
    });

    it('success_when_subagent_not_in_list_adds', async () => {
      const pod = await createPod(client);
      const subAgent = await createSubAgent(client, `subagent-${uuidv4()}`, '# Test');

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: subAgent.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.subAgentIds).toContain(subAgent.id);
    });

    it('success_when_subagent_already_in_list_skips', async () => {
      const pod = await createPod(client);
      const subAgent = await createSubAgent(client, `subagent-${uuidv4()}`, '# Test');
      const canvasId = await getCanvasId(client);

      await emitAndWaitResponse<PodBindSubAgentPayload, PodSubAgentBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_SUBAGENT,
        WebSocketResponseEvents.POD_SUBAGENT_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, subAgentId: subAgent.id }
      );

      const beforeLength = podStore.getById(canvasId, pod.id)!.subAgentIds.length;

      podStore.addSubAgentId(canvasId, pod.id, subAgent.id);

      const afterLength = podStore.getById(canvasId, pod.id)!.subAgentIds.length;

      expect(beforeLength).toBe(afterLength);
    });

    it('failed_when_canvas_not_found_throws', () => {
      const fakeCanvasId = 'nonexistent-canvas';

      expect(() => {
        podStore.create(fakeCanvasId, {
          name: 'Test',
          color: 'blue',
          x: 0,
          y: 0,
          rotation: 0,
        });
      }).toThrow('Canvas not found');
    });
  });

  describe('ConnectionStore', () => {
    it('success_when_canvas_map_lazy_initialized', () => {
      const canvasId = 'new-canvas-' + uuidv4();
      const connections = connectionStore.list(canvasId);

      expect(Array.isArray(connections)).toBe(true);
      expect(connections).toHaveLength(0);
    });

    it('success_when_delete_saves_to_disk', async () => {
      const podA = await createPod(client, { name: 'Pod A' });
      const podB = await createPod(client, { name: 'Pod B' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<ConnectionCreatePayload, ConnectionCreatedPayload>(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        {
          requestId: uuidv4(),
          canvasId,
          sourcePodId: podA.id,
          sourceAnchor: 'right',
          targetPodId: podB.id,
          targetAnchor: 'left',
        }
      );

      const connectionId = response.connection!.id;

      const deleted = connectionStore.delete(canvasId, connectionId);

      expect(deleted).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const connections = connectionStore.list(canvasId);
      expect(connections.find((c) => c.id === connectionId)).toBeUndefined();
    });

    it('success_when_delete_fails_skips_save', () => {
      const canvasId = server.canvasId;

      const deleted = connectionStore.delete(canvasId, FAKE_UUID);

      expect(deleted).toBe(false);
    });

    it('success_when_find_by_pod_returns_empty_if_no_map', () => {
      const canvasId = 'nonexistent-canvas-' + uuidv4();

      const connections = connectionStore.findByPodId(canvasId, FAKE_UUID);

      expect(Array.isArray(connections)).toBe(true);
      expect(connections).toHaveLength(0);
    });
  });
});
