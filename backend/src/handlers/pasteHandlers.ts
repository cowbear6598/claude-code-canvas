import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type CanvasPasteResultPayload,
  type PasteError,
} from '../types/index.js';
import type { CanvasPastePayload } from '../schemas/index.js';
import { emitSuccess } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import {
  createPastedPods,
  createPastedOutputStyleNotes,
  createPastedSkillNotes,
  createPastedRepositoryNotes,
  createPastedSubAgentNotes,
  createPastedCommandNotes,
  createPastedConnections,
} from './paste/pasteHelpers.js';
import { podStore } from '../services/podStore.js';

export async function handleCanvasPaste(
  socket: Socket,
  payload: CanvasPastePayload,
  requestId: string
): Promise<void> {
  const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, commandNotes, connections } = payload;

  const podIdMapping: Record<string, string> = {};
  const errors: PasteError[] = [];

  const createdPods = await createPastedPods(pods, podIdMapping, errors);

  const outputStyleNotesResult = createPastedOutputStyleNotes(outputStyleNotes, podIdMapping);
  const createdOutputStyleNotes = outputStyleNotesResult.notes;
  errors.push(...outputStyleNotesResult.errors);

  const skillNotesResult = createPastedSkillNotes(skillNotes, podIdMapping);
  const createdSkillNotes = skillNotesResult.notes;
  errors.push(...skillNotesResult.errors);

  const repositoryNotesResult = createPastedRepositoryNotes(repositoryNotes, podIdMapping);
  const createdRepositoryNotes = repositoryNotesResult.notes;
  errors.push(...repositoryNotesResult.errors);

  const subAgentNotesResult = createPastedSubAgentNotes(subAgentNotes, podIdMapping);
  const createdSubAgentNotes = subAgentNotesResult.notes;
  errors.push(...subAgentNotesResult.errors);

  const commandNotesResult = createPastedCommandNotes(commandNotes ?? [], podIdMapping);
  const createdCommandNotes = commandNotesResult.notes;
  errors.push(...commandNotesResult.errors);

  const createdConnections = createPastedConnections(connections, podIdMapping);

  // 後處理：從 command notes 補齊 Pod 的 commandId
  for (const note of createdCommandNotes) {
    if (note.boundToPodId) {
      const pod = podStore.getById(note.boundToPodId);
      if (pod && !pod.commandId) {
        podStore.setCommandId(note.boundToPodId, note.commandId);
      }
    }
  }

  const response: CanvasPasteResultPayload = {
    requestId,
    success: errors.length === 0,
    createdPods,
    createdOutputStyleNotes,
    createdSkillNotes,
    createdRepositoryNotes,
    createdSubAgentNotes,
    createdCommandNotes,
    createdConnections,
    podIdMapping,
    errors,
  };

  if (errors.length > 0) {
    response.error = `貼上完成，但有 ${errors.length} 個錯誤`;
  }

  emitSuccess(socket, WebSocketResponseEvents.CANVAS_PASTE_RESULT, response);

  logger.log(
    'Paste',
    'Complete',
    `Paste completed: ${createdPods.length} pods, ${createdOutputStyleNotes.length} output style notes, ${createdSkillNotes.length} skill notes, ${createdRepositoryNotes.length} repository notes, ${createdSubAgentNotes.length} subagent notes, ${createdCommandNotes.length} command notes, ${createdConnections.length} connections, ${errors.length} errors`
  );
}
