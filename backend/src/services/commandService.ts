import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {Command} from '../types';
import {isPathWithinDirectory, validatePodId, validateCommandId} from '../utils/pathValidator.js';
import {copyResourceFile} from './shared/fileResourceHelpers.js';
import {createMarkdownResourceService} from './shared/createMarkdownResourceService.js';

const baseService = createMarkdownResourceService<Command>({
    resourceDir: config.commandsPath,
    resourceName: 'Command',
    createItem: (id, name, _content, groupId) => ({id, name, groupId}),
    updateItem: (id, _content) => ({id, name: id, groupId: null}),
    subDir: 'commands',
});

class CommandService {
    async list(): Promise<Command[]> {
        return baseService.list();
    }

    async exists(commandId: string): Promise<boolean> {
        return baseService.exists(commandId);
    }

    async getContent(commandId: string): Promise<string | null> {
        return baseService.getContent(commandId);
    }

    async create(name: string, content: string): Promise<Command> {
        return baseService.create(name, content);
    }

    async update(commandId: string, content: string): Promise<Command> {
        return baseService.update(commandId, content);
    }

    async delete(commandId: string): Promise<void> {
        return baseService.delete(commandId);
    }

    async setGroupId(commandId: string, groupId: string | null): Promise<void> {
        return baseService.setGroupId(commandId, groupId);
    }

    findFilePath(commandId: string): Promise<string | null> {
        return baseService.findFilePath(commandId);
    }

    getFilePath(commandId: string): string {
        return baseService.getFilePath(commandId);
    }

    private async findValidatedCommandSrcPath(commandId: string): Promise<string> {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }

        const srcPath = await baseService.findFilePath(commandId);
        if (!srcPath) {
            throw new Error(`找不到 Command: ${commandId}`);
        }

        return srcPath;
    }

    async copyCommandToPod(commandId: string, podId: string, podWorkspacePath: string): Promise<void> {
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = await this.findValidatedCommandSrcPath(commandId);
        await copyResourceFile(srcPath, podWorkspacePath, 'commands', `${commandId}.md`);
    }

    async copyCommandToRepository(commandId: string, repositoryPath: string): Promise<void> {
        const srcPath = await this.findValidatedCommandSrcPath(commandId);
        await copyResourceFile(srcPath, repositoryPath, 'commands', `${commandId}.md`);
    }

    async deleteCommandFromPath(basePath: string): Promise<void> {
        if (!isPathWithinDirectory(basePath, config.canvasRoot) && !isPathWithinDirectory(basePath, config.repositoriesRoot)) {
            throw new Error('無效的路徑');
        }

        const commandsDir = path.join(basePath, '.claude', 'commands');
        await fs.rm(commandsDir, {recursive: true, force: true});
    }
}

export const commandService = new CommandService();
