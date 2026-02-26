import type {
    WorkflowDirectWaitingPayload,
    Connection,
} from '../../types/index.js';
import type {
    TriggerStrategy,
    TriggerDecideContext,
    TriggerDecideResult,
    CollectSourcesContext,
    CollectSourcesResult,
    TriggerLifecycleContext,
    CompletionContext,
    QueuedContext,
    QueueProcessedContext,
} from './types.js';
import {podStore} from '../podStore.js';
import {directTriggerStore} from '../directTriggerStore.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries, forEachDirectConnection, getDirectConnectionsForTarget} from './workflowHelpers.js';
import {connectionStore} from '../connectionStore.js';

class WorkflowDirectTriggerService implements TriggerStrategy {
    readonly mode = 'direct' as const;

    private pendingResolvers: Map<string, (result: CollectSourcesResult) => void> = new Map();

    // 防止 resolver 永久懸掛
    private readonly MAX_PENDING_TIME = 30000;

    // multi-direct 合併等待視窗
    private readonly MULTI_DIRECT_MERGE_WINDOW_MS = 10000;

    async decide(context: TriggerDecideContext): Promise<TriggerDecideResult[]> {
        return context.connections.map((connection) => ({
            connectionId: connection.id,
            approved: true,
            reason: null,
            isError: false,
        }));
    }

    async collectSources(context: CollectSourcesContext): Promise<CollectSourcesResult> {
        const {canvasId, sourcePodId, connection, summary} = context;
        const targetPodId = connection.targetPodId;

        const directCount = workflowStateService.getDirectConnectionCount(canvasId, targetPodId);

        if (directCount === 1) {
            return this.handleSingleDirectTrigger(canvasId, sourcePodId, targetPodId);
        }

        return this.handleMultiDirectTrigger(canvasId, sourcePodId, targetPodId, connection, summary);
    }

    private handleSingleDirectTrigger(canvasId: string, sourcePodId: string, targetPodId: string): CollectSourcesResult {
        const sourcePod = podStore.getById(canvasId, sourcePodId);
        const targetPod = podStore.getById(canvasId, targetPodId);
        logger.log('Workflow', 'Create', `Direct trigger from Pod "${sourcePod?.name ?? sourcePodId}" to Pod "${targetPod?.name ?? targetPodId}"`);
        return {ready: true};
    }

    private handleMultiDirectTrigger(
        canvasId: string,
        sourcePodId: string,
        targetPodId: string,
        connection: Connection,
        summary: string
    ): Promise<CollectSourcesResult> {
        if (!directTriggerStore.hasDirectPending(targetPodId)) {
            directTriggerStore.initializeDirectPending(targetPodId);
        }

        directTriggerStore.recordDirectReady(targetPodId, sourcePodId, summary);

        connectionStore.updateConnectionStatus(canvasId, connection.id, 'waiting');

        const directWaitingPayload: WorkflowDirectWaitingPayload = {
            canvasId,
            connectionId: connection.id,
            sourcePodId,
            targetPodId,
        };
        workflowEventEmitter.emitDirectWaiting(canvasId, directWaitingPayload);

        const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
        const readySourcePodIds = readySummaries ? Array.from(readySummaries.keys()) : [];

        const targetPod = podStore.getById(canvasId, targetPodId);
        logger.log('Workflow', 'Update', `Multi-direct trigger: ${readySourcePodIds.length} sources ready for target "${targetPod?.name ?? targetPodId}", countdown started`);

        if (this.pendingResolvers.has(targetPodId)) {
            this.startCountdownTimer(canvasId, targetPodId);
            return Promise.resolve({ready: false});
        }

        return new Promise<CollectSourcesResult>((resolve) => {
            this.pendingResolvers.set(targetPodId, resolve);
            this.startCountdownTimer(canvasId, targetPodId);
            this.createTimeoutGuard(canvasId, targetPodId, resolve);
        });
    }

