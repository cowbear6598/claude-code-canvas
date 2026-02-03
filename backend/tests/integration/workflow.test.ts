import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { createPod, FAKE_UUID, getCanvasId} from '../helpers/index.js';
import { createConnection } from '../helpers/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type WorkflowGetDownstreamPodsPayload,
  type WorkflowClearPayload,
} from '../../src/schemas/index.js';
import {
  type WorkflowGetDownstreamPodsResultPayload,
  type WorkflowClearResultPayload,
} from '../../src/types/index.js';

describe('Workflow 管理', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  describe('取得下游 Pod', () => {
    it('success_when_get_downstream_pods_returns_chain', async () => {
      const podA = await createPod(client, { name: 'Chain A' });
      const podB = await createPod(client, { name: 'Chain B' });
      const podC = await createPod(client, { name: 'Chain C' });

      await createConnection(client, podA.id, podB.id);
      await createConnection(client, podB.id, podC.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<
        WorkflowGetDownstreamPodsPayload,
        WorkflowGetDownstreamPodsResultPayload
      >(
        client,
        WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        { requestId: uuidv4(), canvasId, sourcePodId: podA.id }
      );

      expect(response.success).toBe(true);
      const ids = response.pods!.map((p) => p.id);
      expect(ids).toContain(podB.id);
      expect(ids).toContain(podC.id);
    });

    it('success_when_get_downstream_pods_returns_empty_for_leaf', async () => {
      const pod = await createPod(client, { name: 'Leaf Pod' });

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<
        WorkflowGetDownstreamPodsPayload,
        WorkflowGetDownstreamPodsResultPayload
      >(
        client,
        WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        { requestId: uuidv4(), canvasId, sourcePodId: pod.id }
      );

      expect(response.success).toBe(true);
      // Only self or empty depending on implementation
      const ids = response.pods!.map((p) => p.id).filter((id) => id !== pod.id);
      expect(ids).toHaveLength(0);
    });

    it('failed_when_get_downstream_pods_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<
        WorkflowGetDownstreamPodsPayload,
        WorkflowGetDownstreamPodsResultPayload
      >(
        client,
        WebSocketRequestEvents.WORKFLOW_GET_DOWNSTREAM_PODS,
        WebSocketResponseEvents.WORKFLOW_GET_DOWNSTREAM_PODS_RESULT,
        { requestId: uuidv4(), canvasId, sourcePodId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('清除下游 Pod', () => {
    it('success_when_workflow_clear_clears_downstream_pods', async () => {
      const podA = await createPod(client, { name: 'Clear A' });
      const podB = await createPod(client, { name: 'Clear B' });
      const podC = await createPod(client, { name: 'Clear C' });

      await createConnection(client, podA.id, podB.id);
      await createConnection(client, podB.id, podC.id);

      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<WorkflowClearPayload, WorkflowClearResultPayload>(
        client,
        WebSocketRequestEvents.WORKFLOW_CLEAR,
        WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        { requestId: uuidv4(), canvasId, sourcePodId: podA.id }
      );

      expect(response.success).toBe(true);
      expect(response.clearedPodIds).toContain(podB.id);
      expect(response.clearedPodIds).toContain(podC.id);
    });

    it('failed_when_workflow_clear_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<WorkflowClearPayload, WorkflowClearResultPayload>(
        client,
        WebSocketRequestEvents.WORKFLOW_CLEAR,
        WebSocketResponseEvents.WORKFLOW_CLEAR_RESULT,
        { requestId: uuidv4(), canvasId, sourcePodId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });
});
