// Note 相關測試資料
// 提供建立各種 Note Payload 的輔助函數

import { v4 as uuidv4 } from 'uuid';
import type {
  NoteCreatePayload,
  SkillNoteCreatePayload,
  RepositoryNoteCreatePayload,
  SubAgentNoteCreatePayload,
} from '../../src/types/index.js';

/**
 * 建立測試用 OutputStyle Note Payload
 */
export function createTestOutputStyleNotePayload(
  outputStyleId: string,
  overrides?: Partial<NoteCreatePayload>
): NoteCreatePayload {
  return {
    requestId: uuidv4(),
    outputStyleId,
    name: 'Test OutputStyle Note',
    x: 200,
    y: 200,
    boundToPodId: null,
    originalPosition: null,
    ...overrides,
  };
}

/**
 * 建立測試用 Skill Note Payload
 */
export function createTestSkillNotePayload(
  skillId: string,
  overrides?: Partial<SkillNoteCreatePayload>
): SkillNoteCreatePayload {
  return {
    requestId: uuidv4(),
    skillId,
    name: 'Test Skill Note',
    x: 200,
    y: 200,
    boundToPodId: null,
    originalPosition: null,
    ...overrides,
  };
}

/**
 * 建立測試用 Repository Note Payload
 */
export function createTestRepositoryNotePayload(
  repositoryId: string,
  overrides?: Partial<RepositoryNoteCreatePayload>
): RepositoryNoteCreatePayload {
  return {
    requestId: uuidv4(),
    repositoryId,
    name: 'Test Repository Note',
    x: 200,
    y: 200,
    boundToPodId: null,
    originalPosition: null,
    ...overrides,
  };
}

/**
 * 建立測試用 SubAgent Note Payload
 */
export function createTestSubAgentNotePayload(
  subAgentId: string,
  overrides?: Partial<SubAgentNoteCreatePayload>
): SubAgentNoteCreatePayload {
  return {
    requestId: uuidv4(),
    subAgentId,
    name: 'Test SubAgent Note',
    x: 200,
    y: 200,
    boundToPodId: null,
    originalPosition: null,
    ...overrides,
  };
}

/**
 * 建立綁定到 Pod 的 OutputStyle Note Payload
 */
export function createBoundOutputStyleNotePayload(
  outputStyleId: string,
  podId: string,
  podX: number,
  podY: number
): NoteCreatePayload {
  return createTestOutputStyleNotePayload(outputStyleId, {
    boundToPodId: podId,
    originalPosition: { x: podX + 50, y: podY + 50 },
    x: podX + 50,
    y: podY + 50,
  });
}

/**
 * 建立綁定到 Pod 的 Skill Note Payload
 */
export function createBoundSkillNotePayload(
  skillId: string,
  podId: string,
  podX: number,
  podY: number
): SkillNoteCreatePayload {
  return createTestSkillNotePayload(skillId, {
    boundToPodId: podId,
    originalPosition: { x: podX + 50, y: podY + 50 },
    x: podX + 50,
    y: podY + 50,
  });
}

/**
 * 建立綁定到 Pod 的 Repository Note Payload
 */
export function createBoundRepositoryNotePayload(
  repositoryId: string,
  podId: string,
  podX: number,
  podY: number
): RepositoryNoteCreatePayload {
  return createTestRepositoryNotePayload(repositoryId, {
    boundToPodId: podId,
    originalPosition: { x: podX + 50, y: podY + 50 },
    x: podX + 50,
    y: podY + 50,
  });
}

/**
 * 建立綁定到 Pod 的 SubAgent Note Payload
 */
export function createBoundSubAgentNotePayload(
  subAgentId: string,
  podId: string,
  podX: number,
  podY: number
): SubAgentNoteCreatePayload {
  return createTestSubAgentNotePayload(subAgentId, {
    boundToPodId: podId,
    originalPosition: { x: podX + 50, y: podY + 50 },
    x: podX + 50,
    y: podY + 50,
  });
}
