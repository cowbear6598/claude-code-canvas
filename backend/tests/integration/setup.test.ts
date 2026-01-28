// 測試基礎設施驗證測試
// 驗證測試 Server、Socket Client 和基本功能是否正常運作

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Socket } from 'socket.io-client';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  createSocketClientNoConnect,
  waitForConnection,
  waitForEvent,
  disconnectSocket,
  type TestServerInstance,
} from '../setup/index.js';
import { WebSocketResponseEvents } from '../../src/types/index.js';

describe('測試基礎設施驗證', () => {
  let server: TestServerInstance;
  let client: Socket;

  beforeAll(async () => {
    // 建立測試 Server
    server = await createTestServer();
  });

  afterAll(async () => {
    // 關閉 Socket Client
    if (client && client.connected) {
      await disconnectSocket(client);
    }

    // 關閉測試 Server
    if (server) {
      await closeTestServer(server);
    }
  });

  it('應能成功啟動測試 Server', () => {
    expect(server).toBeDefined();
    expect(server.httpServer).toBeDefined();
    expect(server.io).toBeDefined();
    expect(server.app).toBeDefined();
    expect(server.baseUrl).toMatch(/http:\/\/localhost:\d+/);
    expect(server.port).toBeGreaterThan(0);
  });

  it('應能建立 Socket Client 並連線', async () => {
    client = await createSocketClient(server.baseUrl);
    expect(client).toBeDefined();
    expect(client.connected).toBe(true);
  });

  it('連線後應收到 connection:ready 事件', async () => {
    // 建立 Socket 但不自動連線
    const testClient = createSocketClientNoConnect(server.baseUrl);

    // 先設定監聽器
    const readyPromise = waitForEvent(testClient, WebSocketResponseEvents.CONNECTION_READY);

    // 再連線
    testClient.connect();
    await waitForConnection(testClient);

    // 等待 connection:ready 事件
    const payload = await readyPromise;

    expect(payload).toBeDefined();
    expect(payload).toHaveProperty('socketId');

    // 清理
    await disconnectSocket(testClient);
  });

  it('應能正常斷開連線', async () => {
    const testClient = await createSocketClient(server.baseUrl);
    expect(testClient.connected).toBe(true);

    await disconnectSocket(testClient);
    expect(testClient.connected).toBe(false);
  });
});
