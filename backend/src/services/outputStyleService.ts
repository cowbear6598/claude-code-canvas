import fs from 'fs/promises';
import path from 'path';
import {config} from '../config';
import type {OutputStyleListItem} from '../types';
import {readFileOrNull, ensureDirectoryAndWriteFile} from './shared/fileResourceHelpers.js';
import {validateOutputStyleId, isPathWithinDirectory} from '../utils/pathValidator.js';
import {listGroupedMarkdownResources, findGroupedResourceFilePath, setGroupedResourceGroupId} from './shared/groupedResourceHelpers.js';

class OutputStyleService {
    async list(): Promise<OutputStyleListItem[]> {
        await fs.mkdir(config.outputStylesPath, {recursive: true});
        return listGroupedMarkdownResources(config.outputStylesPath);
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
        if (!validateOutputStyleId(name)) {
            throw new Error('無效的 Output Style ID 格式');
        }

        const safePath = path.join(config.outputStylesPath, `${path.basename(name)}.md`);

        if (!isPathWithinDirectory(safePath, config.outputStylesPath)) {
            throw new Error('無效的 Output Style 路徑');
        }

        await ensureDirectoryAndWriteFile(safePath, content);
        return {id: name, name, groupId: null};
    }

    async update(styleId: string, content: string): Promise<OutputStyleListItem> {
        const filePath = await this.findStyleFilePath(styleId);
        if (!filePath) throw new Error(`找不到 Output Style: ${styleId}`);
        await fs.writeFile(filePath, content, 'utf-8');
        return {
            id: styleId,
            name: styleId,
            groupId: null,
        };
    }

    async setGroupId(outputStyleId: string, groupId: string | null): Promise<void> {
        return setGroupedResourceGroupId(
            config.outputStylesPath,
            outputStyleId,
            groupId,
            () => this.findStyleFilePath(outputStyleId)
        );
    }

    private async findStyleFilePath(styleId: string): Promise<string | null> {
        return findGroupedResourceFilePath(config.outputStylesPath, styleId, validateOutputStyleId);
    }
}

export const outputStyleService = new OutputStyleService();
