import type {
  WorkflowDirectTriggeredPayload,
  WorkflowDirectWaitingPayload,
  Connection,
} from '../../types';
import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {directTriggerStore} from '../directTriggerStore.js';
import {workflowQueueService} from './workflowQueueService.js';
import {workflowStateService} from './workflowStateService.js';
import {workflowEventEmitter} from './workflowEventEmitter.js';
import {logger} from '../../utils/logger.js';
import {formatMergedSummaries} from './workflowHelpers.js';

class WorkflowDirectTriggerService {

  async processDirectConnections(
    canvasId: string,
    sourcePodId: string,
    connections: Connection[],
    processDirectTrigger: (canvasId: string, sourcePodId: string, connection: Connection) => Promise<void>
  ): Promise<void> {
    for (const connection of connections) {
      await processDirectTrigger(canvasId, sourcePodId, connection);
    }
  }

  async processDirectTriggerConnection(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    generateSummary: (canvasId: string, sourcePodId: string, targetPodId: string) => Promise<{ content: string; isSummarized: boolean } | null>,
    handleSingle: (canvasId: string, sourcePodId: string, connection: Connection, summary: string, isSummarized: boolean) => Promise<void>,
    handleMulti: (canvasId: string, sourcePodId: string, connection: Connection, summary: string, isSummarized: boolean) => Promise<void>
  ): Promise<void> {
    const result = await generateSummary(canvasId, sourcePodId, connection.targetPodId);
    if (!result) {
      return;
    }

    const directCount = workflowStateService.getDirectConnectionCount(canvasId, connection.targetPodId);

    if (directCount === 1) {
      await handleSingle(canvasId, sourcePodId, connection, result.content, result.isSummarized);
    } else {
      await handleMulti(canvasId, sourcePodId, connection, result.content, result.isSummarized);
    }
  }

