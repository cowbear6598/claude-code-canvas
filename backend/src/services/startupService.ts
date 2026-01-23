// Startup Service
// Handles server initialization and data loading

import { podStore } from './podStore.js';
import { messageStore } from './messageStore.js';
import { config } from '../config/index.js';
import { persistenceService } from './persistence/index.js';

class StartupService {
  /**
   * Initialize server on startup
   * - Ensure workspace directory exists
   * - Load Pods from disk
   * - Load chat histories for each Pod
   */
  async initialize(): Promise<void> {
    console.log('[Startup] Initializing server...');

    try {
      // Ensure workspace root directory exists
      await persistenceService.ensureDirectory(config.workspaceRoot);
      console.log(`[Startup] Workspace root verified: ${config.workspaceRoot}`);

      // Load all Pods from disk
      await podStore.loadFromDisk();
      const pods = podStore.getAll();
      console.log(`[Startup] Loaded ${pods.length} Pods from disk`);

      // Load chat history for all Pods in parallel
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

// Export singleton instance
export const startupService = new StartupService();
