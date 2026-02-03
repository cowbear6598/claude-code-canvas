// Socket.io Client 輔助工具
// 提供 Socket.io Client 連線、事件等待和請求/回應模式的輔助函數

import { io, Socket } from 'socket.io-client';

/**
 * 建立並連線 Socket.io Client
 */
export async function createSocketClient(baseUrl: string): Promise<Socket> {
  const socket = io(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
  });

  // 等待連線成功
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return socket;
}

/**
 * 等待特定事件
 * 回傳 Promise 化的事件等待
 */
export function waitForEvent<T>(
  socket: Socket,
  eventName: string,
  timeout: number = 5000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    const handler = (data: T) => {
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(data);
    };

    socket.on(eventName, handler);
  });
}

/**
 * 發送請求並等待回應
 * 適用於 Request/Response 模式
 */
export async function emitAndWaitResponse<TReq, TRes>(
  socket: Socket,
  requestEvent: string,
  responseEvent: string,
  payload: TReq,
  timeout: number = 5000
): Promise<TRes> {
  // 先設定監聽器
  const responsePromise = waitForEvent<TRes>(socket, responseEvent, timeout);

  // 再發送請求
  socket.emit(requestEvent, payload);

  // 等待回應
  return responsePromise;
}

/**
 * 收集多個事件
 * 用於監聽會被多次觸發的事件（如 streaming）
 */
export function collectEvents<T>(
  socket: Socket,
  eventName: string,
  stopEvent: string,
  timeout: number = 5000
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const events: T[] = [];
    const timer = setTimeout(() => {
      socket.off(eventName, eventHandler);
      socket.off(stopEvent, stopHandler);
      reject(new Error(`Timeout collecting events: ${eventName}`));
    }, timeout);

    const eventHandler = (data: T) => {
      events.push(data);
    };

    const stopHandler = () => {
      clearTimeout(timer);
      socket.off(eventName, eventHandler);
      socket.off(stopEvent, stopHandler);
      resolve(events);
    };

    socket.on(eventName, eventHandler);
    socket.on(stopEvent, stopHandler);
  });
}

/**
 * 斷開 Socket 連線
 */
export function disconnectSocket(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    socket.on('disconnect', () => {
      resolve();
    });
    socket.disconnect();
  });
}

/**
 * 建立 Socket 但不自動連線
 * 適用於需要在連線前設定監聽器的情況
 */
export function createSocketClientNoConnect(baseUrl: string): Socket {
  return io(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
    autoConnect: false,
  });
}

/**
 * 等待 Socket 連線完成
 */
export async function waitForConnection(socket: Socket, timeout: number = 5000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
