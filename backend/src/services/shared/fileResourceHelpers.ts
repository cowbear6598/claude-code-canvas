import fs from 'fs/promises';
import path from 'path';

/**
 * Read file content, return null if file not found (ENOENT)
 */
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

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure directory exists and write file
 */
export async function ensureDirectoryAndWriteFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), {recursive: true});
    await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Parse frontmatter description from markdown content
 */
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
