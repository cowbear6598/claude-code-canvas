import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {SubAgent} from '../types/index.js';
import {validateSubAgentId, validatePodId, isPathWithinDirectory} from '../utils/pathValidator.js';

class SubAgentService {
    /**
     * List all available subagents by reading .md files from agents directory
     * Format: agents/{agentId}.md (e.g., agents/plan.md, agents/code-reviewer.md)
     */
    async listSubAgents(): Promise<SubAgent[]> {
        await fs.mkdir(config.agentsPath, {recursive: true});
        const entries = await fs.readdir(config.agentsPath, {withFileTypes: true});

        const subAgents: SubAgent[] = [];

        for (const entry of entries) {
            // Only process .md files
            if (!entry.isFile() || !entry.name.endsWith('.md')) {
                continue;
            }

            // Agent ID is the filename without .md extension
            const agentId = entry.name.replace(/\.md$/, '');
            const agentFilePath = this.getSubAgentFilePath(agentId);

            const content = await fs.readFile(agentFilePath, 'utf-8');
            const {description} = this.parseFrontmatter(content);

            subAgents.push({
                id: agentId,
                name: agentId,
                description,
            });
        }

        return subAgents;
    }

    /**
     * Get the full content of a subagent's .md file
     * @returns The content string, or null if subagent not found
     */
    async getSubAgentContent(subAgentId: string): Promise<string | null> {
        const filePath = this.getSubAgentFilePath(subAgentId);

        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async exists(subAgentId: string): Promise<boolean> {
        const filePath = this.getSubAgentFilePath(subAgentId);

        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
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

    private parseFrontmatter(content: string): { description: string } {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return {description: 'No description available'};
        }

        const frontmatterContent = match[1];
        const descriptionMatch = frontmatterContent.match(/^description:\s*(.+)$/m);

        return {
            description: descriptionMatch ? descriptionMatch[1].trim() : 'No description available',
        };
    }
}

export const subAgentService = new SubAgentService();
