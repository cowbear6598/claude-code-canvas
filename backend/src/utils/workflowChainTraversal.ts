import {connectionStore} from '../services/connectionStore.js';
import {podStore} from '../services/podStore.js';
import {logger} from './logger.js';
import type {LogCategory} from './logger.js';
import {isPodBusy} from '../types/index.js';

const MAX_WORKFLOW_CHAIN_SIZE = 50;

function getAdjacentPodIds(canvasId: string, podId: string): string[] {
    const downstream = connectionStore.findBySourcePodId(canvasId, podId).map(conn => conn.targetPodId);
    const upstream = connectionStore.findByTargetPodId(canvasId, podId).map(conn => conn.sourcePodId);
    return [...downstream, ...upstream];
}

function processQueueItem(
    canvasId: string,
    currentId: string,
    visited: Set<string>,
    queue: string[],
    predicate: (podId: string) => boolean
): boolean {
    if (predicate(currentId)) return true;

    for (const adjacentId of getAdjacentPodIds(canvasId, currentId)) {
        if (!visited.has(adjacentId)) {
            visited.add(adjacentId);
            queue.push(adjacentId);
        }
    }
    return false;
}

function processBfsQueue(
    logCategory: LogCategory,
    canvasId: string,
    queue: string[],
    visited: Set<string>,
    predicate: (podId: string) => boolean
): boolean {
    while (queue.length > 0) {
        if (visited.size > MAX_WORKFLOW_CHAIN_SIZE) {
            logger.warn(logCategory, 'Warn', `Workflow 鏈超過最大限制 ${MAX_WORKFLOW_CHAIN_SIZE}，停止遍歷`);
            return false;
        }
        const currentId = queue.shift();
        if (!currentId) break;
        if (processQueueItem(canvasId, currentId, visited, queue, predicate)) return true;
    }
    return false;
}

// 需要雙向遍歷才能檢測到 Workflow 中間節點的狀態變化，單向遍歷會遺漏反向依賴
export function traverseWorkflowChain(
    logCategory: LogCategory,
    canvasId: string,
    startPodId: string,
    predicate: (podId: string) => boolean
): boolean {
    const visited = new Set<string>([startPodId]);
    const queue = getAdjacentPodIds(canvasId, startPodId).filter(id => !visited.has(id));
    queue.forEach(id => visited.add(id));
    return processBfsQueue(logCategory, canvasId, queue, visited, predicate);
}

export function isWorkflowChainBusy(canvasId: string, podId: string): boolean {
    return traverseWorkflowChain('Workflow', canvasId, podId, (currentId) => {
        const pod = podStore.getById(canvasId, currentId);
        return pod !== undefined && isPodBusy(pod.status);
    });
}
