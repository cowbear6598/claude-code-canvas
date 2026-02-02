import { v4 as uuidv4 } from 'uuid';
import { Pod, PodStatus, CreatePodRequest, ModelType, WebSocketResponseEvents, Result, ok, err } from '../types/index.js';
import { podPersistenceService } from './persistence/podPersistence.js';
import { socketService } from './socketService.js';
import { logger } from '../utils/logger.js';
import { canvasStore } from './canvasStore.js';

class PodStore {
  private podsByCanvas: Map<string, Map<string, Pod>> = new Map();

  private getCanvasPods(canvasId: string): Map<string, Pod> {
    let pods = this.podsByCanvas.get(canvasId);
    if (!pods) {
      pods = new Map();
      this.podsByCanvas.set(canvasId, pods);
    }
    return pods;
  }

  private persistPodAsync(canvasId: string, pod: Pod, claudeSessionId?: string): void {
    const canvasDir = canvasStore.getCanvasDir(canvasId);
    if (!canvasDir) {
      logger.error('Pod', 'Error', `[PodStore] Canvas not found for Pod ${pod.id}`);
      return;
    }

    podPersistenceService.savePod(canvasDir, pod, claudeSessionId).catch((error) => {
      logger.error('Pod', 'Error', `[PodStore] Failed to persist Pod ${pod.id}: ${error}`);
    });
  }

  create(canvasId: string, data: CreatePodRequest): Pod {
    const id = uuidv4();
    const now = new Date();
    const canvasDir = canvasStore.getCanvasDir(canvasId);

    if (!canvasDir) {
      throw new Error(`Canvas not found: ${canvasId}`);
    }

    const pod: Pod = {
      id,
      name: data.name,
      color: data.color,
      status: 'idle',
      workspacePath: `${canvasDir}/pod-${id}`,
      gitUrl: null,
      createdAt: now,
      lastActiveAt: now,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
      output: [],
      claudeSessionId: null,
      outputStyleId: data.outputStyleId ?? null,
      skillIds: data.skillIds ?? [],
      subAgentIds: data.subAgentIds ?? [],
      model: data.model ?? 'opus',
      repositoryId: data.repositoryId ?? null,
      commandId: data.commandId ?? null,
      needsForkSession: false,
      autoClear: false,
    };

    const pods = this.getCanvasPods(canvasId);
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);

