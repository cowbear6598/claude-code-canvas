import { vi } from 'vitest';

interface MockSummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
}

let mockResult: MockSummaryResult = { success: true, summary: 'Mock summary' };

export function setMockSummaryResult(result: MockSummaryResult): void {
  mockResult = result;
}

export function resetSummaryMock(): void {
  mockResult = { success: true, summary: 'Mock summary' };
}

const mockGenerateSummaryForTarget = vi.fn(
  async (
    canvasId: string,
    sourcePodId: string,
    targetPodId: string
  ): Promise<{
    targetPodId: string;
    summary: string;
    success: boolean;
    error?: string;
  }> => {
    return {
      targetPodId,
      summary: mockResult.summary || '',
      success: mockResult.success,
      error: mockResult.error,
    };
  }
);

vi.mock('../../src/services/summaryService.js', () => ({
  summaryService: {
    generateSummaryForTarget: mockGenerateSummaryForTarget,
  },
}));
