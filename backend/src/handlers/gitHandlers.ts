import type { Socket } from 'socket.io';
import {
  WebSocketResponseEvents,
  type PodGitCloneProgressPayload,
  type PodGitCloneResultPayload,
} from '../types/index.js';
import type { GitClonePayload } from '../schemas/index.js';
import { podStore } from '../services/podStore.js';
import { gitService } from '../services/workspace/gitService.js';
import { emitSuccess, emitError } from '../utils/websocketResponse.js';
import { logger } from '../utils/logger.js';

export async function handleGitClone(
  socket: Socket,
  payload: GitClonePayload,
  requestId: string
): Promise<void> {
  const { podId, repoUrl, branch } = payload;

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
    return;
  }

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

  const cloneResult = await gitService.clone(repoUrl, pod.workspacePath, branch);
  if (!cloneResult.success) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
      cloneResult.error!,
      requestId,
      podId,
      'INTERNAL_ERROR'
    );
    return;
  }

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

  const updatedPod = podStore.update(podId, { gitUrl: repoUrl });

  if (!updatedPod) {
    emitError(
      socket,
      WebSocketResponseEvents.POD_GIT_CLONE_RESULT,
      `Failed to update Pod after clone: ${podId}`,
      requestId,
      podId,
      'INTERNAL_ERROR'
    );
    return;
  }

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

  const response: PodGitCloneResultPayload = {
    requestId,
    success: true,
    pod: updatedPod,
  };

  emitSuccess(socket, WebSocketResponseEvents.POD_GIT_CLONE_RESULT, response);

  logger.log(
    'Git',
    'Complete',
    `Successfully cloned ${repoUrl} for Pod ${podId}${
      branch ? ` (branch: ${branch})` : ''
    }`
  );
}
