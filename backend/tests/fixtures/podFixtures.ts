// Pod 相關測試資料
// 提供建立測試用 Pod Payload 的輔助函數

import type { PodColor, PodTypeName, ModelType } from '../../src/types/index.js';
import type { PodCreatePayload } from '../../src/types/index.js';
import { v4 as uuidv4 } from 'uuid';

// 有效的 Pod 顏色列表
export const VALID_POD_COLORS: PodColor[] = ['blue', 'coral', 'pink', 'yellow', 'green'];

// 有效的 Pod 類型列表
export const VALID_POD_TYPES: PodTypeName[] = [
  'Code Assistant',
  'Chat Companion',
  'Creative Writer',
  'Data Analyst',
  'General AI',
];

// 有效的 Model 類型列表
export const VALID_MODEL_TYPES: ModelType[] = ['opus', 'sonnet', 'haiku'];

/**
 * 建立測試用 Pod Payload
 */
export function createTestPodPayload(overrides?: Partial<PodCreatePayload>): PodCreatePayload {
  return {
    requestId: uuidv4(),
    name: 'Test Pod',
    type: 'General AI',
    color: 'blue',
    x: 100,
    y: 100,
    rotation: 0,
    ...overrides,
  };
}

/**
 * 建立多個測試 Pod Payload
 */
export function createTestPodPayloads(count: number): PodCreatePayload[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPodPayload({
      name: `Test Pod ${i + 1}`,
      x: 100 + i * 200,
      y: 100 + i * 100,
    })
  );
}

/**
 * 建立隨機的測試 Pod Payload
 */
export function createRandomTestPodPayload(): PodCreatePayload {
  const randomColor = VALID_POD_COLORS[Math.floor(Math.random() * VALID_POD_COLORS.length)];
  const randomType = VALID_POD_TYPES[Math.floor(Math.random() * VALID_POD_TYPES.length)];

  return createTestPodPayload({
    name: `Random Pod ${Date.now()}`,
    type: randomType,
    color: randomColor,
    x: Math.floor(Math.random() * 1000),
    y: Math.floor(Math.random() * 1000),
    rotation: Math.floor(Math.random() * 360),
  });
}
