import {config} from '../config';
import type {OutputStyleListItem} from '../types';
import {createMarkdownResourceService} from './shared/createMarkdownResourceService.js';

const baseService = createMarkdownResourceService<OutputStyleListItem>({
    resourceDir: config.outputStylesPath,
    resourceName: 'Output Style',
    createItem: (id, name, _content, groupId) => ({id, name, groupId}),
    updateItem: (id, _content) => ({id, name: id, groupId: null}),
    subDir: 'output-styles',
});

class OutputStyleService {
    async list(): Promise<OutputStyleListItem[]> {
        return baseService.list();
    }

    async exists(styleId: string): Promise<boolean> {
        return baseService.exists(styleId);
    }

    async getContent(styleId: string): Promise<string | null> {
        return baseService.getContent(styleId);
    }

    async create(name: string, content: string): Promise<OutputStyleListItem> {
        return baseService.create(name, content);
    }

    async update(styleId: string, content: string): Promise<OutputStyleListItem> {
        return baseService.update(styleId, content);
    }

    async delete(styleId: string): Promise<void> {
        return baseService.delete(styleId);
    }

    async setGroupId(outputStyleId: string, groupId: string | null): Promise<void> {
        return baseService.setGroupId(outputStyleId, groupId);
    }
}

export const outputStyleService = new OutputStyleService();
