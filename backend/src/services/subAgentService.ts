import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {SubAgent} from '../types';
import {validateSubAgentId, validatePodId, isPathWithinDirectory} from '../utils/pathValidator.js';
import {parseFrontmatterDescription, readFileOrNull, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';
import {listGroupedMarkdownResources, findGroupedResourceFilePath, setGroupedResourceGroupId} from './shared/groupedResourceHelpers.js';

class SubAgentService {
    async list(): Promise<SubAgent[]> {
        await fs.mkdir(config.agentsPath, {recursive: true});
        const resources = await listGroupedMarkdownResources(config.agentsPath);

        return Promise.all(resources.map(async ({ id, name, groupId }) => {
            const filePath = groupId === null
                ? path.join(config.agentsPath, `${id}.md`)
                : path.join(config.agentsPath, groupId, `${id}.md`);
            const content = await fs.readFile(filePath, 'utf-8');
            const description = parseFrontmatterDescription(content);
            return { id, name, description, groupId };
        }));
    }

    async exists(subAgentId: string): Promise<boolean> {
        const filePath = await this.findSubAgentFilePath(subAgentId);
        return filePath !== null;
    }

    async copySubAgentToPod(subAgentId: string, podId: string, podWorkspacePath: string): Promise<void> {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = await this.findSubAgentFilePath(subAgentId);
        if (!srcPath) {
            throw new Error(`找不到子代理: ${subAgentId}`);
        }

        const destPath = path.join(podWorkspacePath, '.claude', 'agents', `${subAgentId}.md`);

        await fs.mkdir(path.dirname(destPath), {recursive: true});
        await fs.copyFile(srcPath, destPath);
    }

    async copySubAgentToRepository(subAgentId: string, repositoryPath: string): Promise<void> {
        if (!validateSubAgentId(subAgentId)) {
            throw new Error('無效的子代理 ID 格式');
        }

        const srcPath = await this.findSubAgentFilePath(subAgentId);
        if (!srcPath) {
            throw new Error(`找不到子代理: ${subAgentId}`);
        }

        const destPath = path.join(repositoryPath, '.claude', 'agents', `${subAgentId}.md`);

        await fs.mkdir(path.dirname(destPath), {recursive: true});
        await fs.copyFile(srcPath, destPath);
    }

    async deleteSubAgentsFromPath(basePath: string): Promise<void> {
        const agentsDir = path.join(basePath, '.claude', 'agents');
        await fs.rm(agentsDir, {recursive: true, force: true});
    }

    async delete(subAgentId: string): Promise<void> {
        const filePath = await this.findSubAgentFilePath(subAgentId);
        if (!filePath) {
            return;
        }
        await fs.rm(filePath, {force: true});
    }

    async getContent(subAgentId: string): Promise<string | null> {
        const filePath = await this.findSubAgentFilePath(subAgentId);
        if (!filePath) return null;
        return readFileOrNull(filePath);
    }

    async create(name: string, content: string): Promise<SubAgent> {
        const filePath = this.getSubAgentFilePath(name);
        await ensureDirectoryAndWriteFile(filePath, content);
        const description = parseFrontmatterDescription(content);
        return {id: name, name, description, groupId: null};
    }

    async update(subAgentId: string, content: string): Promise<SubAgent> {
        const filePath = await this.findSubAgentFilePath(subAgentId);
        if (!filePath) throw new Error(`找不到子代理: ${subAgentId}`);
        await fs.writeFile(filePath, content, 'utf-8');
        const description = parseFrontmatterDescription(content);
        return {
            id: subAgentId,
            name: subAgentId,
            description,
            groupId: null,
        };
    }

    async setGroupId(subAgentId: string, groupId: string | null): Promise<void> {
        return setGroupedResourceGroupId(
            config.agentsPath,
            subAgentId,
            groupId,
            () => this.findSubAgentFilePath(subAgentId)
        );
    }

    private async findSubAgentFilePath(subAgentId: string): Promise<string | null> {
        return findGroupedResourceFilePath(config.agentsPath, subAgentId, validateSubAgentId);
    }

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
