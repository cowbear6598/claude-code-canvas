import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {SubAgent} from '../types/index.js';
import {validateSubAgentId, validatePodId, isPathWithinDirectory} from '../utils/pathValidator.js';
import {readFileOrNull, fileExists, ensureDirectoryAndWriteFile, parseFrontmatterDescription} from './shared/fileResourceHelpers.js';

class SubAgentService {
    async list(): Promise<SubAgent[]> {
        await fs.mkdir(config.agentsPath, {recursive: true});
        const entries = await fs.readdir(config.agentsPath, {withFileTypes: true});

        const subAgents: SubAgent[] = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) {
                continue;
            }

            const agentId = entry.name.replace(/\.md$/, '');
            const agentFilePath = this.getSubAgentFilePath(agentId);

            const content = await fs.readFile(agentFilePath, 'utf-8');
            const description = parseFrontmatterDescription(content);

            subAgents.push({
                id: agentId,
                name: agentId,
                description,
            });
        }

        return subAgents;
    }

    async getContent(subAgentId: string): Promise<string | null> {
        const filePath = this.getSubAgentFilePath(subAgentId);
        return readFileOrNull(filePath);
    }

    async exists(subAgentId: string): Promise<boolean> {
        const filePath = this.getSubAgentFilePath(subAgentId);
        return fileExists(filePath);
    }

    /**
     * Copy a subagent file to a pod's workspace
     */
    async copySubAgentToPod(subAgentId: string, podId: string): Promise<void> {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = this.getSubAgentFilePath(subAgentId);
        const destPath = path.join(config.canvasRoot, `pod-${podId}`, '.claude', 'agents', `${subAgentId}.md`);

        try {
            await fs.access(srcPath);
        } catch {
            throw new Error(`找不到子代理: ${subAgentId}`);
        }

        await fs.mkdir(path.dirname(destPath), {recursive: true});
        await fs.copyFile(srcPath, destPath);
    }

    async copySubAgentToRepository(subAgentId: string, repositoryPath: string): Promise<void> {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }

        const srcPath = this.getSubAgentFilePath(subAgentId);
        const destPath = path.join(repositoryPath, '.claude', 'agents', `${subAgentId}.md`);

        try {
            await fs.access(srcPath);
        } catch {
            throw new Error(`找不到子代理: ${subAgentId}`);
        }

        await fs.mkdir(path.dirname(destPath), {recursive: true});
        await fs.copyFile(srcPath, destPath);
    }

    /**
     * Delete the .claude/agents directory from a path
     */
    async deleteSubAgentsFromPath(basePath: string): Promise<void> {
        const agentsDir = path.join(basePath, '.claude', 'agents');

        try {
            await fs.rm(agentsDir, {recursive: true, force: true});
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                // Intentionally not logging - too verbose
            }
        }
    }

    /**
     * Delete a subagent file
     */
    async delete(subAgentId: string): Promise<void> {
        const filePath = this.getSubAgentFilePath(subAgentId);
        await fs.rm(filePath, {force: true});
    }

    async create(name: string, content: string): Promise<{ id: string; name: string }> {
        const filePath = this.getSubAgentFilePath(name);
        await ensureDirectoryAndWriteFile(filePath, content);

        return {
            id: name,
            name,
        };
    }

    async update(subAgentId: string, content: string): Promise<void> {
        const filePath = this.getSubAgentFilePath(subAgentId);
        await fs.writeFile(filePath, content, 'utf-8');
    }

    /**
     * Get the file path for a subagent
     * Format: {agentsPath}/{subAgentId}.md
     */
    private getSubAgentFilePath(subAgentId: string): string {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }

        const safePath = path.join(config.agentsPath, `${path.basename(subAgentId)}.md`);

        if (!isPathWithinDirectory(safePath, config.agentsPath)) {
            throw new Error('無效的子代理路徑');
        }

        return safePath;
    }

}

export const subAgentService = new SubAgentService();
