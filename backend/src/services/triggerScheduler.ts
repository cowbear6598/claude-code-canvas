import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketResponseEvents,
  type PodChatMessagePayload,
  type PodChatToolUsePayload,
  type PodChatToolResultPayload,
  type PodChatCompletePayload,
  type TriggerFiredPayload,
  type PersistedSubMessage,
  type PersistedToolUseInfo,
  type Trigger as TriggerType,
} from '../types/index.js';
import { triggerStore } from './triggerStore.js';
import { connectionStore } from './connectionStore.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { claudeQueryService } from './claude/queryService.js';
import { socketService } from './socketService.js';
import { workflowExecutionService } from './workflow/index.js';
import { autoClearService } from './autoClear/index.js';
import { logger } from '../utils/logger.js';

class TriggerScheduler {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_INTERVAL_MS = 1000;

  start(): void {
    if (this.tickInterval) {
      logger.log('Trigger', 'Update', 'Scheduler already running');
      return;
    }

    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.TICK_INTERVAL_MS);

    logger.log('Trigger', 'Create', 'Trigger scheduler started');
  }
    private tick(): void {
    const now = new Date();
    const allTriggers = triggerStore.listAll();
    const enabledTriggers = allTriggers.filter(({ trigger }) => trigger.enabled);

    for (const { canvasId, trigger } of enabledTriggers) {
      if (this.shouldFire(trigger, now)) {
        this.fireTrigger(canvasId, trigger, now).catch((error) => {
          logger.error('Trigger', 'Error', `Failed to fire trigger ${trigger.id}`, error);
        });
      }
    }
  }

  private shouldFire(trigger: TriggerType, now: Date): boolean {
    const { config, lastTriggeredAt } = trigger;

    if (config.frequency === 'every-second') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedSeconds = (now.getTime() - lastTriggeredAt.getTime()) / 1000;
      return elapsedSeconds >= config.second;
    }

    if (config.frequency === 'every-x-minute') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedMinutes = (now.getTime() - lastTriggeredAt.getTime()) / (1000 * 60);
      return elapsedMinutes >= config.intervalMinute;
    }

    if (config.frequency === 'every-x-hour') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedHours = (now.getTime() - lastTriggeredAt.getTime()) / (1000 * 60 * 60);
      return elapsedHours >= config.intervalHour;
    }

    if (config.frequency === 'every-day') {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      if (currentHour !== config.hour || currentMinute !== config.minute || currentSecond !== 0) {
        return false;
      }

      if (!lastTriggeredAt) {
        return true;
      }

      const lastDate = new Date(lastTriggeredAt);
      const isSameDay =
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth() &&
        lastDate.getDate() === now.getDate();

      return !isSameDay;
    }

    if (config.frequency === 'every-week') {
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      if (!config.weekdays.includes(currentDay)) {
        return false;
      }

      if (currentHour !== config.hour || currentMinute !== config.minute || currentSecond !== 0) {
        return false;
      }

      if (!lastTriggeredAt) {
        return true;
      }

      const lastDate = new Date(lastTriggeredAt);
      const isSameDay =
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth() &&
        lastDate.getDate() === now.getDate();

      return !isSameDay;
    }

    return false;
  }

  private async fireTrigger(canvasId: string, trigger: TriggerType, now: Date): Promise<void> {
    const connections = connectionStore.findByTriggerId(canvasId, trigger.id);

    if (connections.length === 0) {
      triggerStore.setLastTriggeredAt(canvasId, trigger.id, now);
      socketService.emitToAll(WebSocketResponseEvents.TRIGGER_FIRED, {
        triggerId: trigger.id,
        timestamp: now.toISOString(),
        firedPodIds: [],
        skippedPodIds: [],
      });
      logger.log('Trigger', 'Update', `Trigger ${trigger.id} fired (no connections)`);
      return;
    }

    const targetPodIds = [...new Set(connections.map((conn) => conn.targetPodId))];

    const firedPodIds: string[] = [];
    const skippedPodIds: string[] = [];

    for (const podId of targetPodIds) {
      if (this.canFirePod(canvasId, podId)) {
        firedPodIds.push(podId);
      } else {
        skippedPodIds.push(podId);
      }
    }

    if (firedPodIds.length === 0) {
      logger.log('Trigger', 'Update', `Trigger ${trigger.id} has no available pods, all busy`);
      return;
    }

    const firePromises = firedPodIds.map((podId) =>
      this.sendTriggerMessage(canvasId, podId).catch((error) => {
        logger.error('Trigger', 'Error', `Failed to send trigger message to Pod ${podId}`, error);
      })
    );

    triggerStore.setLastTriggeredAt(canvasId, trigger.id, now);

    const payload: TriggerFiredPayload = {
      triggerId: trigger.id,
      timestamp: now.toISOString(),
      firedPodIds,
      skippedPodIds,
    };

    socketService.emitToAll(WebSocketResponseEvents.TRIGGER_FIRED, payload);

    Promise.allSettled(firePromises).catch(() => {});

    logger.log('Trigger', 'Complete', `Trigger ${trigger.id} fired: ${firedPodIds.length} pods triggered, ${skippedPodIds.length} pods skipped`);
  }

  private canFirePod(canvasId: string, podId: string): boolean {
    const pod = podStore.getById(canvasId, podId);
    if (!pod) {
      return false;
    }

    if (pod.status !== 'idle') {
      return false;
    }

    const downstreamConnections = connectionStore.findBySourcePodId(canvasId, podId);

    if (downstreamConnections.length === 0) {
      return true;
    }

    const allDownstreamPodIds = this.collectAllDownstreamPodIds(canvasId, podId);

    for (const downstreamPodId of allDownstreamPodIds) {
      const downstreamPod = podStore.getById(canvasId, downstreamPodId);
      if (!downstreamPod || downstreamPod.status !== 'idle') {
        return false;
      }
    }

    return true;
  }

  private collectAllDownstreamPodIds(canvasId: string, podId: string): string[] {
    const visited = new Set<string>();
    const queue: string[] = [podId];
    const downstreamPodIds: string[] = [];

    while (queue.length > 0) {
      const currentPodId = queue.shift()!;

      if (visited.has(currentPodId)) {
        continue;
      }

      visited.add(currentPodId);

      if (currentPodId !== podId) {
        downstreamPodIds.push(currentPodId);
      }

      const connections = connectionStore.findBySourcePodId(canvasId, currentPodId);

      for (const connection of connections) {
        if (!visited.has(connection.targetPodId)) {
          queue.push(connection.targetPodId);
        }
      }
    }

    return downstreamPodIds;
  }

  private async sendTriggerMessage(canvasId: string, podId: string): Promise<void> {
    podStore.setStatus(canvasId, podId, 'chatting');

    const messageId = uuidv4();

    let accumulatedContent = '';
    const subMessages: PersistedSubMessage[] = [];
    let currentSubContent = '';
    let currentSubToolUse: PersistedToolUseInfo[] = [];
    let subMessageCounter = 0;

    const flushCurrentSubMessage = (): void => {
      if (currentSubContent || currentSubToolUse.length > 0) {
        subMessages.push({
          id: `${messageId}-sub-${subMessageCounter++}`,
          content: currentSubContent,
          toolUse: currentSubToolUse.length > 0 ? [...currentSubToolUse] : undefined,
        });
        currentSubContent = '';
        currentSubToolUse = [];
      }
    };

    try {
      await claudeQueryService.sendMessage(podId, '', (event) => {
        switch (event.type) {
          case 'text': {
            accumulatedContent += event.content;
            currentSubContent += event.content;

            const textPayload: PodChatMessagePayload = {
              podId,
              messageId,
              content: accumulatedContent,
              isPartial: true,
              role: 'assistant',
            };
            socketService.emitToPod(
              podId,
              WebSocketResponseEvents.POD_CHAT_MESSAGE,
              textPayload
            );
            break;
          }

          case 'tool_use': {
            currentSubToolUse.push({
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
              status: 'completed',
            });
            flushCurrentSubMessage();

            const toolUsePayload: PodChatToolUsePayload = {
              podId,
              messageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
            };
            socketService.emitToPod(
              podId,
              WebSocketResponseEvents.POD_CHAT_TOOL_USE,
              toolUsePayload
            );
            break;
          }

          case 'tool_result': {
            for (const sub of subMessages) {
              if (sub.toolUse) {
                const tool = sub.toolUse.find(t => t.toolUseId === event.toolUseId);
                if (tool) {
                  tool.output = event.output;
                  break;
                }
              }
            }
            const currentTool = currentSubToolUse.find(t => t.toolUseId === event.toolUseId);
            if (currentTool) {
              currentTool.output = event.output;
            }

            const toolResultPayload: PodChatToolResultPayload = {
              podId,
              messageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              output: event.output,
            };
            socketService.emitToPod(
              podId,
              WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
              toolResultPayload
            );
            break;
          }

          case 'complete': {
            flushCurrentSubMessage();

            const completePayload: PodChatCompletePayload = {
              podId,
              messageId,
              fullContent: accumulatedContent,
            };
            socketService.emitToPod(
              podId,
              WebSocketResponseEvents.POD_CHAT_COMPLETE,
              completePayload
            );
            break;
          }

          case 'error': {
            logger.error('Trigger', 'Error', `Stream error for Pod ${podId}: ${event.error}`);
            break;
          }
        }
      });

      await messageStore.addMessage(canvasId, podId, 'user', '');

      if (accumulatedContent || subMessages.length > 0) {
        await messageStore.addMessage(canvasId, podId, 'assistant', accumulatedContent, subMessages.length > 0 ? subMessages : undefined);
      }

      podStore.setStatus(canvasId, podId, 'idle');
      podStore.updateLastActive(canvasId, podId);

      autoClearService.onPodComplete(canvasId, podId).catch((error) => {
        logger.error('Trigger', 'Error', `Failed to check auto-clear for Pod ${podId}`, error);
      });

      workflowExecutionService.checkAndTriggerWorkflows(canvasId, podId).catch((error) => {
        logger.error('Trigger', 'Error', `Failed to check auto-trigger workflows for Pod ${podId}`, error);
      });
    } catch (error) {
      podStore.setStatus(canvasId, podId, 'idle');
      logger.error('Trigger', 'Error', `Failed to execute trigger message for Pod ${podId}`, error);
      throw error;
    }
  }
}

export const triggerScheduler = new TriggerScheduler();
