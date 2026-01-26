// WebSocket Handlers Index
// Registers all WebSocket event handlers using HandlerRegistry

import type { Socket } from 'socket.io';
import { HandlerRegistry } from './registry.js';
import { podHandlerGroup } from './groups/podHandlerGroup.js';
import { chatHandlerGroup } from './groups/chatHandlerGroup.js';
import { connectionHandlerGroup } from './groups/connectionHandlerGroup.js';
import { workflowHandlerGroup } from './groups/workflowHandlerGroup.js';
import { noteHandlerGroup } from './groups/noteHandlerGroup.js';
import { skillHandlerGroup } from './groups/skillHandlerGroup.js';
import { outputStyleHandlerGroup } from './groups/outputStyleHandlerGroup.js';
import { pasteHandlerGroup } from './groups/pasteHandlerGroup.js';
import { gitHandlerGroup } from './groups/gitHandlerGroup.js';

// Create and configure the registry
const registry = new HandlerRegistry();

// Register all handler groups
registry.registerGroup(podHandlerGroup);
registry.registerGroup(chatHandlerGroup);
registry.registerGroup(connectionHandlerGroup);
registry.registerGroup(workflowHandlerGroup);
registry.registerGroup(noteHandlerGroup);
registry.registerGroup(skillHandlerGroup);
registry.registerGroup(outputStyleHandlerGroup);
registry.registerGroup(pasteHandlerGroup);
registry.registerGroup(gitHandlerGroup);

/**
 * Register all WebSocket event handlers for a socket
 * @param socket Socket.io socket instance
 */
export function registerAllHandlers(socket: Socket): void {
  registry.applyToSocket(socket);
}

// Re-export individual handlers for testing or direct use
export {
  handlePodCreate,
  handlePodList,
  handlePodGet,
  handlePodUpdate,
  handlePodDelete,
} from './podHandlers.js';
export { handleGitClone } from './gitHandlers.js';
export { handleChatSend, handleChatHistory } from './chatHandlers.js';
export {
  handleOutputStyleList,
  handlePodBindOutputStyle,
  handlePodUnbindOutputStyle,
} from './outputStyleHandlers.js';
export {
  handleNoteCreate,
  handleNoteList,
  handleNoteUpdate,
  handleNoteDelete,
} from './noteHandlers.js';
export {
  handleSkillList,
  handleSkillNoteCreate,
  handleSkillNoteList,
  handleSkillNoteUpdate,
  handleSkillNoteDelete,
  handlePodBindSkill,
} from './skillHandlers.js';
export {
  handleConnectionCreate,
  handleConnectionList,
  handleConnectionDelete,
  handleConnectionUpdate,
} from './connectionHandlers.js';
export {
  handleWorkflowGetDownstreamPods,
  handleWorkflowClear,
} from './workflowHandlers.js';
export { handleCanvasPaste } from './pasteHandlers.js';
