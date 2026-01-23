// Core Persistence Service
// Provides low-level file I/O operations for JSON data

import fs from 'fs/promises';
import path from 'path';

class PersistenceService {
  /**
   * Read and parse JSON file
   * @param filePath Absolute path to JSON file
   * @returns Parsed data or null if file doesn't exist
   */
  async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const exists = await this.fileExists(filePath);
      if (!exists) {
        return null;
      }

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      return data as T;
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
      } else {
        console.error(`[Persistence] Error reading file ${filePath}: ${error}`);
      }
      return null;
    }
  }

  /**
   * Write data as formatted JSON
   * @param filePath Absolute path to JSON file
   * @param data Data to write
   */
  async writeJson<T>(filePath: string, data: T): Promise<void> {
    try {
      // Ensure directory exists
      const directory = path.dirname(filePath);
      await this.ensureDirectory(directory);

      // Write formatted JSON
      const jsonContent = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonContent, 'utf-8');
    } catch (error) {
      console.error(`[Persistence] Error writing file ${filePath}: ${error}`);
      throw error;
    }
  }

  /**
   * Create directory if not exists (recursive)
   * @param dirPath Absolute path to directory
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`[Persistence] Error creating directory ${dirPath}: ${error}`);
      throw error;
    }
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
  async deleteFile(filePath: string): Promise<void> {
    try {
      const exists = await this.fileExists(filePath);
      if (exists) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error(`[Persistence] Error deleting file ${filePath}: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const persistenceService = new PersistenceService();
