import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {workflowClearService} from '../workflowClearService.js';
import {socketService} from '../socketService.js';
import {terminalPodTracker} from './terminalPodTracker.js';
import {workflowEventEmitter} from '../workflow/workflowEventEmitter.js';
import {WebSocketResponseEvents} from '../../schemas';
import {logger} from '../../utils/logger.js';

function getAutoTriggerTargets(canvasId: string, podId: string): string[] {
    const connections = connectionStore.findBySourcePodId(canvasId, podId);
    const triggerableConnections = connections.filter((conn) => conn.triggerMode === 'auto');
    return triggerableConnections.map((conn) => conn.targetPodId);
}

function isTerminalPod(podId: string, sourcePodId: string, hasAutoTriggerTargets: boolean): boolean {
    return podId !== sourcePodId && !hasAutoTriggerTargets;
}

// BFS visitor 介面：接收當前節點 id、是否為 terminal、以及 auto trigger 目標列表
type BfsVisitor = (podId: string, isTerminal: boolean, autoTriggerTargets: string[]) => void;

class AutoClearService {
    // BFS 遍歷找出所有 terminal PODs，並計算每個 terminal POD 預期被觸發的次數
    // propagatedCount 用來追蹤每個節點沿著 auto 路徑會被觸發幾次
    // direct incoming 連線視為一個整體（Direct 組），每個節點若有 direct 連入則 propagatedCount +1
    findTerminalPods(canvasId: string, sourcePodId: string): Map<string, number> {
        const visitedPodIds = new Set<string>();
        const pendingPodIds: string[] = [sourcePodId];
        const terminalPods = new Map<string, number>();
        const propagatedCounts = new Map<string, number>();

        visitedPodIds.add(sourcePodId);
        propagatedCounts.set(sourcePodId, 1);

        while (pendingPodIds.length > 0) {
            const currentPodId = pendingPodIds.shift()!;
            const currentCount = propagatedCounts.get(currentPodId) ?? 1;

            this.accumulateDirectBonus(canvasId, currentPodId, sourcePodId, currentCount, propagatedCounts);

            const updatedCount = propagatedCounts.get(currentPodId) ?? 1;
            const autoTriggerTargets = getAutoTriggerTargets(canvasId, currentPodId);
            const hasAutoTriggerTargets = autoTriggerTargets.length > 0;

            if (isTerminalPod(currentPodId, sourcePodId, hasAutoTriggerTargets)) {
                terminalPods.set(currentPodId, updatedCount);
            }

            this.enqueueAutoTriggerTargets(autoTriggerTargets, visitedPodIds, pendingPodIds, propagatedCounts, updatedCount);
        }

        return terminalPods;
    }

    hasOutgoingAutoTrigger(canvasId: string, podId: string): boolean {
        const autoTriggerTargets = getAutoTriggerTargets(canvasId, podId);
        return autoTriggerTargets.length > 0;
    }

    async onPodComplete(canvasId: string, podId: string): Promise<void> {
        const pod = podStore.getById(canvasId, podId);
        if (!pod) {
            return;
        }

        const {allComplete, sourcePodId} = terminalPodTracker.recordCompletion(podId);

        if (allComplete && sourcePodId) {
            // 先同步清除追蹤，避免 await 期間重入
            terminalPodTracker.clearTracking(sourcePodId);
            await this.executeAutoClear(canvasId, sourcePodId);
            return;
        }

        if (!pod.autoClear) {
            return;
        }

        if (this.hasOutgoingAutoTrigger(canvasId, podId)) {
            return;
        }

        logger.log('AutoClear', 'Complete', `Executing auto-clear for standalone POD ${podId}`);
        await this.executeAutoClear(canvasId, podId);
    }

    async onGroupNotTriggered(canvasId: string, targetPodId: string): Promise<void> {
        logger.log('AutoClear', 'Update', `Group not triggered for target ${targetPodId}, finding affected terminal PODs`);

        const affectedPodIds = this.findAffectedTerminalPods(canvasId, targetPodId);

        logger.log('AutoClear', 'Update', `Group not triggered for target ${targetPodId}, affected terminal PODs: ${affectedPodIds.join(', ')}`);

        for (const podId of affectedPodIds) {
            const { allComplete, sourcePodId } = terminalPodTracker.decrementExpectedCount(podId);
            if (allComplete && sourcePodId) {
                logger.log('AutoClear', 'Complete', `All terminal PODs complete after decrement for source ${sourcePodId}, executing auto-clear`);
                // 先同步清除追蹤，避免 await 期間重入；找到第一個完成即 break
                terminalPodTracker.clearTracking(sourcePodId);
                await this.executeAutoClear(canvasId, sourcePodId);
                break;
            }
        }
    }

