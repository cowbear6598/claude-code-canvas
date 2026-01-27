import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { noteStore } from './noteStore.js';
import { skillNoteStore } from './skillNoteStore.js';
import { repositoryNoteStore } from './repositoryNoteStore.js';
import { connectionStore } from './connectionStore.js';
import { config } from '../config/index.js';
import { persistenceService } from './persistence/index.js';

class StartupService {
  async initialize(): Promise<void> {
    console.log('[Startup] Initializing server...');

    try {
      await persistenceService.ensureDirectory(config.appDataRoot);
      console.log(`[Startup] App data root verified: ${config.appDataRoot}`);

      await persistenceService.ensureDirectory(config.canvasRoot);
      console.log(`[Startup] Canvas root verified: ${config.canvasRoot}`);

      await persistenceService.ensureDirectory(config.repositoriesRoot);
      console.log(`[Startup] Repositories root verified: ${config.repositoriesRoot}`);

      await podStore.loadFromDisk();
      const pods = podStore.getAll();
      console.log(`[Startup] Loaded ${pods.length} Pods from disk`);

      const messageLoadPromises = pods.map((pod) =>
        messageStore.loadMessagesFromDisk(pod.id)
      );
      const messageArrays = await Promise.all(messageLoadPromises);
      const totalMessages = messageArrays.reduce((sum, messages) => sum + messages.length, 0);

      console.log(`[Startup] Loaded ${totalMessages} messages from disk`);

      await noteStore.loadFromDisk();
      const notes = noteStore.list();
      console.log(`[Startup] Loaded ${notes.length} notes from disk`);

      await skillNoteStore.loadFromDisk();
      const skillNotes = skillNoteStore.list();
      console.log(`[Startup] Loaded ${skillNotes.length} skill notes from disk`);

      await repositoryNoteStore.loadFromDisk();
      const repositoryNotes = repositoryNoteStore.list();
      console.log(`[Startup] Loaded ${repositoryNotes.length} repository notes from disk`);

      await connectionStore.loadFromDisk();
      const connections = connectionStore.list();
      console.log(`[Startup] Loaded ${connections.length} connections from disk`);

      console.log('[Startup] Initialization complete');
    } catch (error) {
      console.error(`[Startup] Initialization failed: ${error}`);
      throw error;
    }
  }
}

export const startupService = new StartupService();
