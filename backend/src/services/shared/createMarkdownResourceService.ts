import fs from 'fs/promises';
import path from 'path';
import {isPathWithinDirectory, validateResourceId} from '../../utils/pathValidator.js';
import {ensureDirectoryAndWriteFile, readFileOrNull} from './fileResourceHelpers.js';
import {listGroupedMarkdownResources, findGroupedResourceFilePath, setGroupedResourceGroupId} from './groupedResourceHelpers.js';

export interface MarkdownResourceServiceConfig<T> {
    resourceDir: string;
    resourceName: string;
    /**
     * 將讀取到的 markdown 內容轉換為資源物件。
     * list 時會傳入實際檔案內容；create/update 時會傳入寫入的 content。
     */
    createItem: (id: string, name: string, content: string, groupId: string | null) => T;
    updateItem: (id: string, content: string) => T;
    subDir: string;
}

export interface MarkdownResourceService<T> {
    list(): Promise<T[]>;
    exists(id: string): Promise<boolean>;
    getContent(id: string): Promise<string | null>;
    create(name: string, content: string): Promise<T>;
    update(id: string, content: string): Promise<T>;
    delete(id: string): Promise<void>;
    setGroupId(id: string, groupId: string | null): Promise<void>;
    findFilePath(id: string): Promise<string | null>;
    getFilePath(id: string): string;
}

export function createMarkdownResourceService<T>(
    serviceConfig: MarkdownResourceServiceConfig<T>
): MarkdownResourceService<T> {
    const {resourceDir, resourceName, createItem, updateItem} = serviceConfig;

    async function findFilePath(id: string): Promise<string | null> {
        return findGroupedResourceFilePath(resourceDir, id, validateResourceId);
    }

    function getFilePath(id: string): string {
        if (!validateResourceId(id)) {
            throw new Error(`無效的 ${resourceName} ID 格式`);
        }

        const safePath = path.join(resourceDir, `${path.basename(id)}.md`);

        if (!isPathWithinDirectory(safePath, resourceDir)) {
            throw new Error(`無效的 ${resourceName} 路徑`);
        }

        return safePath;
    }

    async function list(): Promise<T[]> {
        await fs.mkdir(resourceDir, {recursive: true});
        const resources = await listGroupedMarkdownResources(resourceDir);

        return Promise.all(resources.map(async ({id, name, groupId}) => {
            const filePath = groupId === null
                ? path.join(resourceDir, `${id}.md`)
                : path.join(resourceDir, groupId, `${id}.md`);
            const content = await fs.readFile(filePath, 'utf-8');
            return createItem(id, name, content, groupId);
        }));
    }

    async function exists(id: string): Promise<boolean> {
        const filePath = await findFilePath(id);
        return filePath !== null;
    }

    async function getContent(id: string): Promise<string | null> {
        const filePath = await findFilePath(id);
        if (!filePath) return null;
        return readFileOrNull(filePath);
    }

    async function create(name: string, content: string): Promise<T> {
        const filePath = getFilePath(name);
        await ensureDirectoryAndWriteFile(filePath, content);
        return createItem(name, name, content, null);
    }

    async function update(id: string, content: string): Promise<T> {
        const filePath = await findFilePath(id);
        if (!filePath) throw new Error(`找不到 ${resourceName}: ${id}`);
        await fs.writeFile(filePath, content, 'utf-8');
        return updateItem(id, content);
    }

    async function deleteResource(id: string): Promise<void> {
        const filePath = await findFilePath(id);
        if (!filePath) {
            return;
        }
        await fs.rm(filePath, {force: true});
    }

    async function setGroupId(id: string, groupId: string | null): Promise<void> {
        return setGroupedResourceGroupId(
            resourceDir,
            id,
            groupId,
            () => findFilePath(id)
        );
    }

    return {
        list,
        exists,
        getContent,
        create,
        update,
        delete: deleteResource,
        setGroupId,
        findFilePath,
        getFilePath,
    };
}
