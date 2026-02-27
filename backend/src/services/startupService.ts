import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { noteStore, skillNoteStore, commandNoteStore, subAgentNoteStore, repositoryNoteStore } from './noteStores.js';
import { connectionStore } from './connectionStore.js';
import { scheduleService } from './scheduleService.js';
import { canvasStore } from './canvasStore.js';
import { repositoryService } from './repositoryService.js';
import { Result, ok, err } from '../types';
import { config } from '../config';
import { persistenceService } from './persistence';
import { logger } from '../utils/logger.js';

class StartupService {
  async initialize(): Promise<Result<void>> {
    const appDataResult = await persistenceService.ensureDirectory(config.appDataRoot);
    if (!appDataResult.success) {
      return err(`伺服器初始化失敗: ${appDataResult.error}`);
    }

    const canvasRootResult = await persistenceService.ensureDirectory(config.canvasRoot);
    if (!canvasRootResult.success) {
      return err(`伺服器初始化失敗: ${canvasRootResult.error}`);
    }

    const repoResult = await persistenceService.ensureDirectory(config.repositoriesRoot);
    if (!repoResult.success) {
      return err(`伺服器初始化失敗: ${repoResult.error}`);
    }

    await repositoryService.initialize();

    const canvasLoadResult = await canvasStore.loadFromDisk();
    if (!canvasLoadResult.success) {
      return err(`伺服器初始化失敗: ${canvasLoadResult.error}`);
    }

    const canvases = canvasStore.list();
    if (canvases.length === 0) {
      logger.log('Startup', 'Create', 'No canvases found, creating default canvas');
      const defaultCanvasResult = await canvasStore.create('default');
      if (!defaultCanvasResult.success) {
        return err(`建立預設 Canvas 失敗: ${defaultCanvasResult.error}`);
      }
      canvases.push(defaultCanvasResult.data!);
    }

    for (const canvas of canvases) {
      const canvasDir = canvasStore.getCanvasDir(canvas.id);
      const canvasDataDir = canvasStore.getCanvasDataDir(canvas.id);

      if (!canvasDir || !canvasDataDir) {
        logger.error('Startup', 'Error', `Failed to get directories for canvas ${canvas.id}`);
        continue;
      }

      const podLoadResult = await podStore.loadFromDisk(canvas.id, canvasDir);
      if (!podLoadResult.success) {
        logger.error('Startup', 'Error', `Failed to load pods for canvas ${canvas.id}: ${podLoadResult.error}`);
        continue;
      }

      const pods = podStore.getAll(canvas.id);
      const messageLoadPromises = pods.map((pod) =>
        messageStore.loadMessagesFromDisk(canvasDir, pod.id)
      );
      await Promise.all(messageLoadPromises);

      await noteStore.loadFromDisk(canvas.id, canvasDataDir);
      await skillNoteStore.loadFromDisk(canvas.id, canvasDataDir);
      await commandNoteStore.loadFromDisk(canvas.id, canvasDataDir);
      await subAgentNoteStore.loadFromDisk(canvas.id, canvasDataDir);
      await repositoryNoteStore.loadFromDisk(canvas.id, canvasDataDir);
      await connectionStore.loadFromDisk(canvas.id, canvasDataDir);

      logger.log('Startup', 'Complete', `已載入畫布：${canvas.name}`);
    }

    scheduleService.start();

    logger.log('Startup', 'Complete', '伺服器初始化完成');
    return ok(undefined);
  }
}

export const startupService = new StartupService();
