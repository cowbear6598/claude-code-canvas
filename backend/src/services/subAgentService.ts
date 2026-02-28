import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {SubAgent} from '../types';
import {validateSubAgentId, validatePodId, isPathWithinDirectory} from '../utils/pathValidator.js';
import {parseFrontmatterDescription, copyResourceFile} from './shared/fileResourceHelpers.js';
import {createMarkdownResourceService} from './shared/createMarkdownResourceService.js';

const baseService = createMarkdownResourceService<SubAgent>({
    resourceDir: config.agentsPath,
    resourceName: '子代理',
    createItem: (id, name, content, groupId) => ({
        id,
        name,
        description: parseFrontmatterDescription(content),
        groupId,
    }),
    updateItem: (id, content) => ({
        id,
        name: id,
        description: parseFrontmatterDescription(content),
        groupId: null,
    }),
    subDir: 'agents',
});

class SubAgentService {
    async list(): Promise<SubAgent[]> {
        return baseService.list();
    }

    async exists(subAgentId: string): Promise<boolean> {
        return baseService.exists(subAgentId);
    }

    async getContent(subAgentId: string): Promise<string | null> {
        return baseService.getContent(subAgentId);
    }

    async create(name: string, content: string): Promise<SubAgent> {
        return baseService.create(name, content);
    }

    async update(subAgentId: string, content: string): Promise<SubAgent> {
        return baseService.update(subAgentId, content);
    }

    async delete(subAgentId: string): Promise<void> {
        return baseService.delete(subAgentId);
    }

    async setGroupId(subAgentId: string, groupId: string | null): Promise<void> {
        return baseService.setGroupId(subAgentId, groupId);
    }

    findFilePath(subAgentId: string): Promise<string | null> {
        return baseService.findFilePath(subAgentId);
    }

    getFilePath(subAgentId: string): string {
        return baseService.getFilePath(subAgentId);
    }

    private async findValidatedSubAgentSrcPath(subAgentId: string): Promise<string> {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }

        const srcPath = await baseService.findFilePath(subAgentId);
        if (!srcPath) {
            throw new Error(`找不到子代理: ${subAgentId}`);
        }

        return srcPath;
    }

    async copySubAgentToPod(subAgentId: string, podId: string, podWorkspacePath: string): Promise<void> {
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = await this.findValidatedSubAgentSrcPath(subAgentId);
        await copyResourceFile(srcPath, podWorkspacePath, 'agents', `${subAgentId}.md`);
    }

    async copySubAgentToRepository(subAgentId: string, repositoryPath: string): Promise<void> {
        const srcPath = await this.findValidatedSubAgentSrcPath(subAgentId);
        await copyResourceFile(srcPath, repositoryPath, 'agents', `${subAgentId}.md`);
    }

    async deleteSubAgentsFromPath(basePath: string): Promise<void> {
        if (!isPathWithinDirectory(basePath, config.canvasRoot) && !isPathWithinDirectory(basePath, config.repositoriesRoot)) {
            throw new Error('無效的路徑');
        }

        const agentsDir = path.join(basePath, '.claude', 'agents');
        await fs.rm(agentsDir, {recursive: true, force: true});
    }
}

export const subAgentService = new SubAgentService();
