import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export async function readFileOrNull(filePath: string): Promise<string | null> {
    if (!await fileExists(filePath)) {
        return null;
    }
    return await fs.readFile(filePath, 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
    return Bun.file(filePath).exists();
}

export async function directoryExists(dirPath: string): Promise<boolean> {
    const stat = await fs.stat(dirPath).catch(() => null);
    return stat?.isDirectory() ?? false;
}

export async function ensureDirectoryAndWriteFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, content, 'utf-8');
}

export function safeJsonParse<T>(data: string): T | null {
    try {
        return JSON.parse(data) as T;
    } catch {
        return null;
    }
}

export async function readJsonFileOrDefault<T>(filePath: string): Promise<T[] | null> {
    const exists = await fileExists(filePath);
    if (!exists) {
        return null;
    }

    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = safeJsonParse<T[]>(data);

    if (parsed === null) {
        logger.error('Startup', 'Error', `[FileResource] 無效的 JSON 檔案 ${filePath}`);
        return null;
    }

    return parsed;
}

export async function copyResourceFile(srcPath: string, destBasePath: string, subDir: string, fileName: string): Promise<void> {
    const destPath = path.join(destBasePath, '.claude', subDir, fileName);
    await fs.mkdir(path.dirname(destPath), {recursive: true});
    await fs.copyFile(srcPath, destPath);
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
