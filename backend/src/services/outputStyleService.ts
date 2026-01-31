import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import type { OutputStyleListItem } from '../types/index.js';
import {readFileOrNull, fileExists, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';

class OutputStyleService {
  async list(): Promise<OutputStyleListItem[]> {
    await fs.mkdir(config.outputStylesPath, { recursive: true });
    const files = await fs.readdir(config.outputStylesPath);

    const styles: OutputStyleListItem[] = [];

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      const id = file.replace(/\.md$/, '');
      styles.push({
        id,
        name: id,
      });
    }

    return styles;
  }

  async getContent(styleId: string): Promise<string | null> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
    return readFileOrNull(filePath);
  }

  async exists(styleId: string): Promise<boolean> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
    return fileExists(filePath);
  }

  async delete(styleId: string): Promise<void> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
    await fs.unlink(filePath);
  }

  async create(name: string, content: string): Promise<{ id: string; name: string }> {
    const filePath = path.join(config.outputStylesPath, `${name}.md`);
    await ensureDirectoryAndWriteFile(filePath, content);

    return {
      id: name,
      name,
    };
  }

  async update(styleId: string, content: string): Promise<void> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

export const outputStyleService = new OutputStyleService();
