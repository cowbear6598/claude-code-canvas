import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestServer,
  closeTestServer,
  createSocketClient,
  disconnectSocket,
  waitForEvent,
  createSocketClientNoConnect,
  waitForConnection,
  type TestServerInstance,
} from '../setup/index.js';
import { type ConnectionReadyPayload } from '../../src/types/index.js';

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

  it('success_when_test_server_starts', () => {
    expect(server).toBeDefined();
    expect(server.httpServer).toBeDefined();
    expect(server.io).toBeDefined();
    expect(server.app).toBeDefined();
    expect(server.baseUrl).toBeDefined();
    expect(server.port).toBeGreaterThan(0);
  });

  it('success_when_socket_client_connects', async () => {
    const client = await createSocketClient(server.baseUrl, server.canvasId);
    expect(client.connected).toBe(true);
    await disconnectSocket(client);
  });

  it('success_when_connection_ready_event_received', async () => {
    const socket = createSocketClientNoConnect(server.baseUrl);
    const readyPromise = waitForEvent<ConnectionReadyPayload>(socket, 'connection:ready');
    const connectPromise = waitForConnection(socket);
    socket.connect();
    await connectPromise;
    const payload = await readyPromise;
    expect(payload.socketId).toBeDefined();
    await disconnectSocket(socket);
  });

  it('success_when_socket_disconnects', async () => {
    const client = await createSocketClient(server.baseUrl, server.canvasId);
    expect(client.connected).toBe(true);
    await disconnectSocket(client);
    expect(client.connected).toBe(false);
  });
});
