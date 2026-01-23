import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { config } from '../config/index.js';
import { persistenceService } from './persistence/index.js';

class StartupService {
  async initialize(): Promise<void> {
    console.log('[Startup] Initializing server...');

    try {
      await persistenceService.ensureDirectory(config.workspaceRoot);
      console.log(`[Startup] Workspace root verified: ${config.workspaceRoot}`);

      await podStore.loadFromDisk();
      const pods = podStore.getAll();
      console.log(`[Startup] Loaded ${pods.length} Pods from disk`);

      const messageLoadPromises = pods.map((pod) =>
        messageStore.loadMessagesFromDisk(pod.id)
      );
      const messageArrays = await Promise.all(messageLoadPromises);
      const totalMessages = messageArrays.reduce((sum, messages) => sum + messages.length, 0);

      console.log(`[Startup] Loaded ${totalMessages} messages from disk`);
      console.log('[Startup] Initialization complete');
    } catch (error) {
      console.error(`[Startup] Initialization failed: ${error}`);
      throw error;
    }
  }
}

export const startupService = new StartupService();
