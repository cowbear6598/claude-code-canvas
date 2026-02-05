import { promises as fs } from 'fs';
import path from 'path';
import { Group, GroupType } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { sanitizePathSegment } from '../utils/pathValidator.js';

class GroupStore {
  async create(name: string, type: GroupType): Promise<Group> {
    const safeName = sanitizePathSegment(name);
    const dirPath = path.join(this.getBasePath(type), safeName);

    await fs.mkdir(dirPath, { recursive: true });
    logger.log('Note', 'Create', `[GroupStore] 建立 Group 資料夾: ${safeName} (${type})`);

    return {
      id: safeName,
      name: safeName,
      type,
    };
  }

  async exists(name: string, type: GroupType): Promise<boolean> {
    const safeName = sanitizePathSegment(name);
    const dirPath = path.join(this.getBasePath(type), safeName);
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async list(type: GroupType): Promise<Group[]> {
    const basePath = this.getBasePath(type);

    try {
      await fs.mkdir(basePath, { recursive: true });
      const entries = await fs.readdir(basePath, { withFileTypes: true });

      const groups: Group[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          groups.push({
            id: entry.name,
            name: entry.name,
            type,
          });
        }
      }

      return groups;
    } catch (error) {
      logger.error('Note', 'Error', `[GroupStore] 列出 Groups 失敗 (${type})`, error);
      return [];
    }
  }

  async update(oldName: string, newName: string, type: GroupType): Promise<Group | undefined> {
    const safeOldName = sanitizePathSegment(oldName);
    const safeNewName = sanitizePathSegment(newName);
    const oldPath = path.join(this.getBasePath(type), safeOldName);
    const newPath = path.join(this.getBasePath(type), safeNewName);

    try {
      await fs.rename(oldPath, newPath);
      logger.log('Note', 'Update', `[GroupStore] 重命名 Group: ${safeOldName} -> ${safeNewName}`);

      return {
        id: safeNewName,
        name: safeNewName,
        type,
      };
    } catch (error) {
      logger.error('Note', 'Error', `[GroupStore] 重命名 Group 失敗: ${safeOldName}`, error);
      return undefined;
    }
  }

  async delete(name: string, type: GroupType): Promise<boolean> {
    const safeName = sanitizePathSegment(name);
    const dirPath = path.join(this.getBasePath(type), safeName);

    try {
      await fs.rmdir(dirPath);
      logger.log('Note', 'Delete', `[GroupStore] 刪除 Group: ${safeName}`);
      return true;
    } catch (error) {
      logger.error('Note', 'Error', `[GroupStore] 刪除 Group 失敗: ${safeName}`, error);
      return false;
    }
  }

  async hasItems(name: string, type: GroupType): Promise<boolean> {
    const safeName = sanitizePathSegment(name);
    const dirPath = path.join(this.getBasePath(type), safeName);

    try {
      const entries = await fs.readdir(dirPath);
      const mdFiles = entries.filter((file) => file.endsWith('.md'));
      return mdFiles.length > 0;
    } catch {
      return false;
    }
  }

  private getBasePath(type: GroupType): string {
    switch (type) {
      case GroupType.COMMAND:
        return config.commandsPath;
      case GroupType.OUTPUT_STYLE:
        return config.outputStylesPath;
      case GroupType.SUBAGENT:
        return config.agentsPath;
      default:
        throw new Error(`未知的 GroupType: ${type}`);
    }
  }
}

export const groupStore = new GroupStore();
