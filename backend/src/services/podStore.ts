import {v4 as uuidv4} from 'uuid';
import {WebSocketResponseEvents} from '../schemas/index.js';
import {Pod, PodStatus, CreatePodRequest, Result, ok, err, ScheduleConfig} from '../types/index.js';
import {podPersistenceService} from './persistence/podPersistence.js';
import {socketService} from './socketService.js';
import {logger} from '../utils/logger.js';
import {canvasStore} from './canvasStore.js';

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

    private modifyPod(canvasId: string, podId: string, updates: Partial<Pod>, persist = true, claudeSessionId?: string): Pod | undefined {
        const pods = this.getCanvasPods(canvasId);
        const pod = pods.get(podId);
        if (!pod) {
            return undefined;
        }

        const updatedPod = {...pod, ...updates};
        pods.set(podId, updatedPod);

        if (persist) {
            this.persistPodAsync(canvasId, updatedPod, claudeSessionId);
        }

        return updatedPod;
    }

    private findByPredicate(canvasId: string, predicate: (pod: Pod) => boolean): Pod[] {
        const pods = this.getCanvasPods(canvasId);
        return Array.from(pods.values()).filter(predicate);
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
                return {canvasId, pod};
            }
        }
        return undefined;
    }

    getAll(canvasId: string): Pod[] {
        const pods = this.getCanvasPods(canvasId);
        return Array.from(pods.values());
    }

    update(canvasId: string, id: string, updates: Partial<Omit<Pod, 'schedule'>> & {
        schedule?: ScheduleConfig | null
    }): Pod | undefined {
        const pods = this.getCanvasPods(canvasId);
        const pod = pods.get(id);
        if (!pod) {
            return undefined;
        }

        let updatedPod: Pod;

        // 如果 updates 包含 schedule 且為 null，則刪除 schedule 屬性
        if ('schedule' in updates && updates.schedule === null) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {schedule, ...restUpdates} = updates;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {schedule: _, ...restPod} = pod;
            updatedPod = {...restPod, ...restUpdates} as Pod;
        } else {
            updatedPod = {...pod, ...updates} as Pod;

            // 如果 updates 包含 schedule 且有值，初始化 lastTriggeredAt
            if (updates.schedule && !updates.schedule.lastTriggeredAt) {
                updatedPod.schedule = {...updates.schedule, lastTriggeredAt: null};
            }
        }

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
            canvasId,
            podId: id,
            status,
            previousStatus,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.POD_STATUS_CHANGED, payload);
    }

    updateLastActive(canvasId: string, id: string): void {
        this.modifyPod(canvasId, id, {lastActiveAt: new Date()});
    }

    setClaudeSessionId(canvasId: string, id: string, sessionId: string): void {
        this.modifyPod(canvasId, id, {claudeSessionId: sessionId}, true, sessionId);
    }

    setOutputStyleId(canvasId: string, id: string, outputStyleId: string | null): void {
        this.modifyPod(canvasId, id, {outputStyleId});
    }

    addSkillId(canvasId: string, podId: string, skillId: string): void {
        const pod = this.getById(canvasId, podId);
        if (!pod || pod.skillIds.includes(skillId)) {
            return;
        }

        this.modifyPod(canvasId, podId, {skillIds: [...pod.skillIds, skillId]});
    }

    addSubAgentId(canvasId: string, podId: string, subAgentId: string): void {
        const pod = this.getById(canvasId, podId);
        if (!pod || pod.subAgentIds.includes(subAgentId)) {
            return;
        }

        this.modifyPod(canvasId, podId, {subAgentIds: [...pod.subAgentIds, subAgentId]});
    }

    findBySubAgentId(canvasId: string, subAgentId: string): Pod[] {
        return this.findByPredicate(canvasId, (pod) => pod.subAgentIds.includes(subAgentId));
    }

    setRepositoryId(canvasId: string, id: string, repositoryId: string | null): void {
        this.modifyPod(canvasId, id, {repositoryId, needsForkSession: true});
    }

    setAutoClear(canvasId: string, id: string, autoClear: boolean): void {
        this.modifyPod(canvasId, id, {autoClear});
    }

    setCommandId(canvasId: string, podId: string, commandId: string | null): void {
        this.modifyPod(canvasId, podId, {commandId});
    }

    findByCommandId(canvasId: string, commandId: string): Pod[] {
        return this.findByPredicate(canvasId, (pod) => pod.commandId === commandId);
    }

    findByOutputStyleId(canvasId: string, outputStyleId: string): Pod[] {
        return this.findByPredicate(canvasId, (pod) => pod.outputStyleId === outputStyleId);
    }

    findBySkillId(canvasId: string, skillId: string): Pod[] {
        return this.findByPredicate(canvasId, (pod) => pod.skillIds.includes(skillId));
    }

    findByRepositoryId(canvasId: string, repositoryId: string): Pod[] {
        return this.findByPredicate(canvasId, (pod) => pod.repositoryId === repositoryId);
    }

    setScheduleLastTriggeredAt(canvasId: string, podId: string, date: Date): void {
        const pod = this.getById(canvasId, podId);
        if (!pod || !pod.schedule) {
            return;
        }

        this.modifyPod(canvasId, podId, {
            schedule: {...pod.schedule, lastTriggeredAt: date},
        });
    }

    getAllWithSchedule(): Array<{ canvasId: string; pod: Pod }> {
        const result: Array<{ canvasId: string; pod: Pod }> = [];

        for (const [canvasId, pods] of this.podsByCanvas.entries()) {
            for (const pod of pods.values()) {
                if (pod.schedule && pod.schedule.enabled) {
                    result.push({canvasId, pod});
                }
            }
        }

        return result;
    }

    private deserializePod(persistedPod: any, canvasDir: string): Pod {
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

        if (persistedPod.schedule) {
            pod.schedule = {
                ...persistedPod.schedule,
                lastTriggeredAt: persistedPod.schedule.lastTriggeredAt
                    ? new Date(persistedPod.schedule.lastTriggeredAt)
                    : null,
            };
        }

        return pod;
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
            if (!persistedPod) {
                continue;
            }

            const pod = this.deserializePod(persistedPod, canvasDir);
            pods.set(pod.id, pod);
        }

        logger.log('Pod', 'Load', `[PodStore] Successfully loaded ${pods.size} Pods for canvas ${canvasId}`);
        return ok(undefined);
    }
}

export const podStore = new PodStore();
