import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {Command} from '../types/index.js';
import {isPathWithinDirectory, validatePodId, validateCommandId, sanitizePathSegment} from '../utils/pathValidator.js';
import {readFileOrNull, fileExists, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';

class CommandService {
    async list(): Promise<Command[]> {
        await fs.mkdir(config.commandsPath, {recursive: true});
        const commands: Command[] = [];

        try {
            const rootEntries = await fs.readdir(config.commandsPath, {withFileTypes: true});

            for (const entry of rootEntries) {
                if (entry.isFile() && entry.name.endsWith('.md')) {
                    const commandId = entry.name.slice(0, -3);
                    commands.push({
                        id: commandId,
                        name: commandId,
                        groupId: null,
                    });
                } else if (entry.isDirectory()) {
                    const groupName = entry.name;
                    const groupPath = path.join(config.commandsPath, groupName);
                    const groupFiles = await fs.readdir(groupPath);

                    for (const file of groupFiles) {
                        if (file.endsWith('.md')) {
                            const commandId = file.slice(0, -3);
                            commands.push({
                                id: commandId,
                                name: commandId,
                                groupId: groupName,
                            });
                        }
                    }
                }
            }
        } catch {
            // 如果目錄不存在或其他錯誤，回傳空陣列
        }

        return commands;
    }

    async getContent(commandId: string): Promise<string | null> {
        const filePath = await this.findCommandFilePath(commandId);
        if (!filePath) {
            return null;
        }
        return readFileOrNull(filePath);
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

    async update(commandId: string, content: string): Promise<void> {
        const filePath = await this.findCommandFilePath(commandId);
        if (!filePath) {
            throw new Error(`找不到 Command: ${commandId}`);
        }
        await fs.writeFile(filePath, content, 'utf-8');
    }

    async setGroupId(commandId: string, groupId: string | null): Promise<void> {
        const oldPath = await this.findCommandFilePath(commandId);
        if (!oldPath) {
            throw new Error(`找不到 Command: ${commandId}`);
        }

        let newPath: string;
        if (groupId === null) {
            newPath = path.join(config.commandsPath, `${commandId}.md`);
        } else {
            const safeGroupId = sanitizePathSegment(groupId);
            const groupPath = path.join(config.commandsPath, safeGroupId);
            await fs.mkdir(groupPath, {recursive: true});
            newPath = path.join(groupPath, `${commandId}.md`);
        }

        if (oldPath !== newPath) {
            await fs.rename(oldPath, newPath);
        }
    }

    async getItemsByGroupId(groupId: string | null): Promise<Command[]> {
        const allCommands = await this.list();
        return allCommands.filter((command) => command.groupId === groupId);
    }

    private async findCommandFilePath(commandId: string): Promise<string | null> {
        if (!validateCommandId(commandId)) {
            return null;
        }

        const rootPath = path.join(config.commandsPath, `${commandId}.md`);
        if (await fileExists(rootPath)) {
            return rootPath;
        }

        try {
            const entries = await fs.readdir(config.commandsPath, {withFileTypes: true});
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const groupPath = path.join(config.commandsPath, entry.name, `${commandId}.md`);
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
