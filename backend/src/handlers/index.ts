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
import {
  handleOutputStyleList,
  handlePodBindOutputStyle,
  handlePodUnbindOutputStyle,
} from './outputStyleHandlers.js';
import {
  handleNoteCreate,
  handleNoteList,
  handleNoteUpdate,
  handleNoteDelete,
} from './noteHandlers.js';
import {
  handleSkillList,
  handleSkillNoteCreate,
  handleSkillNoteList,
  handleSkillNoteUpdate,
  handleSkillNoteDelete,
  handlePodBindSkill,
} from './skillHandlers.js';
import {
  handleConnectionCreate,
  handleConnectionList,
  handleConnectionDelete,
  handleConnectionUpdate,
} from './connectionHandlers.js';
import { handleWorkflowTrigger } from './workflowHandlers.js';

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

  // Output Style handlers
  socket.on(WebSocketRequestEvents.OUTPUT_STYLE_LIST, (payload) => {
    handleOutputStyleList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_BIND_OUTPUT_STYLE, (payload) => {
    handlePodBindOutputStyle(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_UNBIND_OUTPUT_STYLE, (payload) => {
    handlePodUnbindOutputStyle(socket, payload);
  });

  // Note handlers
  socket.on(WebSocketRequestEvents.NOTE_CREATE, (payload) => {
    handleNoteCreate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.NOTE_LIST, (payload) => {
    handleNoteList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.NOTE_UPDATE, (payload) => {
    handleNoteUpdate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.NOTE_DELETE, (payload) => {
    handleNoteDelete(socket, payload);
  });

  // Skill handlers
  socket.on(WebSocketRequestEvents.SKILL_LIST, (payload) => {
    handleSkillList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.SKILL_NOTE_CREATE, (payload) => {
    handleSkillNoteCreate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.SKILL_NOTE_LIST, (payload) => {
    handleSkillNoteList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.SKILL_NOTE_UPDATE, (payload) => {
    handleSkillNoteUpdate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.SKILL_NOTE_DELETE, (payload) => {
    handleSkillNoteDelete(socket, payload);
  });

  socket.on(WebSocketRequestEvents.POD_BIND_SKILL, (payload) => {
    handlePodBindSkill(socket, payload);
  });

  // Connection handlers
  socket.on(WebSocketRequestEvents.CONNECTION_CREATE, (payload) => {
    handleConnectionCreate(socket, payload);
  });

  socket.on(WebSocketRequestEvents.CONNECTION_LIST, (payload) => {
    handleConnectionList(socket, payload);
  });

  socket.on(WebSocketRequestEvents.CONNECTION_DELETE, (payload) => {
    handleConnectionDelete(socket, payload);
  });

  socket.on(WebSocketRequestEvents.CONNECTION_UPDATE, (payload) => {
    handleConnectionUpdate(socket, payload);
  });

  // Workflow handlers
  socket.on(WebSocketRequestEvents.WORKFLOW_TRIGGER, (payload) => {
    handleWorkflowTrigger(socket, payload);
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
  handleOutputStyleList,
  handlePodBindOutputStyle,
  handlePodUnbindOutputStyle,
  handleNoteCreate,
  handleNoteList,
  handleNoteUpdate,
  handleNoteDelete,
  handleSkillList,
  handleSkillNoteCreate,
  handleSkillNoteList,
  handleSkillNoteUpdate,
  handleSkillNoteDelete,
  handlePodBindSkill,
  handleConnectionCreate,
  handleConnectionList,
  handleConnectionDelete,
  handleConnectionUpdate,
  handleWorkflowTrigger,
};
