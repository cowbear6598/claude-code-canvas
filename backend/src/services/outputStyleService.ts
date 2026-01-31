import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import type { OutputStyleListItem } from '../types/index.js';

class OutputStyleService {
  async listStyles(): Promise<OutputStyleListItem[]> {
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

  async getStyleContent(styleId: string): Promise<string | null> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async getContent(styleId: string): Promise<string | null> {
    return this.getStyleContent(styleId);
  }

  async exists(styleId: string): Promise<boolean> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(styleId: string): Promise<void> {
    const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
    await fs.unlink(filePath);
  }

  async create(name: string, content: string): Promise<{ id: string; name: string }> {
    await fs.mkdir(config.outputStylesPath, { recursive: true });

    const filePath = path.join(config.outputStylesPath, `${name}.md`);
    await fs.writeFile(filePath, content, 'utf-8');

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