    return pod;
  }

  getById(canvasId: string, id: string): Pod | undefined {
    const pods = this.getCanvasPods(canvasId);
    return pods.get(id);
  }

  getByIdGlobal(podId: string): { canvasId: string; pod: Pod } | undefined {
    for (const [canvasId, pods] of this.podsByCanvas.entries()) {
      const pod = pods.get(podId);
      if (pod) {
        return { canvasId, pod };
      }
    }
    return undefined;
  }

  getAll(canvasId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values());
  }

  update(canvasId: string, id: string, updates: Partial<Pod>): Pod | undefined {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return undefined;
    }

    const updatedPod = { ...pod, ...updates };
    pods.set(id, updatedPod);
    this.persistPodAsync(canvasId, updatedPod);

    return updatedPod;
  }

  delete(canvasId: string, id: string): boolean {
    const pods = this.getCanvasPods(canvasId);
    if (!pods.delete(id)) {
      return false;
    }

    const canvasDir = canvasStore.getCanvasDir(canvasId);
    if (!canvasDir) {
      logger.error('Pod', 'Delete', `[PodStore] Canvas not found for Pod ${id}`);
      return false;
    }

    podPersistenceService.deletePodData(canvasDir, id).catch((error) => {
      logger.error('Pod', 'Delete', `[PodStore] Failed to delete Pod data ${id}: ${error}`);
    });

    return true;
  }

  setStatus(canvasId: string, id: string, status: PodStatus): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    const previousStatus = pod.status;
    if (previousStatus === status) {
      return;
    }

    pod.status = status;
    pods.set(id, pod);

    const payload = {
      podId: id,
      status,
      previousStatus,
    };

    socketService.emitToPod(id, WebSocketResponseEvents.POD_STATUS_CHANGED, payload);
  }

  updateLastActive(canvasId: string, id: string): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.lastActiveAt = new Date();
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  setClaudeSessionId(canvasId: string, id: string, sessionId: string): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.claudeSessionId = sessionId;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod, sessionId);
  }

  setOutputStyleId(canvasId: string, id: string, outputStyleId: string | null): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.outputStyleId = outputStyleId;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  addSkillId(canvasId: string, podId: string, skillId: string): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(podId);
    if (!pod) {
      return;
    }

    if (!pod.skillIds.includes(skillId)) {
      pod.skillIds.push(skillId);
      pods.set(podId, pod);
      this.persistPodAsync(canvasId, pod);
    }
  }

  addSubAgentId(canvasId: string, podId: string, subAgentId: string): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(podId);
    if (!pod) {
      return;
    }

    if (!pod.subAgentIds.includes(subAgentId)) {
      pod.subAgentIds.push(subAgentId);
      pods.set(podId, pod);
      this.persistPodAsync(canvasId, pod);
    }
  }

  findBySubAgentId(canvasId: string, subAgentId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values()).filter(
      (pod) => pod.subAgentIds.includes(subAgentId)
    );
  }

  setModel(canvasId: string, id: string, model: ModelType): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.model = model;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  setRepositoryId(canvasId: string, id: string, repositoryId: string | null): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.repositoryId = repositoryId;
    pod.needsForkSession = true;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  setNeedsForkSession(canvasId: string, id: string, needsFork: boolean): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.needsForkSession = needsFork;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  setAutoClear(canvasId: string, id: string, autoClear: boolean): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(id);
    if (!pod) {
      return;
    }

    pod.autoClear = autoClear;
    pods.set(id, pod);
    this.persistPodAsync(canvasId, pod);
  }

  setCommandId(canvasId: string, podId: string, commandId: string | null): void {
    const pods = this.getCanvasPods(canvasId);
    const pod = pods.get(podId);
    if (!pod) {
      return;
    }

    pod.commandId = commandId;
    pods.set(podId, pod);
    this.persistPodAsync(canvasId, pod);
  }

  findByCommandId(canvasId: string, commandId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values()).filter(
      (pod) => pod.commandId === commandId
    );
  }

  findByOutputStyleId(canvasId: string, outputStyleId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values()).filter(
      (pod) => pod.outputStyleId === outputStyleId
    );
  }

  findBySkillId(canvasId: string, skillId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values()).filter(
      (pod) => pod.skillIds.includes(skillId)
    );
  }

  findByRepositoryId(canvasId: string, repositoryId: string): Pod[] {
    const pods = this.getCanvasPods(canvasId);
    return Array.from(pods.values()).filter(
      (pod) => pod.repositoryId === repositoryId
    );
  }

  async loadFromDisk(canvasId: string, canvasDir: string): Promise<Result<void>> {
    const result = await podPersistenceService.listAllPodIds(canvasDir);
    if (!result.success) {
      return err('載入 Pod 資料失敗');
    }

    const podIds = result.data!;
    const pods = this.getCanvasPods(canvasId);

    for (const podId of podIds) {
      const persistedPod = await podPersistenceService.loadPod(canvasDir, podId);

      if (persistedPod) {
        const loadedStatus = persistedPod.status as string;
        const pod: Pod = {
          id: persistedPod.id,
          name: persistedPod.name,
          color: persistedPod.color,
          status: loadedStatus === 'busy' ? 'idle' : persistedPod.status,
          workspacePath: `${canvasDir}/pod-${persistedPod.id}`,
          gitUrl: persistedPod.gitUrl,
          createdAt: new Date(persistedPod.createdAt),
          lastActiveAt: new Date(persistedPod.updatedAt),
          x: persistedPod.x,
          y: persistedPod.y,
          rotation: persistedPod.rotation,
          output: [],
          claudeSessionId: persistedPod.claudeSessionId,
          outputStyleId: persistedPod.outputStyleId ?? null,
          skillIds: persistedPod.skillIds ?? [],
          subAgentIds: persistedPod.subAgentIds ?? [],
          model: persistedPod.model ?? 'opus',
          repositoryId: persistedPod.repositoryId ?? null,
          commandId: persistedPod.commandId ?? null,
          needsForkSession: persistedPod.needsForkSession ?? false,
          autoClear: persistedPod.autoClear ?? false,
        };

        pods.set(pod.id, pod);
      }
    }

    logger.log('Pod', 'Load', `[PodStore] Successfully loaded ${pods.size} Pods for canvas ${canvasId}`);
    return ok(undefined);
  }
}

export const podStore = new PodStore();
