import {mock} from 'bun:test';

interface MockSummaryResult {
    success: boolean;
    summary?: string;
    error?: string;
}

let mockResult: MockSummaryResult = {success: true, summary: 'Mock summary'};

const mockGenerateSummaryForTarget = mock(
    async (
        _canvasId: string,
        _sourcePodId: string,
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

mock.module('../../src/services/summaryService.js', () => ({
    summaryService: {
        generateSummaryForTarget: mockGenerateSummaryForTarget,
    },
}));
