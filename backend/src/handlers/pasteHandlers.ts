import {WebSocketResponseEvents} from '../schemas';
import type {
    CanvasPasteResultPayload,
    PasteError,
    OutputStyleNote,
    SkillNote,
    RepositoryNote,
    SubAgentNote,
    CommandNote,
} from '../types';
import type {CanvasPastePayload} from '../schemas';
import {socketService} from '../services/socketService.js';
import {logger} from '../utils/logger.js';
import {withCanvasId} from '../utils/handlerHelpers.js';
import {
    createPastedPods,
    createPastedNotesByType,
    createPastedConnections,
    type NotePasteType,
} from './paste/pasteHelpers.js';
import {podStore} from '../services/podStore.js';

export const handleCanvasPaste = withCanvasId<CanvasPastePayload>(
    WebSocketResponseEvents.CANVAS_PASTE_RESULT,
    async (_connectionId: string, canvasId: string, payload: CanvasPastePayload, requestId: string): Promise<void> => {
        const {pods, outputStyleNotes, skillNotes, repositoryNotes, subAgentNotes, commandNotes, connections} = payload;

        const podIdMapping: Record<string, string> = {};
        const errors: PasteError[] = [];

        const createdPods = await createPastedPods(canvasId, pods, podIdMapping, errors);

        type NoteTypeInput = { type: NotePasteType; notes: Parameters<typeof createPastedNotesByType>[2] }

        const noteTypeInputs: NoteTypeInput[] = [
            { type: 'outputStyle', notes: outputStyleNotes },
            { type: 'skill', notes: skillNotes },
            { type: 'repository', notes: repositoryNotes },
            { type: 'subAgent', notes: subAgentNotes },
            { type: 'command', notes: commandNotes ?? [] },
        ]

        const noteResults = noteTypeInputs.map(({ type, notes }) =>
            createPastedNotesByType(type, canvasId, notes, podIdMapping)
        )
        errors.push(...noteResults.flatMap(r => r.errors))

        const createdOutputStyleNotes = noteResults[0]!.notes as OutputStyleNote[]
        const createdSkillNotes = noteResults[1]!.notes as SkillNote[]
        const createdRepositoryNotes = noteResults[2]!.notes as RepositoryNote[]
        const createdSubAgentNotes = noteResults[3]!.notes as SubAgentNote[]
        const createdCommandNotes = noteResults[4]!.notes as CommandNote[]

        const createdConnections = createPastedConnections(canvasId, connections, podIdMapping);

        for (const note of createdCommandNotes) {
            if (note.boundToPodId) {
                const pod = podStore.getById(canvasId, note.boundToPodId);
                if (pod && !pod.commandId) {
                    podStore.setCommandId(canvasId, note.boundToPodId, note.commandId);
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

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CANVAS_PASTE_RESULT, response);

        logger.log(
            'Paste',
            'Complete',
            `Paste completed: ${createdPods.length} pods, ${createdOutputStyleNotes.length} output style notes, ${createdSkillNotes.length} skill notes, ${createdRepositoryNotes.length} repository notes, ${createdSubAgentNotes.length} subagent notes, ${createdCommandNotes.length} command notes, ${createdConnections.length} connections, ${errors.length} errors`
        );
    }
);
