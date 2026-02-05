import { WebSocketResponseEvents } from '../schemas';
import type {
  ConnectionCreatedPayload,
  ConnectionListResultPayload,
  ConnectionDeletedPayload,
  ConnectionUpdatedPayload,
  PodScheduleSetPayload,
  Connection,
  Pod,
} from '../types';
import type {
  ConnectionCreatePayload,
  ConnectionListPayload,
  ConnectionDeletePayload,
  ConnectionUpdatePayload,
} from '../schemas';
import { connectionStore } from '../services/connectionStore.js';
import { podStore } from '../services/podStore.js';
import { workflowStateService } from '../services/workflow';
import { socketService } from '../services/socketService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';
import { withCanvasId } from '../utils/handlerHelpers.js';

function withConnection(
  wsConnectionId: string,
  canvasId: string,
  connId: string,
  responseEvent: WebSocketResponseEvents,
  requestId: string,
  callback: (connection: Connection) => void | Promise<void>
): void {
  const connection = connectionStore.getById(canvasId, connId);

  if (!connection) {
    emitError(
      wsConnectionId,
      responseEvent,
      `Connection 找不到: ${connId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  callback(connection);
}

function withPods(
  connectionId: string,
  canvasId: string,
  sourcePodId: string,
  targetPodId: string,
  responseEvent: WebSocketResponseEvents,
  requestId: string,
  callback: (sourcePod: Pod, targetPod: Pod) => void | Promise<void>
): void {
  const sourcePod = podStore.getById(canvasId, sourcePodId);

  if (!sourcePod) {
    emitError(
      connectionId,
      responseEvent,
      `來源 Pod 找不到: ${sourcePodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  const targetPod = podStore.getById(canvasId, targetPodId);

  if (!targetPod) {
    emitError(
      connectionId,
      responseEvent,
      `目標 Pod 找不到: ${targetPodId}`,
      requestId,
      undefined,
      'NOT_FOUND'
    );
    return;
  }

  callback(sourcePod, targetPod);
}

export const handleConnectionCreate = withCanvasId<ConnectionCreatePayload>(
  WebSocketResponseEvents.CONNECTION_CREATED,
  async (connectionId: string, canvasId: string, payload: ConnectionCreatePayload, requestId: string): Promise<void> => {
    const { sourcePodId, sourceAnchor, targetPodId, targetAnchor } = payload;

    withPods(
      connectionId,
      canvasId,
      sourcePodId,
      targetPodId,
      WebSocketResponseEvents.CONNECTION_CREATED,
      requestId,
      (_sourcePod, targetPod) => {
        const connection = connectionStore.create(canvasId, {
          sourcePodId,
          sourceAnchor,
          targetPodId,
          targetAnchor,
        });

        const response: ConnectionCreatedPayload = {
          requestId,
          canvasId,
          success: true,
          connection,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_CREATED, response);

        if (targetPod.schedule) {
          const updatedPod = podStore.update(canvasId, targetPodId, { schedule: null });

          if (updatedPod) {
            const podSchedulePayload: PodScheduleSetPayload = {
              requestId: '',
              canvasId,
              success: true,
              pod: updatedPod,
            };
            socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_SCHEDULE_SET, podSchedulePayload);

            logger.log('Connection', 'Create', `Cleared schedule for target Pod ${targetPodId} (now downstream)`);
          }
        }

        logger.log('Connection', 'Create', `Created connection ${connection.id} (${sourcePodId} -> ${targetPodId})`);
      }
    );
  }
);

export const handleConnectionList = withCanvasId<ConnectionListPayload>(
  WebSocketResponseEvents.CONNECTION_LIST_RESULT,
  async (connectionId: string, canvasId: string, _: ConnectionListPayload, requestId: string): Promise<void> => {
    const connections = connectionStore.list(canvasId);

    const response: ConnectionListResultPayload = {
      requestId,
      success: true,
      connections,
    };

    emitSuccess(connectionId, WebSocketResponseEvents.CONNECTION_LIST_RESULT, response);
  }
);

export const handleConnectionDelete = withCanvasId<ConnectionDeletePayload>(
  WebSocketResponseEvents.CONNECTION_DELETED,
  async (wsConnectionId: string, canvasId: string, payload: ConnectionDeletePayload, requestId: string): Promise<void> => {
    const { connectionId: connId } = payload;

    withConnection(
      wsConnectionId,
      canvasId,
      connId,
      WebSocketResponseEvents.CONNECTION_DELETED,
      requestId,
      () => {
        workflowStateService.handleConnectionDeletion(canvasId, connId);

        const deleted = connectionStore.delete(canvasId, connId);

        if (!deleted) {
          emitError(
            wsConnectionId,
            WebSocketResponseEvents.CONNECTION_DELETED,
            `無法從 store 刪除 connection: ${connId}`,
            requestId,
            undefined,
            'INTERNAL_ERROR'
          );
          return;
        }

        const response: ConnectionDeletedPayload = {
          requestId,
          canvasId,
          success: true,
          connectionId: connId,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_DELETED, response);

        logger.log('Connection', 'Delete', `Deleted connection ${connId}`);
      }
    );
  }
);

export const handleConnectionUpdate = withCanvasId<ConnectionUpdatePayload>(
  WebSocketResponseEvents.CONNECTION_UPDATED,
  async (wsConnectionId: string, canvasId: string, payload: ConnectionUpdatePayload, requestId: string): Promise<void> => {
    const { connectionId: connId, autoTrigger } = payload;

    withConnection(
      wsConnectionId,
      canvasId,
      connId,
      WebSocketResponseEvents.CONNECTION_UPDATED,
      requestId,
      () => {
        const updates: Partial<{ autoTrigger: boolean }> = {};
        if (autoTrigger !== undefined) {
          updates.autoTrigger = autoTrigger;
        }

        const updatedConnection = connectionStore.update(canvasId, connId, updates);

        if (!updatedConnection) {
          emitError(
            wsConnectionId,
            WebSocketResponseEvents.CONNECTION_UPDATED,
            `無法更新 connection: ${connId}`,
            requestId,
            undefined,
            'INTERNAL_ERROR'
          );
          return;
        }

        const response: ConnectionUpdatedPayload = {
          requestId,
          canvasId,
          success: true,
          connection: updatedConnection,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.CONNECTION_UPDATED, response);
      }
    );
  }
);
