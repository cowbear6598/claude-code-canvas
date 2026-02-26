import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {Command} from '../types';
import {isPathWithinDirectory, validatePodId, validateCommandId} from '../utils/pathValidator.js';
import {ensureDirectoryAndWriteFile, readFileOrNull} from './shared/fileResourceHelpers.js';
import {listGroupedMarkdownResources, findGroupedResourceFilePath, setGroupedResourceGroupId} from './shared/groupedResourceHelpers.js';

class CommandService {
    async list(): Promise<Command[]> {
        await fs.mkdir(config.commandsPath, {recursive: true});
        return listGroupedMarkdownResources(config.commandsPath);
    }
    async exists(commandId: string): Promise<boolean> {
        const filePath = await this.findCommandFilePath(commandId);
        return filePath !== null;
    }

    async copyCommandToPod(commandId: string, podId: string, podWorkspacePath: string): Promise<void> {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = await this.findCommandFilePath(commandId);
        if (!srcPath) {
            throw new Error(`找不到 Command: ${commandId}`);
        }

        const destDir = path.join(podWorkspacePath, '.claude', 'commands');
        await this.copyCommandFile(srcPath, destDir, commandId);
    }

    async copyCommandToRepository(commandId: string, repositoryPath: string): Promise<void> {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }

        const srcPath = await this.findCommandFilePath(commandId);
        if (!srcPath) {
            throw new Error(`找不到 Command: ${commandId}`);
        }

        const destDir = path.join(repositoryPath, '.claude', 'commands');
        await this.copyCommandFile(srcPath, destDir, commandId);
    }

    private async copyCommandFile(srcPath: string, destDir: string, commandId: string): Promise<void> {
        await fs.mkdir(destDir, {recursive: true});
        const destPath = path.join(destDir, `${commandId}.md`);
        await fs.copyFile(srcPath, destPath);
    }

    async deleteCommandFromPath(basePath: string): Promise<void> {
        if (!isPathWithinDirectory(basePath, config.canvasRoot) && !isPathWithinDirectory(basePath, config.repositoriesRoot)) {
            throw new Error('無效的路徑');
        }

        const commandsDir = path.join(basePath, '.claude', 'commands');
        await fs.rm(commandsDir, {recursive: true, force: true});
    }

    async delete(commandId: string): Promise<void> {
        const filePath = await this.findCommandFilePath(commandId);
        if (!filePath) {
            return;
        }
        await fs.rm(filePath, {force: true});
    }

    async create(name: string, content: string): Promise<Command> {
        const filePath = this.getCommandFilePath(name);
        await ensureDirectoryAndWriteFile(filePath, content);

        return {
            id: name,
            name,
            groupId: null,
        };
    }

    async getContent(commandId: string): Promise<string | null> {
        const filePath = await this.findCommandFilePath(commandId);
        if (!filePath) return null;
        return readFileOrNull(filePath);
    }

    async update(commandId: string, content: string): Promise<Command> {
        const filePath = await this.findCommandFilePath(commandId);
        if (!filePath) throw new Error(`找不到 Command: ${commandId}`);
        await fs.writeFile(filePath, content, 'utf-8');
        return {
            id: commandId,
            name: commandId,
            groupId: null,
        };
    }

    async setGroupId(commandId: string, groupId: string | null): Promise<void> {
        return setGroupedResourceGroupId(
            config.commandsPath,
            commandId,
            groupId,
            () => this.findCommandFilePath(commandId)
        );
    }

    private async findCommandFilePath(commandId: string): Promise<string | null> {
        return findGroupedResourceFilePath(config.commandsPath, commandId, validateCommandId);
    }

    private getCommandFilePath(commandId: string): string {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }

        const safePath = path.join(config.commandsPath, `${path.basename(commandId)}.md`);

        if (!isPathWithinDirectory(safePath, config.commandsPath)) {
            throw new Error('無效的 Command 路徑');
        }

        return safePath;
    }
}

export const commandService = new CommandService();
