import type { Pod } from '../pod.js';
import type { OutputStyleNote } from '../outputStyleNote.js';
import type { SkillNote } from '../skillNote.js';
import type { RepositoryNote } from '../repositoryNote.js';
import type { SubAgentNote } from '../subAgentNote.js';
import type { CommandNote } from '../commandNote.js';
import type { Connection } from '../connection.js';

export interface PasteError {
  type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote';
  originalId: string;
  error: string;
}

export interface CanvasPasteResultPayload {
  requestId: string;
  success: boolean;
  createdPods: Pod[];
  createdOutputStyleNotes: OutputStyleNote[];
  createdSkillNotes: SkillNote[];
  createdRepositoryNotes: RepositoryNote[];
  createdSubAgentNotes: SubAgentNote[];
  createdCommandNotes: CommandNote[];
  createdConnections: Connection[];
  podIdMapping: Record<string, string>;
  errors: PasteError[];
  error?: string;
}
