import type {
    WorkflowDirectWaitingPayload,
} from '../../types/index.js';
import type {
    TriggerStrategy,
    TriggerDecideContext,
    TriggerDecideResult,
    CollectSourcesContext,
    CollectSourcesResult,
} from './types.js';
import {podStore} from '../podStore.js';
import {directTriggerStore} from '../directTriggerStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries} from './workflowHelpers.js';

class WorkflowDirectTriggerService implements TriggerStrategy {
    readonly mode = 'direct' as const;

    private pendingResolvers: Map<string, (result: CollectSourcesResult) => void> = new Map();

    // 防止 resolver 永久懸掛
    private readonly MAX_PENDING_TIME = 30000;

    async decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]> {
        return context.connections.map((connection) => ({
            connectionId: connection.id,
            approved: true,
            reason: null,
        }));
    }

    async collectSources(context: CollectSourcesContext): Promise<CollectSourcesResult> {
        const {canvasId, sourcePodId, connection, summary} = context;
        const targetPodId = connection.targetPodId;

        const directCount = workflowStateService.getDirectConnectionCount(canvasId, targetPodId);

        if (directCount === 1) {
            logger.log('Workflow', 'Create', `Direct trigger from Pod ${sourcePodId} to Pod ${targetPodId}`);

            return {ready: true};
        }

        if (!directTriggerStore.hasDirectPending(targetPodId)) {
            directTriggerStore.initializeDirectPending(targetPodId);
        }

        directTriggerStore.recordDirectReady(targetPodId, sourcePodId, summary);

        const directWaitingPayload: WorkflowDirectWaitingPayload = {
            canvasId,
            connectionId: connection.id,
            sourcePodId,
            targetPodId,
        };
        workflowEventEmitter.emitDirectWaiting(canvasId, directWaitingPayload);

        const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
        const readySourcePodIds = readySummaries ? Array.from(readySummaries.keys()) : [];

        logger.log('Workflow', 'Update', `Multi-direct trigger: ${readySourcePodIds.length} sources ready for target ${targetPodId}, countdown started`);

        const existingResolver = this.pendingResolvers.has(targetPodId);

        if (existingResolver) {
            this.startCountdownTimer(canvasId, targetPodId);
            return {ready: false};
        }

        return new Promise<CollectSourcesResult>((resolve) => {
            this.pendingResolvers.set(targetPodId, resolve);
            this.startCountdownTimer(canvasId, targetPodId);

            setTimeout(() => {
                if (this.pendingResolvers.has(targetPodId)) {
                    logger.error('Workflow', 'Error', `Direct trigger 超時未完成，清理 ${targetPodId}`);
                    this.pendingResolvers.delete(targetPodId);
                    directTriggerStore.clearDirectPending(targetPodId);
                    resolve({ready: false});
                }
            }, this.MAX_PENDING_TIME);
        });
    }

    private startCountdownTimer(canvasId: string, targetPodId: string): void {
        if (directTriggerStore.hasActiveTimer(targetPodId)) {
            directTriggerStore.clearTimer(targetPodId);
        }

        const timer = setTimeout(() => {
            this.onTimerExpired(canvasId, targetPodId);
        }, 10000);

        directTriggerStore.setTimer(targetPodId, timer);
    }

    private onTimerExpired(canvasId: string, targetPodId: string): void {
        const resolver = this.pendingResolvers.get(targetPodId);
        if (!resolver) {
            return;
        }

        let resolverCalled = false;

        try {
            const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
            if (!readySummaries || readySummaries.size === 0) {
                resolver({ready: false});
                return;
            }

            const sourcePodIds = Array.from(readySummaries.keys());

            if (sourcePodIds.length === 1) {
                resolver({ready: true});
                return;
            }

            const mergedContent = formatMergedSummaries(
                readySummaries,
                (podId) => podStore.getById(canvasId, podId)
            );

            const mergedPayload = {
                canvasId,
                targetPodId,
                sourcePodIds,
                mergedContentPreview: mergedContent.substring(0, 200),
                countdownSeconds: 0,
            };

            workflowEventEmitter.emitDirectMerged(canvasId, mergedPayload);

            resolver({ready: true, mergedContent, isSummarized: true});
            resolverCalled = true;
        } catch (error) {
            logger.error('Workflow', 'Error', `Direct trigger timer 處理失敗: ${targetPodId}`, error);
            if (!resolverCalled) {
                resolver({ready: false});
            }
        } finally {
            this.pendingResolvers.delete(targetPodId);
            directTriggerStore.clearDirectPending(targetPodId);
        }
    }
}

export const workflowDirectTriggerService = new WorkflowDirectTriggerService();
