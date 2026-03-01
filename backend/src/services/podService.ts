import { podStore } from './podStore.js';
import { workspaceService } from './workspace/index.js';
import { canvasStore } from './canvasStore.js';
import { socketService } from './socketService.js';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type { CreatePodRequest } from '../types/api.js';
import type { Result } from '../types/index.js';
import type { Pod } from '../types/pod.js';

interface CreatePodResult {
    pod: Pod;
}

export async function createPodWithWorkspace(
    canvasId: string,
    data: CreatePodRequest,
    requestId: string,
): Promise<Result<CreatePodResult>> {
    const pod = podStore.create(canvasId, data);

    const canvasDir = canvasStore.getCanvasDir(canvasId);
    if (canvasDir) {
        const wsResult = await workspaceService.createWorkspace(pod.workspacePath);
        if (!wsResult.success) {
            podStore.delete(canvasId, pod.id);
            return { success: false, error: '建立工作目錄失敗' };
        }
    }

    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_CREATED, {
        requestId,
        success: true,
        pod,
    });

    return { success: true, data: { pod } };
}
