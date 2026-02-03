import type { Socket } from 'socket.io-client';

export async function getCanvasId(client: Socket): Promise<string> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  return canvasId;
}
