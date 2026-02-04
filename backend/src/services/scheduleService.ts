import { v4 as uuidv4 } from 'uuid';
import { WebSocketResponseEvents } from '../schemas/index.js';
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  PersistedSubMessage,
  PersistedToolUseInfo,
  Pod,
  ScheduleConfig,
} from '../types/index.js';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { claudeQueryService } from './claude/queryService.js';
import { socketService } from './socketService.js';
import { workflowExecutionService } from './workflow/index.js';
import { autoClearService } from './autoClear/index.js';
import { logger } from '../utils/logger.js';

class ScheduleService {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_INTERVAL_MS = 1000;
  private readonly MS_PER_SECOND = 1000;
  private readonly MS_PER_MINUTE = 60 * 1000;
  private readonly MS_PER_HOUR = 60 * 60 * 1000;

  start(): void {
    if (this.tickInterval) {
      logger.log('Schedule', 'Update', 'Scheduler already running');
      return;
    }

    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.TICK_INTERVAL_MS);

    logger.log('Schedule', 'Create', 'Schedule scheduler started');
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      logger.log('Schedule', 'Delete', 'Schedule scheduler stopped');
    }
  }

  private tick(): void {
    const now = new Date();
    const podsWithSchedule = podStore.getAllWithSchedule();

    for (const { canvasId, pod } of podsWithSchedule) {
      if (pod.schedule && this.shouldFire(pod.schedule, now)) {
        this.fireSchedule(canvasId, pod, now).catch((error) => {
          logger.error('Schedule', 'Error', `Failed to fire schedule for Pod ${pod.id}`, error);
        });
      }
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private shouldFire(schedule: ScheduleConfig, now: Date): boolean {
    const { frequency, lastTriggeredAt } = schedule;

    if (frequency === 'every-second') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedSeconds = (now.getTime() - lastTriggeredAt.getTime()) / this.MS_PER_SECOND;
      return elapsedSeconds >= schedule.second;
    }

    if (frequency === 'every-x-minute') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedMinutes = (now.getTime() - lastTriggeredAt.getTime()) / this.MS_PER_MINUTE;
      return elapsedMinutes >= schedule.intervalMinute;
    }

    if (frequency === 'every-x-hour') {
      if (!lastTriggeredAt) {
        return true;
      }

      const elapsedHours = (now.getTime() - lastTriggeredAt.getTime()) / this.MS_PER_HOUR;
      return elapsedHours >= schedule.intervalHour;
    }

    if (frequency === 'every-day') {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      if (currentHour !== schedule.hour || currentMinute !== schedule.minute || currentSecond !== 0) {
        return false;
      }

      if (!lastTriggeredAt) {
        return true;
      }

      return !this.isSameDay(new Date(lastTriggeredAt), now);
    }

    if (frequency === 'every-week') {
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      if (!schedule.weekdays.includes(currentDay)) {
        return false;
      }

      if (currentHour !== schedule.hour || currentMinute !== schedule.minute || currentSecond !== 0) {
        return false;
      }

      if (!lastTriggeredAt) {
        return true;
      }

      return !this.isSameDay(new Date(lastTriggeredAt), now);
    }

    return false;
  }

  private async fireSchedule(canvasId: string, pod: Pod, now: Date): Promise<void> {
    // 檢查 Pod 是否為 idle
    if (pod.status !== 'idle') {
      logger.log('Schedule', 'Update', `Pod ${pod.id} is busy, skipping schedule fire`);
      return;
    }

    // 更新最後觸發時間
    podStore.setScheduleLastTriggeredAt(canvasId, pod.id, now);

    // 發送 SCHEDULE_FIRED 事件
    socketService.emitToCanvas(canvasId, WebSocketResponseEvents.SCHEDULE_FIRED, {
      podId: pod.id,
      timestamp: now.toISOString(),
    });

    logger.log('Schedule', 'Update', `Schedule fired for Pod ${pod.id}`);

    // 發送空訊息給 Pod
    await this.sendScheduleMessage(canvasId, pod.id);
  }

  private async sendScheduleMessage(canvasId: string, podId: string): Promise<void> {
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
              WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
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
            logger.error('Schedule', 'Error', `Stream error for Pod ${podId}: ${event.error}`);
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
        logger.error('Schedule', 'Error', `Failed to check auto-clear for Pod ${podId}`, error);
      });

      workflowExecutionService.checkAndTriggerWorkflows(canvasId, podId).catch((error) => {
        logger.error('Schedule', 'Error', `Failed to check auto-trigger workflows for Pod ${podId}`, error);
      });
    } catch (error) {
      podStore.setStatus(canvasId, podId, 'idle');
      logger.error('Schedule', 'Error', `Failed to execute schedule message for Pod ${podId}`, error);
      throw error;
    }
  }
}

export const scheduleService = new ScheduleService();
