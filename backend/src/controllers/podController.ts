// Pod Controller
// Handles Pod management API endpoints
//
// @deprecated This controller is deprecated as of the WebSocket-first architecture migration.
// All Pod operations should now be handled via WebSocket handlers in src/handlers/podHandlers.ts
// This file is kept for reference purposes only.

import { Request, Response, NextFunction } from 'express';
import { podStore } from '../services/podStore.js';
import { workspaceService } from '../services/workspace/index.js';
import { gitService } from '../services/workspace/gitService.js';
import { claudeSessionManager } from '../services/claude/sessionManager.js';
import {
  CreatePodRequest,
  CreatePodResponse,
  GitCloneRequest,
} from '../types/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Create a new Pod
 * POST /api/pods
 */
export async function createPod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, type, color } = req.body as CreatePodRequest;

    // Validate request body
    if (!name || !type || !color) {
      throw new ValidationError('Missing required fields: name, type, color');
    }

    // Validate field values
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Name must be a non-empty string');
    }

    if (name.length > 100) {
      throw new ValidationError('Name must not exceed 100 characters');
    }

    const validTypes = [
      'Code Assistant',
      'Chat Companion',
      'Creative Writer',
      'Data Analyst',
      'General AI',
    ];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const validColors = ['blue', 'coral', 'pink', 'yellow', 'green'];
    if (!validColors.includes(color)) {
      throw new ValidationError(`Invalid color. Must be one of: ${validColors.join(', ')}`);
    }

    // Create Pod
    const pod = podStore.create({ name, type, color });

    // Create workspace directory
    await workspaceService.createWorkspace(pod.id);

    // Return created Pod
    const response: CreatePodResponse = { pod };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all Pods
 * GET /api/pods
 */
export async function getAllPods(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pods = podStore.getAll();
    res.status(200).json({ pods });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Pod by ID
 * GET /api/pods/:id
 */
export async function getPodById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    const pod = podStore.getById(id);
    if (!pod) {
      throw new NotFoundError(`Pod with id ${id} not found`);
    }

    res.status(200).json({ pod });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Pod
 * DELETE /api/pods/:id
 */
export async function deletePod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;

    // Check if Pod exists
    const pod = podStore.getById(id);
    if (!pod) {
      throw new NotFoundError(`Pod with id ${id} not found`);
    }

    // Destroy Claude session
    await claudeSessionManager.destroySession(id);

    // Delete workspace
    await workspaceService.deleteWorkspace(id);

    // Delete Pod from store
    podStore.delete(id);

    // Return 204 No Content
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * Clone Git repository into Pod workspace
 * POST /api/pods/:id/git/clone
 */
export async function cloneRepo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { repoUrl, branch } = req.body as GitCloneRequest;

    // Validate request body
    if (!repoUrl || typeof repoUrl !== 'string') {
      throw new ValidationError('Missing or invalid repoUrl');
    }

    // Validate Git URL format (basic check)
    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/)/;
    if (!gitUrlPattern.test(repoUrl)) {
      throw new ValidationError('Invalid Git URL format');
    }

    // Get Pod
    const pod = podStore.getById(id);
    if (!pod) {
      throw new NotFoundError(`Pod with id ${id} not found`);
    }

    // Clone repository
    await gitService.clone(repoUrl, pod.workspacePath, branch);

    // Update Pod with Git URL
    const updatedPod = podStore.update(id, { gitUrl: repoUrl });

    res.status(200).json({ pod: updatedPod });
  } catch (error) {
    next(error);
  }
}
