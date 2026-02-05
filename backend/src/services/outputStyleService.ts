import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {OutputStyleListItem} from '../types';
import {readFileOrNull, fileExists, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';
import {sanitizePathSegment} from '../utils/pathValidator.js';

class OutputStyleService {
    async list(): Promise<OutputStyleListItem[]> {
        await fs.mkdir(config.outputStylesPath, {recursive: true});
        const styles: OutputStyleListItem[] = [];

        try {
            const rootEntries = await fs.readdir(config.outputStylesPath, {withFileTypes: true});

            for (const entry of rootEntries) {
                if (entry.isFile() && entry.name.endsWith('.md')) {
                    const id = entry.name.slice(0, -3);
                    styles.push({
                        id,
                        name: id,
                        groupId: null,
                    });
                } else if (entry.isDirectory()) {
                    const groupName = entry.name;
                    const groupPath = path.join(config.outputStylesPath, groupName);
                    const groupFiles = await fs.readdir(groupPath);

                    for (const file of groupFiles) {
                        if (file.endsWith('.md')) {
                            const id = file.slice(0, -3);
                            styles.push({
                                id,
                                name: id,
                                groupId: groupName,
                            });
                        }
                    }
                }
            }
        } catch {
            // 如果目錄不存在或其他錯誤，回傳空陣列
        }

        return styles;
    }

    async getContent(styleId: string): Promise<string | null> {
        const filePath = await this.findStyleFilePath(styleId);
        if (!filePath) {
            return null;
        }
        return readFileOrNull(filePath);
    }

    async exists(styleId: string): Promise<boolean> {
        const filePath = await this.findStyleFilePath(styleId);
        return filePath !== null;
    }

    async delete(styleId: string): Promise<void> {
        const filePath = await this.findStyleFilePath(styleId);
        if (!filePath) {
            return;
        }
        await fs.unlink(filePath);
    }

    async create(name: string, content: string): Promise<OutputStyleListItem> {
        const filePath = path.join(config.outputStylesPath, `${name}.md`);
        await ensureDirectoryAndWriteFile(filePath, content);
        return {id: name, name, groupId: null};
    }

    async update(styleId: string, content: string): Promise<void> {
        const filePath = await this.findStyleFilePath(styleId);
        if (!filePath) throw new Error(`找不到 Output Style: ${styleId}`);
        await fs.writeFile(filePath, content, 'utf-8');
    }

    async setGroupId(outputStyleId: string, groupId: string | null): Promise<void> {
        const oldPath = await this.findStyleFilePath(outputStyleId);
        if (!oldPath) throw new Error(`找不到 Output Style: ${outputStyleId}`);

        const newPath = groupId === null
            ? path.join(config.outputStylesPath, `${outputStyleId}.md`)
            : path.join(config.outputStylesPath, sanitizePathSegment(groupId), `${outputStyleId}.md`);

        if (groupId !== null) {
            await fs.mkdir(path.dirname(newPath), {recursive: true});
        }

        if (oldPath !== newPath) {
            await fs.rename(oldPath, newPath);
        }
    }

    private async findStyleFilePath(styleId: string): Promise<string | null> {
        const rootPath = path.join(config.outputStylesPath, `${styleId}.md`);
        if (await fileExists(rootPath)) {
            return rootPath;
        }

        try {
            const entries = await fs.readdir(config.outputStylesPath, {withFileTypes: true});
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const groupPath = path.join(config.outputStylesPath, entry.name, `${styleId}.md`);
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
}

export const outputStyleService = new OutputStyleService();
