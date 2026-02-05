import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {SubAgent} from '../types/index.js';
import {validateSubAgentId, validatePodId, isPathWithinDirectory, sanitizePathSegment} from '../utils/pathValidator.js';
import {fileExists, parseFrontmatterDescription, readFileOrNull, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';

class SubAgentService {
    async list(): Promise<SubAgent[]> {
        await fs.mkdir(config.agentsPath, {recursive: true});
        const subAgents: SubAgent[] = [];

        try {
            const rootEntries = await fs.readdir(config.agentsPath, {withFileTypes: true});

            for (const entry of rootEntries) {
                if (entry.isFile() && entry.name.endsWith('.md')) {
                    const agentId = entry.name.slice(0, -3);
                    const agentFilePath = this.getSubAgentFilePath(agentId);

                    const content = await fs.readFile(agentFilePath, 'utf-8');
                    const description = parseFrontmatterDescription(content);

                    subAgents.push({
                        id: agentId,
                        name: agentId,
                        description,
                        groupId: null,
                    });
                } else if (entry.isDirectory()) {
                    const groupName = entry.name;
                    const groupPath = path.join(config.agentsPath, groupName);
                    const groupFiles = await fs.readdir(groupPath);

                    for (const file of groupFiles) {
                        if (file.endsWith('.md')) {
                            const agentId = file.slice(0, -3);
                            const agentFilePath = path.join(groupPath, file);

                            const content = await fs.readFile(agentFilePath, 'utf-8');
                            const description = parseFrontmatterDescription(content);

                            subAgents.push({
                                id: agentId,
                                name: agentId,
                                description,
                                groupId: groupName,
                            });
                        }
                    }
                }
            }
        } catch {
            // 如果目錄不存在或其他錯誤，回傳空陣列
        }

        return subAgents;
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

    async update(subAgentId: string, content: string): Promise<void> {
        const filePath = await this.findSubAgentFilePath(subAgentId);
        if (!filePath) throw new Error(`找不到子代理: ${subAgentId}`);
        await fs.writeFile(filePath, content, 'utf-8');
    }

    async setGroupId(subAgentId: string, groupId: string | null): Promise<void> {
        const oldPath = await this.findSubAgentFilePath(subAgentId);
        if (!oldPath) throw new Error(`找不到子代理: ${subAgentId}`);

        const newPath = groupId === null
            ? path.join(config.agentsPath, `${subAgentId}.md`)
            : path.join(config.agentsPath, sanitizePathSegment(groupId), `${subAgentId}.md`);

        if (groupId !== null) {
            await fs.mkdir(path.dirname(newPath), {recursive: true});
        }

        if (oldPath !== newPath) {
            await fs.rename(oldPath, newPath);
        }
    }

    private async findSubAgentFilePath(subAgentId: string): Promise<string | null> {
        if (!validateSubAgentId(subAgentId)) {
            return null;
        }

        const rootPath = path.join(config.agentsPath, `${subAgentId}.md`);
        if (await fileExists(rootPath)) {
            return rootPath;
        }

        try {
            const entries = await fs.readdir(config.agentsPath, {withFileTypes: true});
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const groupPath = path.join(config.agentsPath, entry.name, `${subAgentId}.md`);
                    if (await fileExists(groupPath)) {
                        return groupPath;
                    }
                }
            }
        } catch {
            // 目錄不存在或其他錯誤，回傳 null
        }

        return null;
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
