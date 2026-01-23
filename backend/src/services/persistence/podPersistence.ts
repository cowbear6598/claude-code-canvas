// Pod Persistence Service
// Manages Pod data storage on disk

import path from 'path';
import fs from 'fs/promises';
import { persistenceService } from './index.js';
import type { Pod, PersistedPod } from '../../types/index.js';
import { config } from '../../config/index.js';

class PodPersistenceService {
  /**
   * Get the file path for a Pod's data
   * @param podId Pod identifier
   * @returns Absolute path to pod.json
   */
  getPodFilePath(podId: string): string {
    return path.join(config.workspaceRoot, `pod-${podId}`, 'pod.json');
  }

  /**
   * Convert Pod to PersistedPod format
   * @param pod In-memory Pod object
   * @param claudeSessionId Optional Claude session ID
   * @returns Serializable PersistedPod
   */
  private toPersistedPod(pod: Pod, claudeSessionId?: string): PersistedPod {
    return {
      id: pod.id,
      name: pod.name,
      type: pod.type,
      color: pod.color,
      status: pod.status,
      gitUrl: pod.gitUrl,
      createdAt: pod.createdAt.toISOString(),
      updatedAt: pod.lastActiveAt.toISOString(),
      x: pod.x,
      y: pod.y,
      rotation: pod.rotation,
      claudeSessionId: claudeSessionId ?? pod.claudeSessionId ?? null,
    };
  }

  /**
   * Save Pod data to disk
   * @param pod Pod to save
   * @param claudeSessionId Optional Claude session ID to update
   */
  async savePod(pod: Pod, claudeSessionId?: string): Promise<void> {
    const filePath = this.getPodFilePath(pod.id);
    const persistedPod = this.toPersistedPod(pod, claudeSessionId);

    try {
      await persistenceService.writeJson(filePath, persistedPod);
      console.log(`[PodPersistence] Saved Pod ${pod.id} to ${filePath}`);
    } catch (error) {
      console.error(`[PodPersistence] Failed to save Pod ${pod.id}: ${error}`);
      throw error;
    }
  }

  /**
   * Load Pod data from disk
   * @param podId Pod identifier
   * @returns PersistedPod or null if not found
   */
  async loadPod(podId: string): Promise<PersistedPod | null> {
    const filePath = this.getPodFilePath(podId);
    const data = await persistenceService.readJson<PersistedPod>(filePath);

    if (data) {
      console.log(`[PodPersistence] Loaded Pod ${podId}`);
    }

    return data;
  }

  /**
   * Delete Pod data file
   * @param podId Pod identifier
   */
  async deletePodData(podId: string): Promise<void> {
    const filePath = this.getPodFilePath(podId);

    try {
      await persistenceService.deleteFile(filePath);
      console.log(`[PodPersistence] Deleted Pod data ${filePath}`);
    } catch (error) {
      console.error(`[PodPersistence] Failed to delete Pod data ${podId}: ${error}`);
      throw error;
    }
  }

  /**
   * List all Pod IDs by scanning workspace directory
   * @returns Array of Pod IDs
   */
  async listAllPodIds(): Promise<string[]> {
    try {
      // Ensure workspace root exists
      await persistenceService.ensureDirectory(config.workspaceRoot);

      // Read all directories in workspace root
      const entries = await fs.readdir(config.workspaceRoot, { withFileTypes: true });

      // Filter for pod-* directories that have pod.json
      const podIds: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('pod-')) {
          // Extract pod ID from directory name
          const podId = entry.name.substring(4); // Remove 'pod-' prefix

          // Check if pod.json exists
          const podFilePath = this.getPodFilePath(podId);
          const exists = await persistenceService.fileExists(podFilePath);

          if (exists) {
            podIds.push(podId);
          } else {
            console.warn(`[PodPersistence] Found orphan workspace directory: ${entry.name}`);
          }
        }
      }

      console.log(`[PodPersistence] Found ${podIds.length} Pods on disk`);
      return podIds;
    } catch (error) {
      console.error(`[PodPersistence] Failed to list Pod IDs: ${error}`);
      return [];
    }
  }
}

// Export singleton instance
export const podPersistenceService = new PodPersistenceService();
