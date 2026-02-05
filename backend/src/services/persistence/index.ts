import fs from 'fs/promises';
import path from 'path';
import { Result, ok, err } from '../../types';
import { logger } from '../../utils/logger.js';

class PersistenceService {
  async readJson<T>(filePath: string): Promise<Result<T | null>> {
    const exists = await this.fileExists(filePath);
    if (!exists) {
      return ok(null);
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');

    try {
      const data = JSON.parse(fileContent);
      return ok(data as T);
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('Startup', 'Error', `[Persistence] 無效的 JSON 檔案 ${filePath}: ${error.message}`);
        const backupPath = `${filePath}.corrupted.${Date.now()}`;
        try {
          await fs.copyFile(filePath, backupPath);
          logger.log('Startup', 'Save', `[Persistence] 已備份損壞的檔案至 ${backupPath}`);
        } catch (backupError) {
          logger.error('Startup', 'Error', `[Persistence] 備份損壞檔案失敗`, backupError);
        }
        return err(`JSON 檔案格式錯誤: ${filePath}`);
      }
      return err(`讀取檔案失敗: ${filePath}`);
    }
  }

  async writeJson<T>(filePath: string, data: T): Promise<Result<void>> {
    const directory = path.dirname(filePath);
    const dirResult = await this.ensureDirectory(directory);

    if (!dirResult.success) {
      return err(dirResult.error!);
    }

    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonContent, 'utf-8');
    return ok(undefined);
  }

  async ensureDirectory(dirPath: string): Promise<Result<void>> {
    await fs.mkdir(dirPath, { recursive: true });
    return ok(undefined);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<Result<void>> {
    try {
      await fs.unlink(filePath);
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return ok(undefined);
      }
      const message = error instanceof Error ? error.message : String(error);
      return err(`刪除檔案失敗: ${filePath} - ${message}`);
    }
  }
}

export const persistenceService = new PersistenceService();
