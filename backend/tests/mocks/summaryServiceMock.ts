interface MockSummaryResult {
    success: boolean;
    summary?: string;
    error?: string;
}

let mockResult: MockSummaryResult = {success: true, summary: 'Mock summary'};

const mockGenerateSummaryForTarget = vi.fn(
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

vi.mock('../../src/services/summaryService.js', () => ({
    summaryService: {
        generateSummaryForTarget: mockGenerateSummaryForTarget,
    },
}));
