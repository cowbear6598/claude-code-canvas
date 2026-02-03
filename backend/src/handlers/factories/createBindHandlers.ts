import type {Socket} from 'socket.io';
import type {WebSocketResponseEvents} from '../../types/index.js';
import {podStore} from '../../services/podStore.js';
import {socketService} from '../../services/socketService.js';
import {repositorySyncService} from '../../services/repositorySyncService.js';
import {emitSuccess, emitError} from '../../utils/websocketResponse.js';
import {logger, type LogCategory} from '../../utils/logger.js';
import {validatePod, withCanvasId} from '../../utils/handlerHelpers.js';

/**
 * 資源綁定處理器的配置介面
 */
export interface BindResourceConfig<TService> {
    /** 資源名稱（用於日誌和錯誤訊息） */
    resourceName: string;
    /** 資源 ID 欄位名稱 */
    idField: string;
    /** 是否為多重綁定（true: 陣列模式如 skillIds, false: 單一值模式如 commandId） */
    isMultiBind: boolean;
    /** 資源服務實例 */
    service: TService;
    /** Pod Store 的更新方法 */
    podStoreMethod: {
        bind: (canvasId: string, podId: string, resourceId: string) => void;
        unbind?: (canvasId: string, podId: string) => void;
    };
    /** 獲取 Pod 已綁定的資源 IDs */
    getPodResourceIds: (pod: {skillIds: string[]; commandId: string | null}) => string[] | string | null;
    /** 複製資源到 Pod 的方法 */
    copyResourceToPod: (resourceId: string, podId: string, workspacePath: string) => Promise<void>;
    /** 從路徑刪除資源的方法（用於 unbind） */
    deleteResourceFromPath?: (workspacePath: string) => Promise<void>;
    /** WebSocket 事件名稱 */
    events: {
        bound: WebSocketResponseEvents;
        unbound?: WebSocketResponseEvents;
        broadcastBound: WebSocketResponseEvents;
        broadcastUnbound?: WebSocketResponseEvents;
    };
}

/**
 * 檢查資源是否已綁定
 */
function isResourceAlreadyBound(
    boundIds: string[] | string | null,
    resourceId: string,
    isMultiBind: boolean
): boolean {
    if (isMultiBind) {
        return Array.isArray(boundIds) && boundIds.includes(resourceId);
    } else {
        return boundIds === resourceId || boundIds !== null;
    }
}

/**
 * 建立資源綁定處理器
 */
export function createBindHandler<TService extends {exists: (id: string) => Promise<boolean>}>(
    config: BindResourceConfig<TService>
) {
    return withCanvasId<{podId: string; [key: string]: string}>(
        config.events.bound,
        async (socket: Socket, canvasId: string, payload: {podId: string; [key: string]: string}, requestId: string): Promise<void> => {
            const {podId} = payload;
            const resourceId = payload[config.idField] as string;

            const pod = validatePod(socket, podId, config.events.bound, requestId);
            if (!pod) {
                return;
            }

            // 檢查資源是否存在
            const resourceExists = await config.service.exists(resourceId);
            if (!resourceExists) {
                emitError(
                    socket,
                    config.events.bound,
                    `${config.resourceName} not found: ${resourceId}`,
                    requestId,
                    podId,
                    'NOT_FOUND'
                );
                return;
            }

            // 檢查是否已綁定
            const boundIds = config.getPodResourceIds(pod);
            if (isResourceAlreadyBound(boundIds, resourceId, config.isMultiBind)) {
                const conflictMessage = config.isMultiBind
                    ? `${config.resourceName} ${resourceId} is already bound to Pod ${podId}`
                    : `Pod ${podId} already has ${config.resourceName.toLowerCase()} ${boundIds} bound. Please unbind first.`;

                emitError(
                    socket,
                    config.events.bound,
                    conflictMessage,
                    requestId,
                    podId,
                    'CONFLICT'
                );
                return;
            }

            // 複製資源到 Pod
            await config.copyResourceToPod(resourceId, podId, pod.workspacePath);

            // 更新 Pod Store
            config.podStoreMethod.bind(canvasId, podId, resourceId);

            // 同步 Repository
            if (pod.repositoryId) {
                await repositorySyncService.syncRepositoryResources(pod.repositoryId);
            }

            // 獲取更新後的 Pod
            const updatedPod = podStore.getById(canvasId, podId);

            // 回應成功
            const response = {
                requestId,
                success: true,
                pod: updatedPod,
            };
            emitSuccess(socket, config.events.bound, response);

            // 廣播給其他客戶端
            const broadcastPayload = {
                canvasId,
                pod: updatedPod!,
            };
            socketService.broadcastToCanvas(socket.id, canvasId, config.events.broadcastBound, broadcastPayload);

            logger.log(config.resourceName as LogCategory, 'Bind', `Bound ${config.resourceName.toLowerCase()} ${resourceId} to Pod ${podId}`);
        }
    );
}

/**
 * 建立資源解綁處理器（僅用於單一綁定模式，如 Command）
 */
export function createUnbindHandler<TService>(
    config: BindResourceConfig<TService>
) {
    if (config.isMultiBind) {
        throw new Error('Unbind handler is only for single bind mode');
    }

    if (!config.events.unbound || !config.events.broadcastUnbound) {
        throw new Error('Unbind events are required for unbind handler');
    }

    if (!config.podStoreMethod.unbind || !config.deleteResourceFromPath) {
        throw new Error('Unbind method and deleteResourceFromPath are required for unbind handler');
    }

    return withCanvasId<{podId: string}>(
        config.events.unbound!,
        async (socket: Socket, canvasId: string, payload: {podId: string}, requestId: string): Promise<void> => {
            const {podId} = payload;

            const pod = validatePod(socket, podId, config.events.unbound!, requestId);
            if (!pod) {
                return;
            }

            // 如果沒有綁定資源，直接返回成功
            const boundId = config.getPodResourceIds(pod);
            if (!boundId) {
                const response = {
                    requestId,
                    success: true,
                    pod,
                };
                emitSuccess(socket, config.events.unbound!, response);
                return;
            }

            // 刪除資源
            await config.deleteResourceFromPath!(pod.workspacePath);

            // 更新 Pod Store
            config.podStoreMethod.unbind!(canvasId, podId);

            // 同步 Repository
            if (pod.repositoryId) {
                await repositorySyncService.syncRepositoryResources(pod.repositoryId);
            }

            // 獲取更新後的 Pod
            const updatedPod = podStore.getById(canvasId, podId);

            // 回應成功
            const response = {
                requestId,
                success: true,
                pod: updatedPod,
            };
            emitSuccess(socket, config.events.unbound!, response);

            // 廣播給其他客戶端
            const broadcastPayload = {
                canvasId,
                pod: updatedPod!,
            };
            socketService.broadcastToCanvas(socket.id, canvasId, config.events.broadcastUnbound!, broadcastPayload);

            logger.log(config.resourceName as LogCategory, 'Unbind', `Unbound ${config.resourceName.toLowerCase()} from Pod ${podId}`);
        }
    );
}
