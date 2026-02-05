import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import type {Socket} from 'socket.io-client';
import {v4 as uuidv4} from 'uuid';
import {
    createTestServer,
    closeTestServer,
    createSocketClient,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance,
} from '../setup/index.js';
import {
    createCanvas,
    getCanvasId,
    listCanvases,
    reorderCanvases,
} from '../helpers/index.js';
import {FAKE_UUID} from '../helpers/index.js';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type CanvasCreatePayload,
    type CanvasListPayload,
    type CanvasRenamePayload,
    type CanvasDeletePayload,
    type CanvasSwitchPayload,
    type CanvasReorderPayload,
} from '../../src/schemas/index.js';
import {
    type CanvasCreatedPayload,
    type CanvasListResultPayload,
    type CanvasRenamedPayload,
    type CanvasDeletedPayload,
    type CanvasSwitchedPayload,
    type CanvasReorderedPayload,
} from '../../src/types/index.js';

describe('Canvas 管理', () => {
    let server: TestServerInstance;
    let client: Socket;

    beforeAll(async () => {
        server = await createTestServer();
        client = await createSocketClient(server.baseUrl, server.canvasId);
    }, 30000);

    afterAll(async () => {
        if (client?.connected) await disconnectSocket(client);
        if (server) await closeTestServer(server);
    });

    describe('Canvas 建立', () => {
        it('success_when_canvas_created_with_valid_name', async () => {
            const canvas = await createCanvas(client, 'Test Canvas');

            expect(canvas.id).toBeDefined();
            expect(canvas.name).toBe('Test Canvas');
            expect(canvas.createdAt).toBeDefined();
        });

        it('failed_when_canvas_create_with_empty_name', async () => {
            const response = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_CREATE,
                WebSocketResponseEvents.CANVAS_CREATED,
                {requestId: uuidv4(), name: ''}
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('failed_when_canvas_create_with_invalid_name', async () => {
            const response = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_CREATE,
                WebSocketResponseEvents.CANVAS_CREATED,
                {requestId: uuidv4(), name: 'Invalid@Name!'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });
    });

    describe('Canvas 列表', () => {
        it('success_when_canvas_list_returns_all_canvases', async () => {
            await createCanvas(client, 'List Canvas 1');
            await createCanvas(client, 'List Canvas 2');

            const response = await emitAndWaitResponse<CanvasListPayload, CanvasListResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_LIST,
                WebSocketResponseEvents.CANVAS_LIST_RESULT,
                {requestId: uuidv4()}
            );

            expect(response.success).toBe(true);
            const names = response.canvases!.map((c) => c.name);
            expect(names).toContain('List Canvas 1');
            expect(names).toContain('List Canvas 2');
        });

        it('success_when_canvas_list_returns_array', async () => {
            const response = await emitAndWaitResponse<CanvasListPayload, CanvasListResultPayload>(
                client,
                WebSocketRequestEvents.CANVAS_LIST,
                WebSocketResponseEvents.CANVAS_LIST_RESULT,
                {requestId: uuidv4()}
            );

            expect(response.success).toBe(true);
            expect(Array.isArray(response.canvases)).toBe(true);
        });
    });

    describe('Canvas 重命名', () => {
        it('success_when_canvas_renamed', async () => {
            const canvas = await createCanvas(client, 'Original Name');

            const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_RENAME,
                WebSocketResponseEvents.CANVAS_RENAMED,
                {requestId: uuidv4(), canvasId: canvas.id, newName: 'Renamed Canvas'}
            );

            expect(response.success).toBe(true);
            expect(response.canvas!.id).toBe(canvas.id);
            expect(response.canvas!.name).toBe('Renamed Canvas');
        });

        it('failed_when_canvas_rename_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_RENAME,
                WebSocketResponseEvents.CANVAS_RENAMED,
                {requestId: uuidv4(), canvasId: FAKE_UUID, newName: 'New Name'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('failed_when_canvas_rename_with_empty_name', async () => {
            const canvas = await createCanvas(client, 'Valid Name');

            const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_RENAME,
                WebSocketResponseEvents.CANVAS_RENAMED,
                {requestId: uuidv4(), canvasId: canvas.id, newName: ''}
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('failed_when_canvas_rename_with_invalid_name', async () => {
            const createResponse = await emitAndWaitResponse<CanvasCreatePayload, CanvasCreatedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_CREATE,
                WebSocketResponseEvents.CANVAS_CREATED,
                {requestId: uuidv4(), name: 'Valid_Name_2'}
            );

            expect(createResponse.success).toBe(true);
            const canvas = createResponse.canvas!;

            const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_RENAME,
                WebSocketResponseEvents.CANVAS_RENAMED,
                {requestId: uuidv4(), canvasId: canvas.id, newName: 'Invalid@Name!'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('failed_when_canvas_rename_to_existing_name', async () => {
            // 建立兩個 Canvas
            await createCanvas(client, 'Canvas_One');
            const canvas2 = await createCanvas(client, 'Canvas_Two');

            // 嘗試將 canvas2 重命名為 canvas1 的名稱
            const response = await emitAndWaitResponse<CanvasRenamePayload, CanvasRenamedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_RENAME,
                WebSocketResponseEvents.CANVAS_RENAMED,
                {requestId: uuidv4(), canvasId: canvas2.id, newName: 'Canvas_One'}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('已存在');
        });
    });

    describe('Canvas 刪除', () => {
        it('success_when_canvas_deleted', async () => {
            const canvas = await createCanvas(client, 'To Delete');

            const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_DELETE,
                WebSocketResponseEvents.CANVAS_DELETED,
                {requestId: uuidv4(), canvasId: canvas.id}
            );

            expect(response.success).toBe(true);
            expect(response.canvasId).toBe(canvas.id);
        });

        it('failed_when_canvas_delete_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_DELETE,
                WebSocketResponseEvents.CANVAS_DELETED,
                {requestId: uuidv4(), canvasId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });

        it('failed_when_canvas_delete_while_in_use', async () => {
            const activeCanvasId = await getCanvasId(client);

            const response = await emitAndWaitResponse<CanvasDeletePayload, CanvasDeletedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_DELETE,
                WebSocketResponseEvents.CANVAS_DELETED,
                {requestId: uuidv4(), canvasId: activeCanvasId}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('無法刪除正在使用的 Canvas');
        });
    });

    describe('Canvas 切換', () => {
        it('success_when_canvas_switched', async () => {
            const canvas = await createCanvas(client, 'Switch Target');

            const response = await emitAndWaitResponse<CanvasSwitchPayload, CanvasSwitchedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_SWITCH,
                WebSocketResponseEvents.CANVAS_SWITCHED,
                {requestId: uuidv4(), canvasId: canvas.id}
            );

            expect(response.success).toBe(true);
            expect(response.canvasId).toBe(canvas.id);
        });

        it('failed_when_canvas_switch_with_nonexistent_id', async () => {
            const response = await emitAndWaitResponse<CanvasSwitchPayload, CanvasSwitchedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_SWITCH,
                WebSocketResponseEvents.CANVAS_SWITCHED,
                {requestId: uuidv4(), canvasId: FAKE_UUID}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到');
        });
    });

    describe('Canvas 排序', () => {
        it('success_when_canvas_reordered', async () => {
            // 取得目前所有 Canvas（包括 default）
            await listCanvases(client);

            // 建立 3 個 Canvas
            const canvasA = await createCanvas(client, 'Canvas A');
            const canvasB = await createCanvas(client, 'Canvas B');
            const canvasC = await createCanvas(client, 'Canvas C');

            // 取得所有 Canvas ID
            const allCanvases = await listCanvases(client);
            const allIds = allCanvases.map(c => c.id);

            // 將新建的 3 個 Canvas 排序為 C, A, B，其他保持原位
            const otherIds = allIds.filter(id => id !== canvasA.id && id !== canvasB.id && id !== canvasC.id);
            const newOrder = [canvasC.id, canvasA.id, canvasB.id, ...otherIds];

            // 重新排序
            const reorderResponse = await reorderCanvases(client, newOrder);
            expect(reorderResponse.success).toBe(true);

            // 取得列表並驗證順序
            const canvases = await listCanvases(client);
            const ids = canvases.map(c => c.id);
            expect(ids.indexOf(canvasC.id)).toBeLessThan(ids.indexOf(canvasA.id));
            expect(ids.indexOf(canvasA.id)).toBeLessThan(ids.indexOf(canvasB.id));
        });

        it('success_when_canvas_list_returns_sorted_order', async () => {
            // 建立多個 Canvas
            const canvas1 = await createCanvas(client, 'Canvas 1');
            const canvas2 = await createCanvas(client, 'Canvas 2');
            const canvas3 = await createCanvas(client, 'Canvas 3');

            // 取得所有 Canvas ID
            const allCanvases = await listCanvases(client);
            const allIds = allCanvases.map(c => c.id);

            // 將新建的 3 個 Canvas 排序為 3, 1, 2，其他保持原位
            const otherIds = allIds.filter(id => id !== canvas1.id && id !== canvas2.id && id !== canvas3.id);
            const newOrder = [canvas3.id, canvas1.id, canvas2.id, ...otherIds];

            // 重新排序
            await reorderCanvases(client, newOrder);

            // 取得列表
            const canvases = await listCanvases(client);

            // 驗證列表依照 sortIndex 升序排列
            for (let i = 0; i < canvases.length - 1; i++) {
                expect(canvases[i].sortIndex).toBeLessThan(canvases[i + 1].sortIndex);
            }
        });

        it('success_when_new_canvas_added_to_end', async () => {
            // 建立 2 個 Canvas
            const canvas1 = await createCanvas(client, 'Canvas X');
            const canvas2 = await createCanvas(client, 'Canvas Y');

            // 取得所有 Canvas ID 並重新排序
            const allCanvases1 = await listCanvases(client);
            const allIds1 = allCanvases1.map(c => c.id);
            const otherIds1 = allIds1.filter(id => id !== canvas1.id && id !== canvas2.id);
            await reorderCanvases(client, [canvas2.id, canvas1.id, ...otherIds1]);

            // 再建立 1 個新 Canvas
            const newCanvas = await createCanvas(client, 'Canvas Z');

            // 取得列表
            const canvases = await listCanvases(client);

            // 找到新 Canvas
            const newCanvasInList = canvases.find(c => c.id === newCanvas.id);
            expect(newCanvasInList).toBeDefined();

            // 驗證新 Canvas 的 sortIndex 為最大值
            const maxSortIndex = Math.max(...canvases.map(c => c.sortIndex));
            expect(newCanvasInList!.sortIndex).toBe(maxSortIndex);

            // 驗證新 Canvas 在列表最後
            expect(canvases[canvases.length - 1].id).toBe(newCanvas.id);
        });

        it('failed_when_canvas_reorder_with_invalid_ids', async () => {
            // 建立 1 個 Canvas
            const canvas = await createCanvas(client, 'Valid Canvas');

            // 嘗試用包含不存在 ID 的陣列排序
            const response = await emitAndWaitResponse<CanvasReorderPayload, CanvasReorderedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_REORDER,
                WebSocketResponseEvents.CANVAS_REORDERED,
                {requestId: uuidv4(), canvasIds: [canvas.id, FAKE_UUID]}
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('failed_when_canvas_reorder_with_empty_array', async () => {
            // 嘗試用空陣列排序
            const response = await emitAndWaitResponse<CanvasReorderPayload, CanvasReorderedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_REORDER,
                WebSocketResponseEvents.CANVAS_REORDERED,
                {requestId: uuidv4(), canvasIds: []}
            );

            expect(response.success).toBe(false);
        });

        it('success_when_canvas_reorder_with_partial_ids', async () => {
            // 建立 3 個 Canvas
            const canvasP1 = await createCanvas(client, 'Partial_1');
            const canvasP2 = await createCanvas(client, 'Partial_2');
            const canvasP3 = await createCanvas(client, 'Partial_3');

            // 取得所有 Canvas
            await listCanvases(client);

            // 只排序其中 2 個 Canvas（P2, P1），P3 和其他 Canvas 保持原順序
            const partialOrder = [canvasP2.id, canvasP1.id];

            // 重新排序
            const reorderResponse = await reorderCanvases(client, partialOrder);
            expect(reorderResponse.success).toBe(true);

            // 取得列表並驗證順序
            const canvases = await listCanvases(client);
            const ids = canvases.map(c => c.id);

            // P2 應該在 P1 之前
            expect(ids.indexOf(canvasP2.id)).toBeLessThan(ids.indexOf(canvasP1.id));

            // P3 應該在 P1 和 P2 之後（因為沒被包含在排序中）
            expect(ids.indexOf(canvasP1.id)).toBeLessThan(ids.indexOf(canvasP3.id));
        });

        it('failed_when_canvas_reorder_with_duplicate_ids', async () => {
            // 建立 1 個 Canvas
            const canvas = await createCanvas(client, 'Duplicate_Test');

            // 嘗試用包含重複 ID 的陣列排序
            const response = await emitAndWaitResponse<CanvasReorderPayload, CanvasReorderedPayload>(
                client,
                WebSocketRequestEvents.CANVAS_REORDER,
                WebSocketResponseEvents.CANVAS_REORDERED,
                {requestId: uuidv4(), canvasIds: [canvas.id, canvas.id]}
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('重複');
        });
    });
});
