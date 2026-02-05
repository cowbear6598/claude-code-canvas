import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {workflowClearService} from '../workflowClearService.js';
import {socketService} from '../socketService.js';
import {terminalPodTracker} from './terminalPodTracker.js';
import {WebSocketResponseEvents} from '../../schemas/index.js';
import {logger} from '../../utils/logger.js';

function getAutoTriggerTargets(canvasId: string, podId: string): string[] {
    const connections = connectionStore.findBySourcePodId(canvasId, podId);
    const autoTriggerConnections = connections.filter((conn) => conn.autoTrigger);
    return autoTriggerConnections.map((conn) => conn.targetPodId);
}

class AutoClearService {
    findTerminalPods(canvasId: string, sourcePodId: string): string[] {
        const visitedPodIds = new Set<string>();
        const pendingPodIds: string[] = [sourcePodId];
        const terminalPodIds: string[] = [];

        visitedPodIds.add(sourcePodId);

        while (pendingPodIds.length > 0) {
            const currentPodId = pendingPodIds.shift()!;
            const autoTriggerTargets = getAutoTriggerTargets(canvasId, currentPodId);
            const hasAutoTriggerTargets = autoTriggerTargets.length > 0;

            if (currentPodId !== sourcePodId && !hasAutoTriggerTargets) {
                terminalPodIds.push(currentPodId);
            }

            if (hasAutoTriggerTargets) {
                for (const targetPodId of autoTriggerTargets) {
                    if (!visitedPodIds.has(targetPodId)) {
                        visitedPodIds.add(targetPodId);
                        pendingPodIds.push(targetPodId);
                    }
                }
            }
        }

        logger.log('AutoClear', 'List', `Found ${terminalPodIds.length} terminal PODs for source ${sourcePodId}: ${terminalPodIds.join(', ')}`);

        return terminalPodIds;
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
            logger.log('AutoClear', 'Complete', `All terminal PODs complete for source ${sourcePodId}, executing auto-clear`);
            await this.executeAutoClear(canvasId, sourcePodId);
            terminalPodTracker.clearTracking(sourcePodId);
            return;
        }

        if (!pod.autoClear) {
            return;
        }

        if (this.hasOutgoingAutoTrigger(canvasId, podId)) {
            logger.log('AutoClear', 'Update', `POD ${podId} has auto-trigger connections, skipping standalone auto-clear`);
            return;
        }

        logger.log('AutoClear', 'Complete', `Executing auto-clear for standalone POD ${podId}`);
        await this.executeAutoClear(canvasId, podId);
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

        const terminalPodIds = this.findTerminalPods(canvasId, sourcePodId);

        if (terminalPodIds.length === 0) {
            logger.log('AutoClear', 'Update', `No terminal PODs found for source ${sourcePodId}, skipping workflow tracking`);
            return;
        }

        terminalPodTracker.initializeTracking(sourcePodId, terminalPodIds);
    }

    async executeAutoClear(canvasId: string, sourcePodId: string): Promise<void> {
        logger.log('AutoClear', 'Complete', `Executing auto-clear for source POD ${sourcePodId}`);

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

        logger.log('AutoClear', 'Complete', `Successfully cleared ${result.clearedPodIds.length} PODs: ${result.clearedPodNames.join(', ')}`);
    }
}

export const autoClearService = new AutoClearService();
