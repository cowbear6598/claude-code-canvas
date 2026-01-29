import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {Command} from '../types/index.js';
import {isPathWithinDirectory, validatePodId, validateCommandId} from '../utils/pathValidator.js';

class CommandService {
    async listCommands(): Promise<Command[]> {
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

    async getCommandContent(commandId: string): Promise<string | null> {
        const filePath = this.getCommandFilePath(commandId);

        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async exists(commandId: string): Promise<boolean> {
        const filePath = this.getCommandFilePath(commandId);

        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
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
        const commandsDir = path.join(basePath, '.claude', 'commands');
        await fs.rm(commandsDir, {recursive: true, force: true});
    }

    async delete(commandId: string): Promise<void> {
        const filePath = this.getCommandFilePath(commandId);
        await fs.rm(filePath, {force: true});
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
