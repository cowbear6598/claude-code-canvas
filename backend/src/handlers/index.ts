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
import { repositoryHandlerGroup } from './groups/repositoryHandlerGroup.js';
import { subAgentHandlerGroup } from './groups/subAgentHandlerGroup.js';
import { autoClearHandlerGroup } from './groups/autoClearHandlerGroup.js';

const registry = new HandlerRegistry();

registry.registerGroup(podHandlerGroup);
registry.registerGroup(chatHandlerGroup);
registry.registerGroup(connectionHandlerGroup);
registry.registerGroup(workflowHandlerGroup);
registry.registerGroup(noteHandlerGroup);
registry.registerGroup(skillHandlerGroup);
registry.registerGroup(outputStyleHandlerGroup);
registry.registerGroup(pasteHandlerGroup);
registry.registerGroup(gitHandlerGroup);
registry.registerGroup(repositoryHandlerGroup);
registry.registerGroup(subAgentHandlerGroup);
registry.registerGroup(autoClearHandlerGroup);

export function registerAllHandlers(socket: Socket): void {
  registry.applyToSocket(socket);
}

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
  handleOutputStyleDelete,
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
  handleSkillDelete,
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
export {
  handleRepositoryList,
  handleRepositoryCreate,
  handleRepositoryNoteCreate,
  handleRepositoryNoteList,
  handleRepositoryNoteUpdate,
  handleRepositoryNoteDelete,
  handlePodBindRepository,
  handlePodUnbindRepository,
  handleRepositoryDelete,
} from './repositoryHandlers.js';
export {
  handleSubAgentList,
  handleSubAgentNoteCreate,
  handleSubAgentNoteList,
  handleSubAgentNoteUpdate,
  handleSubAgentNoteDelete,
  handlePodBindSubAgent,
  handleSubAgentDelete,
} from './subAgentHandlers.js';
export { handlePodSetAutoClear } from './autoClearHandlers.js';
