import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {Command} from '../types/index.js';
import {isPathWithinDirectory, validatePodId, validateCommandId} from '../utils/pathValidator.js';
import {readFileOrNull, fileExists, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';

class CommandService {
    async list(): Promise<Command[]> {
        await fs.mkdir(config.commandsPath, {recursive: true});
        const entries = await fs.readdir(config.commandsPath, {withFileTypes: true});

        const commands: Command[] = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) {
                continue;
            }

            const commandId = entry.name.slice(0, -3);

            commands.push({
                id: commandId,
                name: commandId,
            });
        }

        return commands;
    }

    async getContent(commandId: string): Promise<string | null> {
        const filePath = this.getCommandFilePath(commandId);
        return readFileOrNull(filePath);
    }

    async exists(commandId: string): Promise<boolean> {
        const filePath = this.getCommandFilePath(commandId);
        return fileExists(filePath);
    }

    async copyCommandToPod(commandId: string, podId: string): Promise<void> {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcPath = path.join(config.commandsPath, `${commandId}.md`);
        const destDir = path.join(config.canvasRoot, `pod-${podId}`, '.claude', 'commands');

        await this.ensureCommandExists(srcPath, commandId);
        await this.copyCommandFile(srcPath, destDir, commandId);
    }

    async copyCommandToRepository(commandId: string, repositoryPath: string): Promise<void> {
        if (!validateCommandId(commandId)) {
            throw new Error('無效的 Command ID 格式');
        }

        const srcPath = path.join(config.commandsPath, `${commandId}.md`);
        const destDir = path.join(repositoryPath, '.claude', 'commands');

        await this.ensureCommandExists(srcPath, commandId);
        await this.copyCommandFile(srcPath, destDir, commandId);
    }

    private async ensureCommandExists(srcPath: string, commandId: string): Promise<void> {
        try {
            await fs.access(srcPath);
        } catch {
            throw new Error(`找不到 Command: ${commandId}`);
        }
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
        const filePath = this.getCommandFilePath(commandId);
        await fs.rm(filePath, {force: true});
    }

    async create(name: string, content: string): Promise<{ id: string; name: string }> {
        const filePath = this.getCommandFilePath(name);
        await ensureDirectoryAndWriteFile(filePath, content);

        return {
            id: name,
            name,
        };
    }

    async update(commandId: string, content: string): Promise<void> {
        const filePath = this.getCommandFilePath(commandId);
        await fs.writeFile(filePath, content, 'utf-8');
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
