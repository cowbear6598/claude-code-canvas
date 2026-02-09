import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  disconnectSocket,
  waitForEvent,
  createSocketClientNoConnect,
  type TestServerInstance,
} from '../setup';
import { type ConnectionReadyPayload } from '../../src/types';

describe('測試環境設定', () => {
  let server: TestServerInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  it('測試伺服器成功啟動', () => {
    expect(server).toBeDefined();
    expect(server.server).toBeDefined();
    expect(server.baseUrl).toBeDefined();
    expect(server.wsUrl).toBeDefined();
    expect(server.port).toBeGreaterThan(0);
  });

  it('Socket 客戶端成功連線', async () => {
    const client = await createSocketClient(server.baseUrl, server.canvasId);
    expect(client.connected).toBe(true);
    await disconnectSocket(client);
  });

  it('成功接收連線就緒事件', async () => {
    const socket = createSocketClientNoConnect(server.baseUrl);
    // 在連線之前設置監聽器
    const readyPromise = waitForEvent<ConnectionReadyPayload>(socket, 'connection:ready');
    socket.connect();

    await socket.waitForOpen();
    const payload = await readyPromise;
    expect(payload.socketId).toBeDefined();
    await disconnectSocket(socket);
  });

  it('Socket 成功斷線', async () => {
    const client = await createSocketClient(server.baseUrl, server.canvasId);
    expect(client.connected).toBe(true);
    await disconnectSocket(client);
    expect(client.connected).toBe(false);
  });
});
