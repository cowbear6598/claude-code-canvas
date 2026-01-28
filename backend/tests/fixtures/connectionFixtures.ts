// Connection 相關測試資料
// 提供建立測試用 Connection Payload 的輔助函數

import type { AnchorPosition } from '../../src/types/index.js';
import type { ConnectionCreatePayload } from '../../src/types/index.js';
import { v4 as uuidv4 } from 'uuid';

// 有效的 Anchor 位置列表
export const VALID_ANCHOR_POSITIONS: AnchorPosition[] = ['top', 'bottom', 'left', 'right'];

/**
 * 建立測試用 Connection Payload
 */
export function createTestConnectionPayload(
  sourcePodId: string,
  targetPodId: string,
  overrides?: Partial<ConnectionCreatePayload>
): ConnectionCreatePayload {
  return {
    requestId: uuidv4(),
    sourcePodId,
    sourceAnchor: 'bottom',
    targetPodId,
    targetAnchor: 'top',
    ...overrides,
  };
}

/**
 * 建立隨機的測試 Connection Payload
 */
export function createRandomTestConnectionPayload(
  sourcePodId: string,
  targetPodId: string
): ConnectionCreatePayload {
  const randomSourceAnchor =
    VALID_ANCHOR_POSITIONS[Math.floor(Math.random() * VALID_ANCHOR_POSITIONS.length)];
  const randomTargetAnchor =
    VALID_ANCHOR_POSITIONS[Math.floor(Math.random() * VALID_ANCHOR_POSITIONS.length)];

  return createTestConnectionPayload(sourcePodId, targetPodId, {
    sourceAnchor: randomSourceAnchor,
    targetAnchor: randomTargetAnchor,
  });
}