    initializeWorkflowTracking(canvasId: string, sourcePodId: string): void {
        const pod = podStore.getById(canvasId, sourcePodId);
        if (!pod || !pod.autoClear) {
            return;
        }

        if (!this.hasOutgoingAutoTrigger(canvasId, sourcePodId)) {
            logger.log('AutoClear', 'Update', `Source POD ${sourcePodId} has no auto-trigger connections, skipping workflow tracking`);
            return;
        }

        const terminalPods = this.findTerminalPods(canvasId, sourcePodId);

        if (terminalPods.size === 0) {
            logger.log('AutoClear', 'Update', `No terminal PODs found for source ${sourcePodId}, skipping workflow tracking`);
            return;
        }

        terminalPodTracker.initializeTracking(sourcePodId, terminalPods);
    }

    async executeAutoClear(canvasId: string, sourcePodId: string): Promise<void> {

        const result = await workflowClearService.clearWorkflow(canvasId, sourcePodId);

        if (!result.success) {
            logger.error('AutoClear', 'Error', `Failed to execute auto-clear: ${result.error}`);
            return;
        }

        const payload = {
            canvasId,
            sourcePodId,
            clearedPodIds: result.clearedPodIds,
            clearedPodNames: result.clearedPodNames,
        };

        socketService.emitToCanvas(canvasId, WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED, payload);

        if (result.clearedConnectionIds.length > 0) {
            workflowEventEmitter.emitAiDecideClear(canvasId, result.clearedConnectionIds);
        }

        logger.log('AutoClear', 'Complete', `成功清除 ${result.clearedPodIds.length} 個 Pod：${result.clearedPodNames.join(', ')}`);
    }

    // 通用 BFS 工具：沿著 auto connection 遍歷圖，對每個節點呼叫 visitor
    // findTerminalPods 與 findAffectedTerminalPods 共用此 BFS 骨架
    private bfsAutoTriggerGraph(canvasId: string, startPodId: string, visitor: BfsVisitor): void {
        const visitedPodIds = new Set<string>();
        const pendingPodIds = [startPodId];

        visitedPodIds.add(startPodId);

        while (pendingPodIds.length > 0) {
            const currentPodId = pendingPodIds.shift()!;
            const autoTriggerTargets = getAutoTriggerTargets(canvasId, currentPodId);
            const hasAutoTriggerTargets = autoTriggerTargets.length > 0;
            const isTerminal = isTerminalPod(currentPodId, startPodId, hasAutoTriggerTargets);

            visitor(currentPodId, isTerminal, autoTriggerTargets);

            for (const nextPodId of autoTriggerTargets) {
                if (!visitedPodIds.has(nextPodId)) {
                    visitedPodIds.add(nextPodId);
                    pendingPodIds.push(nextPodId);
                }
            }
        }
    }

    // 處理 direct incoming connection 的 count 累加
    private accumulateDirectBonus(
        canvasId: string,
        podId: string,
        sourcePodId: string,
        currentCount: number,
        propagatedCounts: Map<string, number>
    ): void {
        if (podId === sourcePodId) {
            return;
        }

        const incomingConnections = connectionStore.findByTargetPodId(canvasId, podId);
        const hasDirectIncoming = incomingConnections.some(conn => conn.triggerMode === 'direct');
        if (hasDirectIncoming) {
            propagatedCounts.set(podId, currentCount + 1);
        }
    }

    // 將 auto trigger targets 加入 BFS queue，並更新 propagatedCounts
    private enqueueAutoTriggerTargets(
        targets: string[],
        visitedPodIds: Set<string>,
        pendingPodIds: string[],
        propagatedCounts: Map<string, number>,
        parentCount: number
    ): void {
        for (const targetPodId of targets) {
            if (!visitedPodIds.has(targetPodId)) {
                visitedPodIds.add(targetPodId);
                propagatedCounts.set(targetPodId, (propagatedCounts.get(targetPodId) ?? 0) + parentCount);
                pendingPodIds.push(targetPodId);
            }
        }
    }

    // forward BFS：從 targetPodId 沿著 auto connection 找到所有下游 terminal PODs
    private findAffectedTerminalPods(canvasId: string, targetPodId: string): string[] {
        const affectedPodIds: string[] = [];

        // isTerminalPod 在 podId === startPodId 時回傳 false，
        // 因此 targetPodId 本身若無 auto 出邊，需在 visitor 中特別判斷
        this.bfsAutoTriggerGraph(canvasId, targetPodId, (podId, isTerminal, autoTriggerTargets) => {
            if (isTerminal || (podId === targetPodId && autoTriggerTargets.length === 0)) {
                affectedPodIds.push(podId);
            }
        });

        return affectedPodIds;
    }
}

export const autoClearService = new AutoClearService();
