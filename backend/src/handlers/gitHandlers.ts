// Git WebSocket Handlers
// Handles Git operations via WebSocket events

import type {Socket} from 'socket.io';
import {
    WebSocketResponseEvents,
    type PodGitClonePayload,
    type PodGitCloneProgressPayload,
    type PodGitCloneResultPayload,
} from '../types/index.js';
import {podStore} from '../services/podStore.js';
import {gitService} from '../services/workspace/gitService.js';
import {
    emitSuccess,
    emitError,
    tryValidatePayload,
} from '../utils/websocketResponse.js';

/**
 * Handle Git clone request
 */
export async function handleGitClone(
    socket: Socket,
    payload: unknown
): Promise<void> {
    // Validate payload
    const validation = tryValidatePayload<PodGitClonePayload>(payload, [
        'requestId',
        'podId',
        'repoUrl',
    ]);

    if (!validation.success) {
        const requestId =
            typeof payload === 'object' && payload && 'requestId' in payload
                ? (payload.requestId as string)
                : undefined;

        const podId =
            typeof payload === 'object' && payload && 'podId' in payload
                ? (payload.podId as string)
                : undefined;

        emitError(
            socket,
            WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
            validation.error!,
            requestId,
            podId,
            'VALIDATION_ERROR'
        );

        console.error(`[Git] Failed to clone repository: ${validation.error}`);
        return;
    }

    const {requestId, podId, repoUrl, branch} = validation.data!;

    // Check if Pod exists
    const pod = podStore.getById(podId);
    if (!pod) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
            `Pod not found: ${podId}`,
            requestId,
            podId,
            'NOT_FOUND'
        );

        console.error(`[Git] Failed to clone repository: Pod not found: ${podId}`);
        return;
    }

    // Emit progress: Starting clone
    const progressPayload1: PodGitCloneProgressPayload = {
        podId,
        progress: 0,
        message: 'Starting Git clone...',
    };
    emitSuccess(
        socket,
        WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS,
        progressPayload1
    );

    // Emit progress: Cloning repository
    const progressPayload2: PodGitCloneProgressPayload = {
        podId,
        progress: 30,
        message: `Cloning ${repoUrl}...`,
    };
    emitSuccess(
        socket,
        WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS,
        progressPayload2
    );

    // Perform Git clone
    await gitService.clone(repoUrl, pod.workspacePath, branch);

    // Emit progress: Clone complete
    const progressPayload3: PodGitCloneProgressPayload = {
        podId,
        progress: 90,
        message: 'Updating Pod information...',
    };
    emitSuccess(
        socket,
        WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS,
        progressPayload3
    );

    // Update Pod with Git URL
    const updatedPod = podStore.update(podId, {gitUrl: repoUrl});

    if (!updatedPod) {
        emitError(
            socket,
            WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
            `Failed to update Pod after clone: ${podId}`,
            requestId,
            podId,
            'INTERNAL_ERROR'
        );

        console.error(`[Git] Failed to update Pod after clone: ${podId}`);
        return;
    }

    // Emit progress: Complete
    const progressPayload4: PodGitCloneProgressPayload = {
        podId,
        progress: 100,
        message: 'Clone complete!',
    };
    emitSuccess(
        socket,
        WebSocketResponseEvents.POD_GIT_CLONE_PROGRESS,
        progressPayload4
    );

    // Emit success response
    const response: PodGitCloneResultPayload = {
        requestId,
        success: true,
        pod: updatedPod,
    };

    emitSuccess(socket, WebSocketResponseEvents.POD_GIT_CLONE_RESULT, response);

    console.log(
        `[Git] Successfully cloned ${repoUrl} for Pod ${podId}${
            branch ? ` (branch: ${branch})` : ''
        }`
    );
}
