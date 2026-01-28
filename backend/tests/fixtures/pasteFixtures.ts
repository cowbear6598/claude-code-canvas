// Paste 相關測試資料
// 提供建立測試用 Canvas Paste Payload 的輔助函數

import { v4 as uuidv4 } from 'uuid';
import type {
  CanvasPastePayload,
  PastePodItem,
  PasteOutputStyleNoteItem,
  PasteSkillNoteItem,
  PasteRepositoryNoteItem,
  PasteSubAgentNoteItem,
  PasteConnectionItem,
  Pod,
  Connection,
  OutputStyleNote,
  SkillNote,
  RepositoryNote,
  SubAgentNote,
} from '../../src/types/index.js';

/**
 * 從 Pod 建立 PastePodItem
 */
export function createPastePodItemFromPod(pod: Pod): PastePodItem {
  return {
    originalId: pod.id,
    name: pod.name,
    type: pod.type,
    color: pod.color,
    x: pod.x,
    y: pod.y,
    rotation: pod.rotation,
    outputStyleId: pod.outputStyleId,
    skillIds: pod.skillIds,
    subAgentIds: pod.subAgentIds,
    model: pod.model,
    repositoryId: pod.repositoryId,
  };
}

/**
 * 從 Connection 建立 PasteConnectionItem
 */
export function createPasteConnectionItemFromConnection(
  connection: Connection
): PasteConnectionItem {
  return {
    originalSourcePodId: connection.sourcePodId,
    sourceAnchor: connection.sourceAnchor,
    originalTargetPodId: connection.targetPodId,
    targetAnchor: connection.targetAnchor,
    autoTrigger: connection.autoTrigger,
  };
}

/**
 * 從 OutputStyleNote 建立 PasteOutputStyleNoteItem
 */
export function createPasteOutputStyleNoteItemFromNote(
  note: OutputStyleNote
): PasteOutputStyleNoteItem {
  return {
    outputStyleId: note.outputStyleId,
    name: note.name,
    x: note.x,
    y: note.y,
    boundToOriginalPodId: note.boundToPodId,
    originalPosition: note.originalPosition,
  };
}

/**
 * 從 SkillNote 建立 PasteSkillNoteItem
 */
export function createPasteSkillNoteItemFromNote(note: SkillNote): PasteSkillNoteItem {
  return {
    skillId: note.skillId,
    name: note.name,
    x: note.x,
    y: note.y,
    boundToOriginalPodId: note.boundToPodId,
    originalPosition: note.originalPosition,
  };
}

/**
 * 從 RepositoryNote 建立 PasteRepositoryNoteItem
 */
export function createPasteRepositoryNoteItemFromNote(
  note: RepositoryNote
): PasteRepositoryNoteItem {
  return {
    repositoryId: note.repositoryId,
    name: note.name,
    x: note.x,
    y: note.y,
    boundToOriginalPodId: note.boundToPodId,
    originalPosition: note.originalPosition,
  };
}

/**
 * 從 SubAgentNote 建立 PasteSubAgentNoteItem
 */
export function createPasteSubAgentNoteItemFromNote(
  note: SubAgentNote
): PasteSubAgentNoteItem {
  return {
    subAgentId: note.subAgentId,
    name: note.name,
    x: note.x,
    y: note.y,
    boundToOriginalPodId: note.boundToPodId,
    originalPosition: note.originalPosition,
  };
}

/**
 * 建立測試用 Canvas Paste Payload
 */
export function createTestPastePayload(
  pods: Pod[],
  connections: Connection[],
  outputStyleNotes: OutputStyleNote[] = [],
  skillNotes: SkillNote[] = [],
  repositoryNotes: RepositoryNote[] = [],
  subAgentNotes: SubAgentNote[] = []
): CanvasPastePayload {
  return {
    requestId: uuidv4(),
    pods: pods.map(createPastePodItemFromPod),
    outputStyleNotes: outputStyleNotes.map(createPasteOutputStyleNoteItemFromNote),
    skillNotes: skillNotes.map(createPasteSkillNoteItemFromNote),
    repositoryNotes: repositoryNotes.map(createPasteRepositoryNoteItemFromNote),
    subAgentNotes: subAgentNotes.map(createPasteSubAgentNoteItemFromNote),
    connections: connections.map(createPasteConnectionItemFromConnection),
  };
}

/**
 * 建立簡單的測試 Paste Payload（只有 Pods）
 */
export function createSimpleTestPastePayload(podCount: number): CanvasPastePayload {
  const pods: PastePodItem[] = Array.from({ length: podCount }, (_, i) => ({
    originalId: uuidv4(),
    name: `Pasted Pod ${i + 1}`,
    type: 'General AI',
    color: 'blue',
    x: 100 + i * 200,
    y: 100 + i * 100,
    rotation: 0,
  }));

  return {
    requestId: uuidv4(),
    pods,
    outputStyleNotes: [],
    skillNotes: [],
    repositoryNotes: [],
    subAgentNotes: [],
    connections: [],
  };
}
