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
  createPastedConnections,
} from './paste/pasteHelpers.js';

export async function handleCanvasPaste(
  socket: Socket,
  payload: CanvasPastePayload,
  requestId: string
): Promise<void> {
  const { pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, connections } = payload;

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

  const createdConnections = createPastedConnections(connections, podIdMapping);

  const response: CanvasPasteResultPayload = {
    requestId,
    success: errors.length === 0,
    createdPods,
    createdOutputStyleNotes,
    createdSkillNotes,
    createdRepositoryNotes,
    createdSubAgentNotes,
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
    `Paste completed: ${createdPods.length} pods, ${createdOutputStyleNotes.length} output style notes, ${createdSkillNotes.length} skill notes, ${createdRepositoryNotes.length} repository notes, ${createdSubAgentNotes.length} subagent notes, ${createdConnections.length} connections, ${errors.length} errors`
  );
}
