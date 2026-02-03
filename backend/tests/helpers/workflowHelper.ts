import type { Socket } from 'socket.io-client';
import { createPod } from './podHelper.js';
import { createConnection } from './connectionHelper.js';
import type { Pod, Connection } from '../../src/types/index.js';

export async function createWorkflowChain(
  client: Socket,
  count: number,
  autoTrigger?: boolean
): Promise<{ pods: Pod[]; connections: Connection[] }> {
  if (count < 2) {
    throw new Error('工作流鏈至少需要 2 個 Pod');
  }

  const pods: Pod[] = [];
  const connections: Connection[] = [];

  for (let i = 0; i < count; i++) {
    const pod = await createPod(client, {
      name: `Pod ${String.fromCharCode(65 + i)}`,
      x: i * 200,
      y: 0,
    });
    pods.push(pod);
  }

  for (let i = 0; i < count - 1; i++) {
    const connection = await createConnection(client, pods[i].id, pods[i + 1].id);
    connections.push(connection);
  }

  return { pods, connections };
}

export async function setPodStatus(
  client: Socket,
  podId: string,
  status: 'idle' | 'chatting' | 'summarizing' | 'error'
): Promise<void> {
  console.warn(`setPodStatus 目前不支援透過 WebSocket 設定，僅用於測試規劃`);
}
