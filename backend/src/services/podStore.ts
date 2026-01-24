import { v4 as uuidv4 } from 'uuid';
import { Pod, PodStatus, CreatePodRequest } from '../types/index.js';
import { config } from '../config/index.js';
import { podPersistenceService } from './persistence/podPersistence.js';

class PodStore {
  private pods: Map<string, Pod> = new Map();

  private persistPodAsync(pod: Pod, claudeSessionId?: string): void {
    podPersistenceService.savePod(pod, claudeSessionId).catch((error) => {
      console.error(`[PodStore] Failed to persist Pod ${pod.id}: ${error}`);
    });
  }

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
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      output: ['> Ready to assist', '> Type your message...'],
      claudeSessionId: null,
      outputStyleId: null,
    };

    this.pods.set(id, pod);
    this.persistPodAsync(pod);

    return pod;
  }

  getById(id: string): Pod | undefined {
    return this.pods.get(id);
  }

  getAll(): Pod[] {
    return Array.from(this.pods.values());
  }

  update(id: string, updates: Partial<Pod>): Pod | undefined {
    const pod = this.pods.get(id);
    if (!pod) {
      return undefined;
    }

    const updatedPod = { ...pod, ...updates };
    this.pods.set(id, updatedPod);
    this.persistPodAsync(updatedPod);

    return updatedPod;
  }

  delete(id: string): boolean {
    if (!this.pods.delete(id)) {
      return false;
    }

    podPersistenceService.deletePodData(id).catch((error) => {
      console.error(`[PodStore] Failed to delete Pod data ${id}: ${error}`);
    });

    return true;
  }

  setStatus(id: string, status: PodStatus): void {
    const pod = this.pods.get(id);
    if (!pod) {
      return;
    }

    pod.status = status;
    this.pods.set(id, pod);
  }

  updateLastActive(id: string): void {
    const pod = this.pods.get(id);
    if (!pod) {
      return;
    }

    pod.lastActiveAt = new Date();
    this.pods.set(id, pod);
    this.persistPodAsync(pod);
  }

  setClaudeSessionId(id: string, sessionId: string): void {
    const pod = this.pods.get(id);
    if (!pod) {
      return;
    }

    pod.claudeSessionId = sessionId;
    this.pods.set(id, pod);
    this.persistPodAsync(pod, sessionId);
  }

  setOutputStyleId(id: string, outputStyleId: string | null): void {
    const pod = this.pods.get(id);
    if (!pod) {
      return;
    }

    pod.outputStyleId = outputStyleId;
    this.pods.set(id, pod);
    this.persistPodAsync(pod);
  }

  async loadFromDisk(): Promise<void> {
    try {
      // Get all Pod IDs from disk
      const podIds = await podPersistenceService.listAllPodIds();

      console.log(`[PodStore] Loading ${podIds.length} Pods from disk...`);

      // Load each Pod
      for (const podId of podIds) {
        const persistedPod = await podPersistenceService.loadPod(podId);

        if (persistedPod) {
          // Convert PersistedPod to Pod (convert string dates to Date objects)
          const pod: Pod = {
            id: persistedPod.id,
            name: persistedPod.name,
            type: persistedPod.type,
            color: persistedPod.color,
            status: persistedPod.status,
            workspacePath: `${config.workspaceRoot}/pod-${persistedPod.id}`,
            gitUrl: persistedPod.gitUrl,
            createdAt: new Date(persistedPod.createdAt),
            lastActiveAt: new Date(persistedPod.updatedAt),
            x: persistedPod.x,
            y: persistedPod.y,
            rotation: persistedPod.rotation,
            output: ['> Ready to assist', '> Type your message...'],
            claudeSessionId: persistedPod.claudeSessionId,
            outputStyleId: persistedPod.outputStyleId ?? null,
          };

          this.pods.set(pod.id, pod);
          console.log(`[PodStore] Loaded Pod ${pod.id}: ${pod.name}`);
        }
      }

      console.log(`[PodStore] Successfully loaded ${this.pods.size} Pods`);
    } catch (error) {
      console.error(`[PodStore] Failed to load Pods from disk: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const podStore = new PodStore();
