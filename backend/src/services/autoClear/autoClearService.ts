import {connectionStore} from '../connectionStore.js';
import {podStore} from '../podStore.js';
import {workflowClearService} from '../workflowClearService.js';
import {socketService} from '../socketService.js';
import {terminalPodTracker} from './terminalPodTracker.js';
import {WebSocketResponseEvents} from '../../schemas/index.js';
import {logger} from '../../utils/logger.js';

class AutoClearService {
    findTerminalPods(canvasId: string, sourcePodId: string): string[] {
        const visited = new Set<string>();
        const queue: string[] = [sourcePodId];
        const terminalPods: string[] = [];

        visited.add(sourcePodId);

        while (queue.length > 0) {
            const currentPodId = queue.shift()!;
            const hasOutgoingAutoTrigger = this.hasOutgoingAutoTrigger(canvasId, currentPodId);

            if (currentPodId !== sourcePodId && !hasOutgoingAutoTrigger) {
                terminalPods.push(currentPodId);
            }

            if (hasOutgoingAutoTrigger) {
                const outgoingConnections = connectionStore
                    .findBySourcePodId(canvasId, currentPodId)
                    .filter((conn) => conn.autoTrigger);

                for (const connection of outgoingConnections) {
                    const targetPodId = connection.targetPodId;
                    if (!visited.has(targetPodId)) {
                        visited.add(targetPodId);
                        queue.push(targetPodId);
                    }
                }
            }
        }

        logger.log('AutoClear', 'List', `Found ${terminalPods.length} terminal PODs for source ${sourcePodId}: ${terminalPods.join(', ')}`);

        return terminalPods;
    }

    hasOutgoingAutoTrigger(canvasId: string, podId: string): boolean {
        const outgoingConnections = connectionStore.findBySourcePodId(canvasId, podId);
        return outgoingConnections.some((conn) => conn.autoTrigger);
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
        try {
            logger.log('AutoClear', 'Complete', `Executing auto-clear for source POD ${sourcePodId}`);

            const result = await workflowClearService.clearWorkflow(canvasId, sourcePodId);

            if (!result.success) {
                logger.error('AutoClear', 'Error', `Failed to execute auto-clear: ${result.error}`);
                return;
            }

            const payload = {
                sourcePodId,
                clearedPodIds: result.clearedPodIds,
                clearedPodNames: result.clearedPodNames,
            };

            for (const podId of result.clearedPodIds) {
                socketService.emitToPod(podId, WebSocketResponseEvents.WORKFLOW_AUTO_CLEARED, payload);
            }

            logger.log('AutoClear', 'Complete', `Successfully cleared ${result.clearedPodIds.length} PODs: ${result.clearedPodNames.join(', ')}`);
        } catch (error) {
            logger.error('AutoClear', 'Error', 'Error during auto-clear execution', error);
        }
    }
}

export const autoClearService = new AutoClearService();
