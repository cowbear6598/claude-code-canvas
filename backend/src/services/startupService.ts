import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { noteStore } from './noteStore.js';
import { skillNoteStore } from './skillNoteStore.js';
import { repositoryNoteStore } from './repositoryNoteStore.js';
import { connectionStore } from './connectionStore.js';
import { Result, ok, err } from '../types/index.js';
import { config } from '../config/index.js';
import { persistenceService } from './persistence/index.js';

class StartupService {
  async initialize(): Promise<Result<void>> {
    console.log('[Startup] Initializing server...');

    const appDataResult = await persistenceService.ensureDirectory(config.appDataRoot);
    if (!appDataResult.success) {
      return err(`伺服器初始化失敗: ${appDataResult.error}`);
    }
    console.log(`[Startup] App data root verified: ${config.appDataRoot}`);

    const canvasResult = await persistenceService.ensureDirectory(config.canvasRoot);
    if (!canvasResult.success) {
      return err(`伺服器初始化失敗: ${canvasResult.error}`);
    }
    console.log(`[Startup] Canvas root verified: ${config.canvasRoot}`);

    const repoResult = await persistenceService.ensureDirectory(config.repositoriesRoot);
    if (!repoResult.success) {
      return err(`伺服器初始化失敗: ${repoResult.error}`);
    }
    console.log(`[Startup] Repositories root verified: ${config.repositoriesRoot}`);

    const podStoreResult = await podStore.loadFromDisk();
    if (!podStoreResult.success) {
      return err(`伺服器初始化失敗: ${podStoreResult.error}`);
    }
    const pods = podStore.getAll();
    console.log(`[Startup] Loaded ${pods.length} Pods from disk`);

    const messageLoadPromises = pods.map((pod) =>
      messageStore.loadMessagesFromDisk(pod.id)
    );
    const messageResults = await Promise.all(messageLoadPromises);
    const totalMessages = messageResults.reduce((sum, result) =>
      sum + (result.success ? result.data!.length : 0), 0
    );
    console.log(`[Startup] Loaded ${totalMessages} messages from disk`);

    const noteResult = await noteStore.loadFromDisk();
    if (!noteResult.success) {
      return err(`伺服器初始化失敗: ${noteResult.error}`);
    }
    const notes = noteStore.list();
    console.log(`[Startup] Loaded ${notes.length} notes from disk`);

    const skillNoteResult = await skillNoteStore.loadFromDisk();
    if (!skillNoteResult.success) {
      return err(`伺服器初始化失敗: ${skillNoteResult.error}`);
    }
    const skillNotes = skillNoteStore.list();
    console.log(`[Startup] Loaded ${skillNotes.length} skill notes from disk`);

    const repoNoteResult = await repositoryNoteStore.loadFromDisk();
    if (!repoNoteResult.success) {
      return err(`伺服器初始化失敗: ${repoNoteResult.error}`);
    }
    const repositoryNotes = repositoryNoteStore.list();
    console.log(`[Startup] Loaded ${repositoryNotes.length} repository notes from disk`);

    const connectionResult = await connectionStore.loadFromDisk();
    if (!connectionResult.success) {
      return err(`伺服器初始化失敗: ${connectionResult.error}`);
    }
    const connections = connectionStore.list();
    console.log(`[Startup] Loaded ${connections.length} connections from disk`);

    console.log('[Startup] Initialization complete');
    return ok(undefined);
  }
}

export const startupService = new StartupService();
