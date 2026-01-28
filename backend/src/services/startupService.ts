import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { noteStore } from './noteStore.js';
import { skillNoteStore } from './skillNoteStore.js';
import { subAgentNoteStore } from './subAgentNoteStore.js';
import { repositoryNoteStore } from './repositoryNoteStore.js';
import { connectionStore } from './connectionStore.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { persistenceService } from './persistence/index.js';
import { logger } from '../utils/logger.js';

class StartupService {
  async initialize(): Promise<Result<void>> {
    const appDataResult = await persistenceService.ensureDirectory(config.appDataRoot);
    if (!appDataResult.success) {
      return err(`伺服器初始化失敗: ${appDataResult.error}`);
    }

    const canvasResult = await persistenceService.ensureDirectory(config.canvasRoot);
    if (!canvasResult.success) {
      return err(`伺服器初始化失敗: ${canvasResult.error}`);
    }

    const repoResult = await persistenceService.ensureDirectory(config.repositoriesRoot);
    if (!repoResult.success) {
      return err(`伺服器初始化失敗: ${repoResult.error}`);
    }

    const podStoreResult = await podStore.loadFromDisk();
    if (!podStoreResult.success) {
      return err(`伺服器初始化失敗: ${podStoreResult.error}`);
    }

    const pods = podStore.getAll();
    const messageLoadPromises = pods.map((pod) =>
      messageStore.loadMessagesFromDisk(pod.id)
    );
    await Promise.all(messageLoadPromises);

    const noteResult = await noteStore.loadFromDisk();
    if (!noteResult.success) {
      return err(`伺服器初始化失敗: ${noteResult.error}`);
    }

    const skillNoteResult = await skillNoteStore.loadFromDisk();
    if (!skillNoteResult.success) {
      return err(`伺服器初始化失敗: ${skillNoteResult.error}`);
    }

    const subAgentNoteResult = await subAgentNoteStore.loadFromDisk();
    if (!subAgentNoteResult.success) {
      return err(`伺服器初始化失敗: ${subAgentNoteResult.error}`);
    }

    const repoNoteResult = await repositoryNoteStore.loadFromDisk();
    if (!repoNoteResult.success) {
      return err(`伺服器初始化失敗: ${repoNoteResult.error}`);
    }

    const connectionResult = await connectionStore.loadFromDisk();
    if (!connectionResult.success) {
      return err(`伺服器初始化失敗: ${connectionResult.error}`);
    }

    logger.log('Startup', 'Complete', 'Server initialization completed successfully');
    return ok(undefined);
  }
}

export const startupService = new StartupService();
