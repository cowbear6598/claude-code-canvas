import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export async function readFileOrNull(filePath: string): Promise<string | null> {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function ensureDirectoryAndWriteFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, content, 'utf-8');
}

export async function readJsonFileOrDefault<T>(filePath: string): Promise<T[] | null> {
    const exists = await fileExists(filePath);
    if (!exists) {
        return null;
    }

    const data = await fs.readFile(filePath, 'utf-8');

    try {
        return JSON.parse(data) as T[];
    } catch (error) {
        logger.error('Startup', 'Error', `[FileResource] 無效的 JSON 檔案 ${filePath}`, error);
        return null;
    }
}

export function parseFrontmatterDescription(content: string): string {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return 'No description available';
    }

    const frontmatterContent = match[1];
    const descriptionMatch = frontmatterContent.match(/^description:\s*(.+)$/m);

    return descriptionMatch ? descriptionMatch[1].trim() : 'No description available';
}