    private createTimeoutGuard(
        canvasId: string,
        targetPodId: string,
        resolve: (result: CollectSourcesResult) => void
    ): void {
        setTimeout(() => {
            if (!this.pendingResolvers.has(targetPodId)) {
                return; // resolver 已被其他流程（10 秒 timer）處理，跳過
            }
            // 確認 targetPod 仍存在有效的 direct connections
            const directConns = getDirectConnectionsForTarget(canvasId, targetPodId);
            if (directConns.length === 0) {
                logger.warn('Workflow', 'Warn', `Direct trigger 30 秒超時：targetPod ${targetPodId} 已無 direct 連線，跳過`);
                this.pendingResolvers.delete(targetPodId);
                directTriggerStore.clearDirectPending(targetPodId);
                return;
            }
            logger.error('Workflow', 'Error', `Direct trigger 超時未完成，清理 ${targetPodId}`);
            this.pendingResolvers.delete(targetPodId);
            directTriggerStore.clearDirectPending(targetPodId);
            resolve({ready: false});
        }, this.MAX_PENDING_TIME);
    }

    private startCountdownTimer(canvasId: string, targetPodId: string): void {
        if (directTriggerStore.hasActiveTimer(targetPodId)) {
            directTriggerStore.clearTimer(targetPodId);
        }

        const timer = setTimeout(() => {
            this.onTimerExpired(canvasId, targetPodId);
        }, this.MULTI_DIRECT_MERGE_WINDOW_MS);

        directTriggerStore.setTimer(targetPodId, timer);
    }

    private onTimerExpired(canvasId: string, targetPodId: string): void {
        const resolver = this.pendingResolvers.get(targetPodId);
        if (!resolver) {
            return;
        }

        let resolverCalled = false;

        try {
            const result = this.processTimerResult(canvasId, targetPodId);
            resolver(result);
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

    private processTimerResult(canvasId: string, targetPodId: string): CollectSourcesResult {
        const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
        if (!readySummaries || readySummaries.size === 0) {
            return {ready: false};
        }

        const sourcePodIds = Array.from(readySummaries.keys());

        if (sourcePodIds.length === 1) {
            return {ready: true};
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

        return {ready: true, mergedContent, isSummarized: true};
    }

    onTrigger(context: TriggerLifecycleContext): void {
        forEachDirectConnection(context.canvasId, context.targetPodId, (directConn) => {
            workflowEventEmitter.emitDirectTriggered(context.canvasId, {
                canvasId: context.canvasId,
                connectionId: directConn.id,
                sourcePodId: directConn.sourcePodId,
                targetPodId: context.targetPodId,
                transferredContent: context.summary,
                isSummarized: context.isSummarized,
            });
        });
    }

    onComplete(context: CompletionContext, success: boolean, error?: string): void {
        forEachDirectConnection(context.canvasId, context.targetPodId, (directConn) => {
            workflowEventEmitter.emitWorkflowComplete(
                context.canvasId, directConn.id, directConn.sourcePodId,
                context.targetPodId, success, error, context.triggerMode
            );
            connectionStore.updateConnectionStatus(context.canvasId, directConn.id, 'idle');
        });
    }

    onError(context: CompletionContext, errorMessage: string): void {
        forEachDirectConnection(context.canvasId, context.targetPodId, (directConn) => {
            workflowEventEmitter.emitWorkflowComplete(
                context.canvasId, directConn.id, directConn.sourcePodId,
                context.targetPodId, false, errorMessage, context.triggerMode
            );
            connectionStore.updateConnectionStatus(context.canvasId, directConn.id, 'idle');
        });
    }

    onQueued(context: QueuedContext): void {
        forEachDirectConnection(context.canvasId, context.targetPodId, (directConn) => {
            connectionStore.updateConnectionStatus(context.canvasId, directConn.id, 'queued');
            workflowEventEmitter.emitWorkflowQueued(context.canvasId, {
                canvasId: context.canvasId,
                targetPodId: context.targetPodId,
                connectionId: directConn.id,
                sourcePodId: directConn.sourcePodId,
                position: context.position,
                queueSize: context.queueSize,
                triggerMode: context.triggerMode,
            });
        });
    }

    /**
     * 僅發送 WORKFLOW_QUEUE_PROCESSED 事件，不設定 connection 為 active。
     * active 狀態由 triggerWorkflowWithSummary 統一設定。
     */
    onQueueProcessed(context: QueueProcessedContext): void {
        forEachDirectConnection(context.canvasId, context.targetPodId, (directConn) => {
            workflowEventEmitter.emitWorkflowQueueProcessed(context.canvasId, {
                canvasId: context.canvasId,
                targetPodId: context.targetPodId,
                connectionId: directConn.id,
                sourcePodId: directConn.sourcePodId,
                remainingQueueSize: context.remainingQueueSize,
                triggerMode: context.triggerMode,
            });
        });
    }
}

export const workflowDirectTriggerService = new WorkflowDirectTriggerService();
