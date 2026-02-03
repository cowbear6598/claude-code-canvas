import type { Pod, PodColor, ModelType } from '../pod.js';

export interface PastePodItem {
  originalId: string;
  name: string;
  color: PodColor;
  x: number;
  y: number;
  rotation: number;
  outputStyleId?: string | null;
  skillIds?: string[];
  subAgentIds?: string[];
  model?: ModelType;
  repositoryId?: string | null;
  commandId?: string | null;
}

interface PasteNoteItemBase {
  name: string;
  x: number;
  y: number;
  boundToOriginalPodId: string | null;
  originalPosition: { x: number; y: number } | null;
}

export interface PasteOutputStyleNoteItem extends PasteNoteItemBase {
  outputStyleId: string;
}

export interface PasteSkillNoteItem extends PasteNoteItemBase {
  skillId: string;
}

export interface PasteRepositoryNoteItem extends PasteNoteItemBase {
  repositoryId: string;
}

export interface PasteSubAgentNoteItem extends PasteNoteItemBase {
  subAgentId: string;
}

export interface PasteCommandNoteItem extends PasteNoteItemBase {
  commandId: string;
}

export interface PasteConnectionItem {
  originalSourcePodId: string;
  sourceAnchor: import('../connection.js').AnchorPosition;
  originalTargetPodId: string;
  targetAnchor: import('../connection.js').AnchorPosition;
  autoTrigger?: boolean;
}

export interface CanvasPastePayload {
  requestId: string;
  canvasId: string;
  pods: PastePodItem[];
  outputStyleNotes: PasteOutputStyleNoteItem[];
  skillNotes: PasteSkillNoteItem[];
  repositoryNotes: PasteRepositoryNoteItem[];
  subAgentNotes: PasteSubAgentNoteItem[];
  commandNotes: PasteCommandNoteItem[];
  connections: PasteConnectionItem[];
}

export interface PasteError {
  type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote';
  originalId: string;
  error: string;
}

export interface CanvasPasteResultPayload {
  requestId: string;
  success: boolean;
  createdPods: Pod[];
  createdOutputStyleNotes: import('../outputStyleNote.js').OutputStyleNote[];
  createdSkillNotes: import('../skillNote.js').SkillNote[];
  createdRepositoryNotes: import('../repositoryNote.js').RepositoryNote[];
  createdSubAgentNotes: import('../subAgentNote.js').SubAgentNote[];
  createdCommandNotes: import('../commandNote.js').CommandNote[];
  createdConnections: import('../connection.js').Connection[];
  podIdMapping: Record<string, string>;
  errors: PasteError[];
  error?: string;
}
