import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  emitAndWaitResponse,
  disconnectSocket,
  type TestServerInstance,
} from '../setup';
import {
  createPod,
  createOutputStyle,
  FAKE_UUID,
  FAKE_STYLE_ID,
  getCanvasId,
  describeCRUDTests,
  describePodBindingTests,
} from '../helpers';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodBindOutputStylePayload,
  type PodUnbindOutputStylePayload,
} from '../../src/schemas';
import {
  type PodOutputStyleBoundPayload,
  type PodOutputStyleUnboundPayload,
} from '../../src/types';

describe('OutputStyle 管理', () => {
  let server: TestServerInstance;
  let client: TestWebSocketClient;

  beforeAll(async () => {
    server = await createTestServer();
    client = await createSocketClient(server.baseUrl, server.canvasId);
  });

  afterAll(async () => {
    if (client?.connected) await disconnectSocket(client);
    if (server) await closeTestServer(server);
  });

  const getContext = () => ({ client, server });

  describeCRUDTests(
    {
      resourceName: 'OutputStyle',
      createResource: (client, name) => createOutputStyle(client, name ?? `style-${uuidv4()}`, '# Style Content'),
      fakeResourceId: FAKE_STYLE_ID,
      events: {
        create: { request: WebSocketRequestEvents.OUTPUT_STYLE_CREATE, response: WebSocketResponseEvents.OUTPUT_STYLE_CREATED },
        list: { request: WebSocketRequestEvents.OUTPUT_STYLE_LIST, response: WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT },
        read: { request: WebSocketRequestEvents.OUTPUT_STYLE_READ, response: WebSocketResponseEvents.OUTPUT_STYLE_READ_RESULT },
        update: { request: WebSocketRequestEvents.OUTPUT_STYLE_UPDATE, response: WebSocketResponseEvents.OUTPUT_STYLE_UPDATED },
        delete: { request: WebSocketRequestEvents.OUTPUT_STYLE_DELETE, response: WebSocketResponseEvents.OUTPUT_STYLE_DELETED },
      },
      payloadBuilders: {
        create: (canvasId, name) => ({ canvasId, name, content: '# Style Content' }),
        list: (canvasId) => ({ canvasId }),
        read: (canvasId, outputStyleId) => ({ canvasId, outputStyleId }),
        update: (canvasId, outputStyleId) => ({ canvasId, outputStyleId, content: '# Updated' }),
        delete: (canvasId, outputStyleId) => ({ canvasId, outputStyleId }),
      },
      responseFieldName: {
        list: 'styles',
        read: 'outputStyle',
      },
      bindForDeleteTest: {
        bindEvent: { request: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE, response: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND },
        buildPayload: (canvasId, podId, outputStyleId) => ({ canvasId, podId, outputStyleId }),
      },
      invalidNames: [
        { name: '測試風格', desc: '中文名稱' },
        { name: 'my style!', desc: '特殊字元' },
      ],
      hasContentValidation: true,
    },
    getContext
  );

  describePodBindingTests(
    {
      resourceName: 'OutputStyle',
      createResource: (client) => createOutputStyle(client, `style-${uuidv4()}`, '# Style Content'),
      fakeResourceId: FAKE_STYLE_ID,
      bindEvent: { request: WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE, response: WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND },
      buildBindPayload: (canvasId, podId, outputStyleId) => ({ canvasId, podId, outputStyleId }),
      verifyBoundResponse: (response, outputStyleId) => expect(response.pod.outputStyleId).toBe(outputStyleId),
    },
    getContext
  );

  describe('Pod 解除綁定 OutputStyle - OutputStyle 特有測試', () => {
    it('success_when_output_style_unbound_from_pod', async () => {
      const pod = await createPod(client);
      const style = await createOutputStyle(client, `unbind-style-${uuidv4()}`, '# UB');

      const canvasId = await getCanvasId(client);
      await emitAndWaitResponse<PodBindOutputStylePayload, PodOutputStyleBoundPayload>(
        client,
        WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_BOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id, outputStyleId: style.id }
      );

      const response = await emitAndWaitResponse<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: pod.id }
      );

      expect(response.success).toBe(true);
      expect(response.pod!.outputStyleId).toBeNull();
    });

    it('failed_when_unbind_output_style_with_nonexistent_pod', async () => {
      const canvasId = await getCanvasId(client);
      const response = await emitAndWaitResponse<PodUnbindOutputStylePayload, PodOutputStyleUnboundPayload>(
        client,
        WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE,
        WebSocketResponseEvents.POD_OUTPUT_STYLE_UNBOUND,
        { requestId: uuidv4(), canvasId, podId: FAKE_UUID }
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('找不到');
    });
  });
});
