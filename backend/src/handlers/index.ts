import type { Socket } from 'socket.io';
import { HandlerRegistry } from './registry.js';
import { podHandlerGroup } from './groups/podHandlerGroup.js';
import { chatHandlerGroup } from './groups/chatHandlerGroup.js';
import { connectionHandlerGroup } from './groups/connectionHandlerGroup.js';
import { workflowHandlerGroup } from './groups/workflowHandlerGroup.js';
import { noteHandlerGroup } from './groups/noteHandlerGroup.js';
import { skillHandlerGroup } from './groups/skillHandlerGroup.js';
import { commandHandlerGroup } from './groups/commandHandlerGroup.js';
import { outputStyleHandlerGroup } from './groups/outputStyleHandlerGroup.js';
import { pasteHandlerGroup } from './groups/pasteHandlerGroup.js';
import { repositoryHandlerGroup } from './groups/repositoryHandlerGroup.js';
import { subAgentHandlerGroup } from './groups/subAgentHandlerGroup.js';
import { autoClearHandlerGroup } from './groups/autoClearHandlerGroup.js';
import { triggerHandlerGroup } from './groups/triggerHandlerGroup.js';
import { canvasHandlerGroup } from './groups/canvasHandlerGroup.js';

const registry = new HandlerRegistry();

registry.registerGroup(podHandlerGroup);
registry.registerGroup(chatHandlerGroup);
registry.registerGroup(connectionHandlerGroup);
registry.registerGroup(workflowHandlerGroup);
registry.registerGroup(noteHandlerGroup);
registry.registerGroup(skillHandlerGroup);
registry.registerGroup(commandHandlerGroup);
registry.registerGroup(outputStyleHandlerGroup);
registry.registerGroup(pasteHandlerGroup);
registry.registerGroup(repositoryHandlerGroup);
registry.registerGroup(subAgentHandlerGroup);
registry.registerGroup(autoClearHandlerGroup);
registry.registerGroup(triggerHandlerGroup);
registry.registerGroup(canvasHandlerGroup);

export function registerAllHandlers(socket: Socket): void {
  registry.applyToSocket(socket);
}
