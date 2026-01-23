// WebSocket Handlers Index
// Registers all WebSocket event handlers

import type { Socket } from 'socket.io';
import { WebSocketRequestEvents } from '../types/index.js';
import {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodUpdate,
  handlePodDelete,
} from './podHandlers.js';
import { handleGitClone } from './gitHandlers.js';
import { handleChatSend, handleChatHistory } from './chatHandlers.js';

/**
 * Register all WebSocket event handlers for a socket
 * @param socket Socket.io socket instance
 */
export function registerAllHandlers(socket: Socket): void {
  // Pod handlers
  socket.on(WebSocketRequestEvents.POD_CREATE, (payload) => {
    handlePodCreate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_LIST, (payload) => {
    handlePodList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_GET, (payload) => {
    handlePodGet(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_UPDATE, (payload) => {
    handlePodUpdate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_DELETE, (payload) => {
    handlePodDelete(socket, payload);
  });

  // Git handlers
  socket.on(WebSocketRequestEvents.POD_GIT_CLONE, (payload) => {
    handleGitClone(socket, payload);
  });

  // Chat handlers
  socket.on(WebSocketRequestEvents.POD_CHAT_SEND, (payload) => {
    handleChatSend(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_CHAT_HISTORY, (payload) => {
    handleChatHistory(socket, payload);
  });

  console.log(`[Handlers] Registered all handlers for socket ${socket.id}`);
}

// Re-export individual handlers for testing or direct use
export {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodUpdate,
  handlePodDelete,
  handleGitClone,
  handleChatSend,
  handleChatHistory,
};
