import { promises as fs } from 'fs';
import path from 'path';
import { Group, GroupType } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

class GroupStore {
  async create(name: string, type: GroupType): Promise<Group> {
    const dirPath = path.join(this.getBasePath(type), name);

    await fs.mkdir(dirPath, { recursive: true });
    logger.log('Note', 'Create', `[GroupStore] 建立 Group 資料夾: ${name} (${type})`);

    return {
      id: name,
      name,
      type,
    };
  }

  async exists(name: string, type: GroupType): Promise<boolean> {
    const dirPath = path.join(this.getBasePath(type), name);
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
    const oldPath = path.join(this.getBasePath(type), oldName);
    const newPath = path.join(this.getBasePath(type), newName);

    try {
      await fs.rename(oldPath, newPath);
      logger.log('Note', 'Update', `[GroupStore] 重命名 Group: ${oldName} -> ${newName}`);

      return {
        id: newName,
        name: newName,
        type,
      };
    } catch (error) {
      logger.error('Note', 'Error', `[GroupStore] 重命名 Group 失敗: ${oldName}`, error);
      return undefined;
    }
  }

  async delete(name: string, type: GroupType): Promise<boolean> {
    const dirPath = path.join(this.getBasePath(type), name);

    try {
      await fs.rmdir(dirPath);
      logger.log('Note', 'Delete', `[GroupStore] 刪除 Group: ${name}`);
      return true;
    } catch (error) {
      logger.error('Note', 'Error', `[GroupStore] 刪除 Group 失敗: ${name}`, error);
      return false;
    }
  }

  async hasItems(name: string, type: GroupType): Promise<boolean> {
    const dirPath = path.join(this.getBasePath(type), name);

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
