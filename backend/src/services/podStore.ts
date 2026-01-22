// In-Memory Pod Store
// Manages Pod data storage and retrieval

import { v4 as uuidv4 } from 'uuid';
import { Pod, PodStatus, CreatePodRequest } from '../types/index.js';
import { config } from '../config/index.js';

class PodStore {
  private pods: Map<string, Pod> = new Map();

  /**
   * Create a new Pod
   */
  create(data: CreatePodRequest): Pod {
    const id = uuidv4();
    const now = new Date();

    const pod: Pod = {
      id,
      name: data.name,
      type: data.type,
      color: data.color,
      status: 'idle',
      workspacePath: `${config.workspaceRoot}/pod-${id}`,
      gitUrl: null,
      createdAt: now,
      lastActiveAt: now,
      // Canvas-specific fields
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      output: ['> Ready to assist', '> Type your message...'],
    };

    this.pods.set(id, pod);
    return pod;
  }

  /**
   * Get Pod by ID
   */
  getById(id: string): Pod | undefined {
    return this.pods.get(id);
  }

  /**
   * Get all Pods
   */
  getAll(): Pod[] {
    return Array.from(this.pods.values());
  }

  /**
   * Update Pod
   */
  update(id: string, updates: Partial<Pod>): Pod | undefined {
    const pod = this.pods.get(id);
    if (!pod) {
      return undefined;
    }

    const updatedPod = { ...pod, ...updates };
    this.pods.set(id, updatedPod);
    return updatedPod;
  }

  /**
   * Delete Pod
   */
  delete(id: string): boolean {
    return this.pods.delete(id);
  }

  /**
   * Set Pod status
   */
  setStatus(id: string, status: PodStatus): void {
    const pod = this.pods.get(id);
    if (pod) {
      pod.status = status;
      this.pods.set(id, pod);
    }
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(id: string): void {
    const pod = this.pods.get(id);
    if (pod) {
      pod.lastActiveAt = new Date();
      this.pods.set(id, pod);
    }
  }
}

// Export singleton instance
export const podStore = new PodStore();
