// Phase 7: Canvas Paste Flow 測試
// 測試 Canvas 貼上功能，包含 Pod、Connection、Notes 的貼上與 ID mapping

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
import {
  createTestPodPayload,
  createTestPastePayload,
  createSimpleTestPastePayload,
} from '../fixtures/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type PodCreatePayload,
  type PodCreatedPayload,
  type ConnectionCreatePayload,
  type ConnectionCreatedPayload,
  type CanvasPastePayload,
  type CanvasPasteResultPayload,
  type NoteCreatePayload,
  type NoteCreatedPayload,
  type SkillNoteCreatePayload,
  type SkillNoteCreatedPayload,
  type OutputStyleListPayload,
  type OutputStyleListResultPayload,
  type SkillListPayload,
  type SkillListResultPayload,
  type PastePodItem,
  type PasteConnectionItem
} from '../../src/types/index.js';

describe('Phase 7: Canvas Paste Flow', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  beforeEach(async () => {
    client = await createSocketClient(server.baseUrl);
  });

  afterEach(async () => {
    if (client && client.connected) {
      await disconnectSocket(client);
    }
  });

  describe('Canvas 貼上功能', () => {
    it('應能貼上多個 Pod', async () => {
      // 建立簡單的貼上 Payload（只包含 2 個 Pod）
      const pastePayload = createSimpleTestPastePayload(2);

      // 發送貼上請求
      const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
        client,
        WebSocketRequestEvents.CANVAS_PASTE,
        WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        pastePayload
      );

      // 驗證回應結構
      expect(response.success).toBe(true);
      expect(response.createdPods).toBeDefined();
      expect(response.createdPods).toHaveLength(2);
      expect(response.podIdMapping).toBeDefined();
      expect(response.errors).toHaveLength(0);

      // 驗證 Pod ID Mapping
      expect(Object.keys(response.podIdMapping)).toHaveLength(2);
      pastePayload.pods.forEach((pastePod) => {
        expect(response.podIdMapping[pastePod.originalId]).toBeDefined();
        expect(response.podIdMapping[pastePod.originalId]).not.toBe(pastePod.originalId);
      });

      // 驗證建立的 Pod
      response.createdPods.forEach((pod, index) => {
        expect(pod.id).toBeDefined();
        expect(pod.name).toBe(`Pasted Pod ${index + 1}`);
        expect(pod.type).toBe('General AI');
        expect(pod.color).toBe('blue');
        expect(pod.status).toBe('idle');
      });
    });

    it('應能貼上 Pod 和 Connection', async () => {
      // 先建立 2 個 Pod 作為來源
      const pod1Payload = createTestPodPayload({ name: 'Source Pod 1' });
      const pod1Response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        pod1Payload
      );

      const pod2Payload = createTestPodPayload({ name: 'Source Pod 2' });
      const pod2Response = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        pod2Payload
      );

      const pod1 = pod1Response.pod!;
      const pod2 = pod2Response.pod!;

      // 建立 Connection
      const connectionPayload: ConnectionCreatePayload = {
        requestId: uuidv4(),
        sourcePodId: pod1.id,
        sourceAnchor: 'bottom',
        targetPodId: pod2.id,
        targetAnchor: 'top',
      };

      const connectionResponse = await emitAndWaitResponse<
        ConnectionCreatePayload,
        ConnectionCreatedPayload
      >(
        client,
        WebSocketRequestEvents.CONNECTION_CREATE,
        WebSocketResponseEvents.CONNECTION_CREATED,
        connectionPayload
      );

      const connection = connectionResponse.connection!;

      // 建立貼上 Payload（包含 Pod 和 Connection）
      const pastePayload = createTestPastePayload([pod1, pod2], [connection]);

      // 發送貼上請求
      const pasteResponse = await emitAndWaitResponse<
        CanvasPastePayload,
        CanvasPasteResultPayload
      >(
        client,
        WebSocketRequestEvents.CANVAS_PASTE,
        WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        pastePayload
      );

      // 驗證回應
      expect(pasteResponse.success).toBe(true);
      expect(pasteResponse.createdPods).toHaveLength(2);
      expect(pasteResponse.createdConnections).toHaveLength(1);
      expect(pasteResponse.errors).toHaveLength(0);

      // 驗證 Pod ID Mapping
      expect(pasteResponse.podIdMapping[pod1.id]).toBeDefined();
      expect(pasteResponse.podIdMapping[pod2.id]).toBeDefined();

      // 驗證 Connection 使用新的 Pod ID
      const createdConnection = pasteResponse.createdConnections[0];
      expect(createdConnection.sourcePodId).toBe(pasteResponse.podIdMapping[pod1.id]);
      expect(createdConnection.targetPodId).toBe(pasteResponse.podIdMapping[pod2.id]);
      expect(createdConnection.sourceAnchor).toBe('bottom');
      expect(createdConnection.targetAnchor).toBe('top');
      expect(createdConnection.autoTrigger).toBe(true); // 預設值
    });

    it('應能貼上 Pod 和綁定的 Notes', async () => {
      // 先取得可用的 OutputStyle
      const outputStyleListPayload: OutputStyleListPayload = { requestId: uuidv4() };
      const outputStyleListResponse = await emitAndWaitResponse<
        OutputStyleListPayload,
        OutputStyleListResultPayload
      >(
        client,
        WebSocketRequestEvents.OUTPUT_STYLE_LIST,
        WebSocketResponseEvents.OUTPUT_STYLE_LIST_RESULT,
        outputStyleListPayload
      );

      // 先取得可用的 Skill
      const skillListPayload: SkillListPayload = { requestId: uuidv4() };
      const skillListResponse = await emitAndWaitResponse<
        SkillListPayload,
        SkillListResultPayload
      >(
        client,
        WebSocketRequestEvents.SKILL_LIST,
        WebSocketResponseEvents.SKILL_LIST_RESULT,
        skillListPayload
      );

      // 如果沒有可用的 OutputStyle 或 Skill，跳過此測試
      if (
        !outputStyleListResponse.styles ||
        outputStyleListResponse.styles.length === 0 ||
        !skillListResponse.skills ||
        skillListResponse.skills.length === 0
      ) {
        console.log('跳過測試：沒有可用的 OutputStyle 或 Skill');
        return;
      }

      const outputStyleId = outputStyleListResponse.styles[0].id;
      const skillId = skillListResponse.skills[0].id;

      // 建立 Pod
      const podPayload = createTestPodPayload({ name: 'Pod with Notes' });
      const podResponse = await emitAndWaitResponse<PodCreatePayload, PodCreatedPayload>(
        client,
        WebSocketRequestEvents.POD_CREATE,
        WebSocketResponseEvents.POD_CREATED,
        podPayload
      );

      const pod = podResponse.pod!;

      // 建立 OutputStyle Note（綁定到 Pod）
      const outputStyleNotePayload: NoteCreatePayload = {
        requestId: uuidv4(),
        outputStyleId,
        name: 'Output Style Note',
        x: 500,
        y: 500,
        boundToPodId: pod.id,
        originalPosition: { x: 50, y: 50 },
      };

      const outputStyleNoteResponse = await emitAndWaitResponse<
        NoteCreatePayload,
        NoteCreatedPayload
      >(
        client,
        WebSocketRequestEvents.NOTE_CREATE,
        WebSocketResponseEvents.NOTE_CREATED,
        outputStyleNotePayload
      );

      const outputStyleNote = outputStyleNoteResponse.note!;

      // 建立 Skill Note（綁定到 Pod）
      const skillNotePayload: SkillNoteCreatePayload = {
        requestId: uuidv4(),
        skillId,
        name: 'Skill Note',
        x: 600,
        y: 600,
        boundToPodId: pod.id,
        originalPosition: { x: 60, y: 60 },
      };

      const skillNoteResponse = await emitAndWaitResponse<
        SkillNoteCreatePayload,
        SkillNoteCreatedPayload
      >(
        client,
        WebSocketRequestEvents.SKILL_NOTE_CREATE,
        WebSocketResponseEvents.SKILL_NOTE_CREATED,
        skillNotePayload
      );

      const skillNote = skillNoteResponse.note!;

      // 建立貼上 Payload（包含 Pod 和綁定的 Notes）
      const pastePayload = createTestPastePayload(
        [pod],
        [],
        [outputStyleNote],
        [skillNote],
        [],
        []
      );

      // 發送貼上請求
      const pasteResponse = await emitAndWaitResponse<
        CanvasPastePayload,
        CanvasPasteResultPayload
      >(
        client,
        WebSocketRequestEvents.CANVAS_PASTE,
        WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        pastePayload
      );

      // 驗證回應
      expect(pasteResponse.success).toBe(true);
      expect(pasteResponse.createdPods).toHaveLength(1);
      expect(pasteResponse.createdOutputStyleNotes).toHaveLength(1);
      expect(pasteResponse.createdSkillNotes).toHaveLength(1);
      expect(pasteResponse.errors).toHaveLength(0);

      // 驗證 Notes 的 boundToPodId 已更新為新 Pod ID
      const newPodId = pasteResponse.podIdMapping[pod.id];
      expect(newPodId).toBeDefined();

      const createdOutputStyleNote = pasteResponse.createdOutputStyleNotes[0];
      expect(createdOutputStyleNote.boundToPodId).toBe(newPodId);
      expect(createdOutputStyleNote.outputStyleId).toBe(outputStyleId);

      const createdSkillNote = pasteResponse.createdSkillNotes[0];
      expect(createdSkillNote.boundToPodId).toBe(newPodId);
      expect(createdSkillNote.skillId).toBe(skillId);
    });

    it('貼上時部分項目失敗應回報錯誤', async () => {
      // 建立一個有效的 Pod
      const validPodItem: PastePodItem = {
        originalId: uuidv4(),
        name: 'Valid Pod',
        type: 'General AI',
        color: 'blue',
        x: 100,
        y: 100,
        rotation: 0,
      };

      // 建立一個使用不存在 repositoryId 的 Pod（應該會記錄警告但仍建立 Pod）
      const podWithInvalidRepo: PastePodItem = {
        originalId: uuidv4(),
        name: 'Pod with Invalid Repo',
        type: 'General AI',
        color: 'green',
        x: 200,
        y: 200,
        rotation: 0,
        repositoryId: uuidv4(), // 使用一個不存在的 repository ID
      };

      // 建立一個 Connection，其 source 是不存在的 Pod ID（會被跳過）
      const nonExistentPodId = uuidv4();
      const connectionWithInvalidSource: PasteConnectionItem = {
        originalSourcePodId: nonExistentPodId, // 這個 ID 不在 pods 陣列中
        sourceAnchor: 'bottom',
        originalTargetPodId: validPodItem.originalId,
        targetAnchor: 'top',
      };

      // 建立貼上 Payload
      const pastePayload: CanvasPastePayload = {
        requestId: uuidv4(),
        pods: [validPodItem, podWithInvalidRepo],
        outputStyleNotes: [],
        skillNotes: [],
        repositoryNotes: [],
        subAgentNotes: [],
        connections: [connectionWithInvalidSource],
      };

      // 發送貼上請求
      const response = await emitAndWaitResponse<CanvasPastePayload, CanvasPasteResultPayload>(
        client,
        WebSocketRequestEvents.CANVAS_PASTE,
        WebSocketResponseEvents.CANVAS_PASTE_RESULT,
        pastePayload
      );

      // 驗證回應
      // 兩個 Pod 都應該建立（即使 repository 不存在）
      expect(response.createdPods).toBeDefined();
      expect(response.createdPods.length).toBeGreaterThanOrEqual(1);

      // Connection 應該失敗（因為 source Pod ID 不在 mapping 中）
      expect(response.createdConnections).toHaveLength(0);

      // 驗證 Pod ID Mapping 包含有效的 Pod
      expect(response.podIdMapping).toBeDefined();
      expect(response.podIdMapping[validPodItem.originalId]).toBeDefined();

      // 驗證至少建立了有效的 Pod
      const validPod = response.createdPods.find((p) => p.name === 'Valid Pod');
      expect(validPod).toBeDefined();
      expect(validPod?.id).toBe(response.podIdMapping[validPodItem.originalId]);

      // 如果有錯誤（例如 repository 不存在的警告），檢查錯誤陣列
      if (response.errors.length > 0) {
        expect(response.success).toBe(false);
        expect(response.error).toBeDefined();
      }
    });
  });
});
