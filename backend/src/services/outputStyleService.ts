import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import type { OutputStyleListItem } from '../types/index.js';

class OutputStyleService {
  async listStyles(): Promise<OutputStyleListItem[]> {
    try {
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
    } catch (error) {
      console.error('[OutputStyleService] Failed to list styles:', error);
      throw new Error('Failed to list output styles');
    }
  }

  async getStyleContent(styleId: string): Promise<string | null> {
    try {
      const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      console.error(`[OutputStyleService] Failed to read style ${styleId}:`, error);
      throw new Error(`Failed to read output style: ${styleId}`);
    }
  }

  async exists(styleId: string): Promise<boolean> {
    try {
      const filePath = path.join(config.outputStylesPath, `${styleId}.md`);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const outputStyleService = new OutputStyleService();