  async handleSingleDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    isSummarized: boolean,
    triggerWithSummary: (canvasId: string, connectionId: string, summary: string, isSummarized: boolean, skipAutoTriggeredEvent?: boolean) => Promise<void>
  ): Promise<void> {
    const targetPod = podStore.getById(canvasId, connection.targetPodId);
    if (!targetPod) {
      return;
    }

    if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
      logger.log('Workflow', 'Update', `Target Pod ${connection.targetPodId} is busy, enqueuing direct trigger`);

      workflowQueueService.enqueue({
        canvasId,
        connectionId: connection.id,
        sourcePodId,
        targetPodId: connection.targetPodId,
        summary,
        isSummarized,
        triggerMode: 'direct',
      });
      return;
    }

    const payload: WorkflowDirectTriggeredPayload = {
      canvasId,
      connectionId: connection.id,
      sourcePodId,
      targetPodId: connection.targetPodId,
      transferredContent: summary,
      isSummarized,
    };

    workflowEventEmitter.emitDirectTriggered(canvasId, payload);

    logger.log('Workflow', 'Create', `Direct trigger from Pod ${sourcePodId} to Pod ${connection.targetPodId}`);

    await triggerWithSummary(canvasId, connection.id, summary, isSummarized, true);
  }

  async handleMultiDirectTrigger(
    canvasId: string,
    sourcePodId: string,
    connection: Connection,
    summary: string,
    _isSummarized: boolean,
    handleTimerExpired: (canvasId: string, targetPodId: string) => Promise<void>
  ): Promise<void> {
    const targetPodId = connection.targetPodId;

    if (!directTriggerStore.hasDirectPending(targetPodId)) {
      directTriggerStore.initializeDirectPending(targetPodId);

      const targetPod = podStore.getById(canvasId, targetPodId);
      if (targetPod && targetPod.status === 'idle') {
        podStore.setStatus(canvasId, targetPodId, 'chatting');
      }
    }

    directTriggerStore.recordDirectReady(targetPodId, sourcePodId, summary);

    // 發送 WORKFLOW_DIRECT_WAITING 事件，讓連線進入 waiting 狀態
    const directWaitingPayload: WorkflowDirectWaitingPayload = {
      canvasId,
      connectionId: connection.id,
      sourcePodId,
      targetPodId: connection.targetPodId,
    };
    workflowEventEmitter.emitDirectWaiting(canvasId, directWaitingPayload);

    if (directTriggerStore.hasActiveTimer(targetPodId)) {
      directTriggerStore.clearTimer(targetPodId);
    }

    const timer = setTimeout(() => {
      handleTimerExpired(canvasId, targetPodId).catch((error) => {
        logger.error('Workflow', 'Error', `Failed to handle direct timer expired for ${targetPodId}`, error);
      });
    }, 10000);

    directTriggerStore.setTimer(targetPodId, timer);

    const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
    const readySourcePodIds = readySummaries ? Array.from(readySummaries.keys()) : [];

    logger.log('Workflow', 'Update', `Multi-direct trigger: ${readySourcePodIds.length} sources ready for target ${targetPodId}, countdown started`);
  }

  async handleDirectTimerExpired(
    canvasId: string,
    targetPodId: string,
    triggerWithSummary: (canvasId: string, connectionId: string, summary: string, isSummarized: boolean, skipAutoTriggeredEvent?: boolean) => Promise<void>
  ): Promise<void> {
    const readySummaries = directTriggerStore.getReadySummaries(targetPodId);
    if (!readySummaries || readySummaries.size === 0) {
      directTriggerStore.clearDirectPending(targetPodId);
      return;
    }

    const sourcePodIds = Array.from(readySummaries.keys());
    const incomingConnections = connectionStore.findByTargetPodId(canvasId, targetPodId);

    if (sourcePodIds.length === 1) {
      const [singleSourcePodId] = sourcePodIds;
      const singleSummary = readySummaries.get(singleSourcePodId)!;

      const directConnection = incomingConnections.find(
        (conn) => conn.triggerMode === 'direct' && conn.sourcePodId === singleSourcePodId
      );

      if (directConnection) {
        // 發送 WORKFLOW_DIRECT_TRIGGERED 事件
        const payload: WorkflowDirectTriggeredPayload = {
          canvasId,
          connectionId: directConnection.id,
          sourcePodId: singleSourcePodId,
          targetPodId,
          transferredContent: singleSummary,
          isSummarized: true,
        };
        workflowEventEmitter.emitDirectTriggered(canvasId, payload);

        await triggerWithSummary(canvasId, directConnection.id, singleSummary, true, true);
      }

      directTriggerStore.clearDirectPending(targetPodId);
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

    // 找出所有涉及的 direct connections
    const directConnections = incomingConnections.filter(
      (conn) => conn.triggerMode === 'direct' && sourcePodIds.includes(conn.sourcePodId)
    );

    // 為所有參與合併的 direct connections 發送 WORKFLOW_DIRECT_TRIGGERED 事件
    for (const conn of directConnections) {
      const summary = readySummaries.get(conn.sourcePodId);
      if (summary) {
        const payload: WorkflowDirectTriggeredPayload = {
          canvasId,
          connectionId: conn.id,
          sourcePodId: conn.sourcePodId,
          targetPodId,
          transferredContent: mergedContent,
          isSummarized: true,
        };
        workflowEventEmitter.emitDirectTriggered(canvasId, payload);
      }
    }

    const allDirectConnectionIds = directConnections.map(conn => conn.id);
    const anyDirectConnection = directConnections[0];

    if (!anyDirectConnection) {
      directTriggerStore.clearDirectPending(targetPodId);
      return;
    }

    const targetPod = podStore.getById(canvasId, targetPodId);
    if (targetPod && (targetPod.status === 'chatting' || targetPod.status === 'summarizing')) {
      const isBusyWithDirect = directTriggerStore.hasDirectPending(targetPodId);

      if (!isBusyWithDirect) {
        workflowQueueService.enqueue({
          canvasId,
          connectionId: anyDirectConnection.id,
          sourcePodId: sourcePodIds[0],
          targetPodId,
          summary: mergedContent,
          isSummarized: true,
          triggerMode: 'direct',
        });

        directTriggerStore.clearDirectPending(targetPodId);
        return;
      }
    }

    await triggerWithSummary(canvasId, anyDirectConnection.id, mergedContent, true, true);

    const otherConnectionIds = allDirectConnectionIds.filter(id => id !== anyDirectConnection.id);
    for (const otherConnectionId of otherConnectionIds) {
      const otherConnection = directConnections.find(conn => conn.id === otherConnectionId);
      if (otherConnection) {
        workflowEventEmitter.emitWorkflowComplete(
          canvasId,
          otherConnectionId,
          otherConnection.sourcePodId,
          targetPodId,
          true,
          undefined,
          'direct'
        );
      }
    }

    directTriggerStore.clearDirectPending(targetPodId);
  }
}

export const workflowDirectTriggerService = new WorkflowDirectTriggerService();
