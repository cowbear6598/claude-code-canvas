import { v4 as uuidv4 } from 'uuid';
import { WebSocketResponseEvents } from '../schemas';
import type {
  PodChatMessagePayload,
  PodChatToolUsePayload,
  PodChatToolResultPayload,
  PodChatCompletePayload,
  Pod,
  ScheduleConfig,
} from '../types';
import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { claudeQueryService } from './claude/queryService.js';
import { socketService } from './socketService.js';
import { workflowExecutionService } from './workflow';
import { autoClearService } from './autoClear';
import { logger } from '../utils/logger.js';
import {
  createSubMessageState,
  createSubMessageFlusher,
  processTextEvent,
  processToolUseEvent,
  processToolResultEvent,
} from './claude/streamEventProcessor.js';

const TICK_INTERVAL_MS = 1000;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

type ShouldFireChecker = (schedule: ScheduleConfig, now: Date) => boolean;

const shouldFireCheckers: Record<ScheduleConfig['frequency'], ShouldFireChecker> = {
  'every-second': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedSeconds = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_SECOND;
    return elapsedSeconds >= schedule.second;
  },

  'every-x-minute': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedMinutes = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_MINUTE;
    return elapsedMinutes >= schedule.intervalMinute;
  },

  'every-x-hour': (schedule, now) => {
    if (!schedule.lastTriggeredAt) {
      return true;
    }
    const elapsedHours = (now.getTime() - schedule.lastTriggeredAt.getTime()) / MS_PER_HOUR;
    return elapsedHours >= schedule.intervalHour;
  },

  'every-day': (schedule, now) => {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    if (currentHour !== schedule.hour || currentMinute !== schedule.minute || currentSecond !== 0) {
      return false;
    }

    if (!schedule.lastTriggeredAt) {
      return true;
    }

    return !isSameDay(new Date(schedule.lastTriggeredAt), now);
  },

  'every-week': (schedule, now) => {
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

    if (!schedule.lastTriggeredAt) {
      return true;
    }

    return !isSameDay(new Date(schedule.lastTriggeredAt), now);
  },
};

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

class ScheduleService {
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.tickInterval) {
      logger.log('Schedule', 'Update', 'Scheduler already running');
      return;
    }

    this.tickInterval = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

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

  private shouldFire(schedule: ScheduleConfig, now: Date): boolean {
    const checker = shouldFireCheckers[schedule.frequency];
    return checker ? checker(schedule, now) : false;
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
    const accumulatedContentRef = { value: '' };
    const subMessageState = createSubMessageState();
    const flushCurrentSubMessage = createSubMessageFlusher(messageId, subMessageState);

    try {
      await claudeQueryService.sendMessage(podId, '', (event) => {
        switch (event.type) {
          case 'text': {
            processTextEvent(event.content, accumulatedContentRef, subMessageState);

            const textPayload: PodChatMessagePayload = {
              canvasId,
              podId,
              messageId,
              content: accumulatedContentRef.value,
              isPartial: true,
              role: 'assistant',
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CLAUDE_CHAT_MESSAGE,
              textPayload
            );
            break;
          }

          case 'tool_use': {
            processToolUseEvent(
              event.toolUseId,
              event.toolName,
              event.input,
              subMessageState,
              flushCurrentSubMessage
            );

            const toolUsePayload: PodChatToolUsePayload = {
              canvasId,
              podId,
              messageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CHAT_TOOL_USE,
              toolUsePayload
            );
            break;
          }

          case 'tool_result': {
            processToolResultEvent(event.toolUseId, event.output, subMessageState);

            const toolResultPayload: PodChatToolResultPayload = {
              canvasId,
              podId,
              messageId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              output: event.output,
            };
            socketService.emitToCanvas(
              canvasId,
              WebSocketResponseEvents.POD_CHAT_TOOL_RESULT,
              toolResultPayload
            );
            break;
          }

          case 'complete': {
            flushCurrentSubMessage();

            const completePayload: PodChatCompletePayload = {
              canvasId,
              podId,
              messageId,
              fullContent: accumulatedContentRef.value,
            };
            socketService.emitToCanvas(
              canvasId,
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
      }, 'schedule');

      await messageStore.addMessage(canvasId, podId, 'user', '');

      if (accumulatedContentRef.value || subMessageState.subMessages.length > 0) {
        await messageStore.addMessage(
          canvasId,
          podId,
          'assistant',
          accumulatedContentRef.value,
          subMessageState.subMessages.length > 0 ? subMessageState.subMessages : undefined
        );
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
