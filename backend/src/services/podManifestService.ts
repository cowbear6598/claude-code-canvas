import fs from 'node:fs/promises';
import path from 'node:path';
import {isPathWithinDirectory} from '../utils/pathValidator.js';
import {logger} from '../utils/logger.js';

interface PodManifest {
    managedFiles: string[];
}

const CLAUDE_DIR = '.claude';

class PodManifestService {
    getManifestPath(repositoryPath: string, podId: string): string {
        return path.join(repositoryPath, CLAUDE_DIR, `.pod-manifest-${podId}.json`);
    }

    async readManifest(repositoryPath: string, podId: string): Promise<string[]> {
        const manifestPath = this.getManifestPath(repositoryPath, podId);

        let content: string;
        try {
            content = await fs.readFile(manifestPath, 'utf-8');
        } catch {
            return [];
        }

        try {
            const manifest = JSON.parse(content) as PodManifest;
            return manifest.managedFiles ?? [];
        } catch {
            logger.warn('Pod', 'Warn', `manifest 解析失敗，路徑: ${manifestPath}`);
            return [];
        }
    }

    async writeManifest(repositoryPath: string, podId: string, managedFiles: string[]): Promise<void> {
        const claudeDir = path.join(repositoryPath, CLAUDE_DIR);
        await fs.mkdir(claudeDir, {recursive: true});

        const manifestPath = this.getManifestPath(repositoryPath, podId);
        const manifest: PodManifest = {managedFiles};
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    }

    async deleteManagedFiles(repositoryPath: string, podId: string): Promise<void> {
        const managedFiles = await this.readManifest(repositoryPath, podId);
        const claudeDir = path.join(repositoryPath, CLAUDE_DIR);

        // 收集需要檢查清理的父目錄（不含 .claude 本身）
        const dirsToCheck = new Set<string>();

        for (const relPath of managedFiles) {
            const absPath = path.join(repositoryPath, relPath);

            if (!isPathWithinDirectory(absPath, repositoryPath)) {
                logger.warn('Pod', 'Delete', `偵測到不安全的路徑，跳過刪除: ${relPath}`);
                continue;
            }

            await fs.rm(absPath, {force: true});

            // 記錄從檔案往上到 .claude 之間的所有目錄
            let dir = path.dirname(absPath);
            while (dir !== claudeDir && isPathWithinDirectory(dir, claudeDir)) {
                dirsToCheck.add(dir);
                dir = path.dirname(dir);
            }
        }

        // 從最深層目錄往上清理空目錄
        const sortedDirs = [...dirsToCheck].sort((a, b) => b.length - a.length);
        for (const dir of sortedDirs) {
            try {
                const entries = await fs.readdir(dir);
                if (entries.length === 0) {
                    await fs.rmdir(dir);
                }
            } catch {
                // 目錄已不存在，忽略
            }
        }

        await this.deleteManifestFile(repositoryPath, podId);
    }

    async deleteManifestFile(repositoryPath: string, podId: string): Promise<void> {
        const manifestPath = this.getManifestPath(repositoryPath, podId);
        await fs.rm(manifestPath, {force: true});
    }

    collectCommandFiles(commandId: string): string[] {
        return [`${CLAUDE_DIR}/commands/${commandId}.md`];
    }

    async collectSkillFiles(skillId: string, skillSourcePath: string): Promise<string[]> {
        const files: string[] = [];
        await this.collectFilesRecursive(skillSourcePath, skillSourcePath, skillId, files);
        return files;
    }

    private async collectFilesRecursive(
        basePath: string,
        currentPath: string,
        skillId: string,
        files: string[]
    ): Promise<void> {
        const entries = await fs.readdir(currentPath, {withFileTypes: true});

        for (const entry of entries) {
            const entryPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                await this.collectFilesRecursive(basePath, entryPath, skillId, files);
            } else {
                const relativeToSkillBase = path.relative(basePath, entryPath);
                files.push(`${CLAUDE_DIR}/skills/${skillId}/${relativeToSkillBase}`);
            }
        }
    }

    collectSubAgentFiles(subAgentId: string): string[] {
        return [`${CLAUDE_DIR}/agents/${subAgentId}.md`];
    }
}

export const podManifestService = new PodManifestService();
