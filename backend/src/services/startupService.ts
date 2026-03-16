import { promises as fs } from 'fs';
import { scheduleService } from './scheduleService.js';
import { canvasStore } from './canvasStore.js';
import { Result, ok, err } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errorHelpers.js';
import { integrationRegistry, integrationAppStore } from './integration/index.js';
import './integration/providers/index.js';
import { getDb } from '../database/index.js';

class StartupService {
  async initialize(): Promise<Result<void>> {
    const dirResult = await this.ensureDirectories([
      config.appDataRoot,
      config.canvasRoot,
      config.repositoriesRoot,
    ]);
    if (!dirResult.success) {
      return dirResult;
    }

    getDb();

    const canvases = canvasStore.list();
    if (canvases.length === 0) {
      logger.log('Startup', 'Create', '未找到任何畫布，建立預設畫布');
      const defaultCanvasResult = await canvasStore.create('default');
      if (!defaultCanvasResult.success) {
        return err(`建立預設 Canvas 失敗: ${defaultCanvasResult.error}`);
      }
    }

    scheduleService.start();

    this.restoreIntegrationConnections().catch((error) => {
      logger.error('Integration', 'Error', '[StartupService] Integration 連線恢復時發生非預期錯誤', error);
    });

    logger.log('Startup', 'Complete', '伺服器初始化完成');
    return ok(undefined);
  }

  private async ensureDirectories(paths: string[]): Promise<Result<void>> {
    for (const dirPath of paths) {
      const result = await fs.mkdir(dirPath, {recursive: true}).then(() => ok(undefined)).catch((e) => err(`伺服器初始化失敗: 建立目錄 ${dirPath} 失敗: ${getErrorMessage(e)}`));
      if (!result.success) return result;
    }
    return ok(undefined);
  }

  private async restoreIntegrationConnections(): Promise<void> {
    const providers = integrationRegistry.list();
    for (const provider of providers) {
      const apps = integrationAppStore.list(provider.name);
      if (apps.length === 0) continue;

      let successCount = 0;
      for (const app of apps) {
        try {
          await provider.initialize(app);
          successCount++;
        } catch (error) {
          logger.error('Integration', 'Error', `[StartupService] ${provider.name}:${app.id} 初始化失敗`, error);
        }
      }

      logger.log('Integration', 'Complete', `[StartupService] ${provider.name} 已恢復 ${successCount} 個連線`);
    }
  }
}

export const startupService = new StartupService();
