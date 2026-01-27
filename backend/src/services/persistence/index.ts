// Core Persistence Service
// Provides low-level file I/O operations for JSON data

import fs from 'fs/promises';
import path from 'path';
import { Result, ok, err } from '../../types/index.js';

class PersistenceService {
  /**
   * Read and parse JSON file
   * @param filePath Absolute path to JSON file
   * @returns Parsed data or null if file doesn't exist
   */
  async readJson<T>(filePath: string): Promise<Result<T | null>> {
    const exists = await this.fileExists(filePath);
    if (!exists) {
      return ok(null);
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');

    // JSON.parse 可能拋出 SyntaxError，需要保留 try-catch
    try {
      const data = JSON.parse(fileContent);
      return ok(data as T);
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`[Persistence] Invalid JSON in file ${filePath}: ${error.message}`);
        // Optionally backup corrupted file
        const backupPath = `${filePath}.corrupted.${Date.now()}`;
        try {
          await fs.copyFile(filePath, backupPath);
          console.log(`[Persistence] Backed up corrupted file to ${backupPath}`);
        } catch (backupError) {
          console.error(`[Persistence] Failed to backup corrupted file: ${backupError}`);
        }
        return err(`JSON 檔案格式錯誤: ${filePath}`);
      }
      return err(`讀取檔案失敗: ${filePath}`);
    }
  }

  /**
   * Write data as formatted JSON
   * @param filePath Absolute path to JSON file
   * @param data Data to write
   */
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

  /**
   * Create directory if not exists (recursive)
   * @param dirPath Absolute path to directory
   */
  async ensureDirectory(dirPath: string): Promise<Result<void>> {
    await fs.mkdir(dirPath, { recursive: true });
    return ok(undefined);
  }

  /**
   * Check if file exists
   * @param filePath Absolute path to file
   * @returns True if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file if exists
   * @param filePath Absolute path to file
   */
  async deleteFile(filePath: string): Promise<Result<void>> {
    const exists = await this.fileExists(filePath);
    if (!exists) {
      return ok(undefined);
    }

    await fs.unlink(filePath);
    return ok(undefined);
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService();
