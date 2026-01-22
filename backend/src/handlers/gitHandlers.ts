// Git WebSocket Handlers
// Handles Git operations via WebSocket events

import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type PodGitClonePayload,
  type PodGitCloneProgressPayload,
  type PodGitCloneResultPayload,
} from '../types/index.js';
import { podStore } from '../services/podStore.js';
import { gitService } from '../services/workspace/gitService.js';
import {
  emitSuccess,
  emitError,
  validatePayload,
  getErrorMessage,
  getErrorCode,
} from '../utils/websocketResponse.js';

/**
 * Handle Git clone request
 */
export async function handleGitClone(
  socket: Socket,
  payload: unknown
): Promise<void> {
  let podId: string | undefined;
  let requestId: string | undefined;

  try {
    // Validate payload
    validatePayload<PodGitClonePayload>(payload, [
      'requestId',
      'podId',
      'repoUrl',
    ]);

    const { requestId: reqId, podId: pid, repoUrl, branch } = payload;
    requestId = reqId;
    podId = pid;

    // Check if Pod exists
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new Error(`Pod not found: ${podId}`);
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
    const updatedPod = podStore.update(podId, { gitUrl: repoUrl });

    if (!updatedPod) {
      throw new Error(`Failed to update Pod after clone: ${podId}`);
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
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const errorCode = getErrorCode(error);

    if (!requestId && typeof payload === 'object' && payload && 'requestId' in payload) {
      requestId = payload.requestId as string;
    }

    if (!podId && typeof payload === 'object' && payload && 'podId' in payload) {
      podId = payload.podId as string;
    }

    emitError(
      socket,
      WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
      errorMessage,
      requestId,
      podId,
      errorCode
    );

    console.error(`[Git] Failed to clone repository: ${errorMessage}`);
  }
}
