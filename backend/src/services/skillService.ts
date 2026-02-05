import fs from 'fs/promises';
import path from 'path';
import {unzipSync} from 'fflate';
import {config} from '../config';
import type {Skill} from '../types';
import {isPathWithinDirectory, validatePodId, validateSkillId} from '../utils/pathValidator.js';
import {fileExists, parseFrontmatterDescription} from './shared/fileResourceHelpers.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB（壓縮檔）
const MAX_TOTAL_UNZIPPED_SIZE = 10 * 1024 * 1024; // 10MB（解壓後）
const MAX_ENTRIES = 100; // 最多 100 個檔案
const MAX_INDIVIDUAL_FILE_SIZE = 1 * 1024 * 1024; // 單檔 1MB
const MAX_DEPTH = 10;
const MAX_FILES = 1000;
const SKILL_FILE_NAME = 'SKILL.md';

class SkillService {
    async list(): Promise<Skill[]> {
        await fs.mkdir(config.skillsPath, {recursive: true});
        const entries = await fs.readdir(config.skillsPath, {withFileTypes: true});

        const skills: Skill[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const skillId = entry.name;
            const skillFilePath = this.getSkillFilePath(skillId);

            const content = await fs.readFile(skillFilePath, 'utf-8');
            const description = parseFrontmatterDescription(content);

            skills.push({
                id: skillId,
                name: skillId,
                description,
            });
        }

        return skills;
    }

    async exists(skillId: string): Promise<boolean> {
        const filePath = this.getSkillFilePath(skillId);
        return fileExists(filePath);
    }

    async copySkillToPod(skillId: string, podId: string, podWorkspacePath: string): Promise<void> {
        if (!validateSkillId(skillId)) {
            throw new Error('無效的技能 ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcDir = this.getSkillDirectoryPath(skillId);
        const destDir = path.join(podWorkspacePath, '.claude', 'skills', skillId);

        try {
            await fs.access(srcDir);
        } catch {
            throw new Error(`找不到技能目錄: ${skillId}`);
        }

        await fs.rm(destDir, {recursive: true, force: true});
        await this.copyDirectoryRecursive(srcDir, destDir);
    }

    async copySkillToRepository(skillId: string, repositoryPath: string): Promise<void> {
        if (!validateSkillId(skillId)) {
            throw new Error('無效的技能 ID 格式');
        }

        const srcDir = this.getSkillDirectoryPath(skillId);
        const destDir = path.join(repositoryPath, '.claude', 'skills', skillId);

        try {
            await fs.access(srcDir);
        } catch {
            throw new Error(`找不到技能目錄: ${skillId}`);
        }

        await fs.rm(destDir, {recursive: true, force: true});
        await this.copyDirectoryRecursive(srcDir, destDir);
    }

    async deleteSkillsFromPath(basePath: string): Promise<void> {
        const skillsDir = path.join(basePath, '.claude', 'skills');
        await fs.rm(skillsDir, {recursive: true, force: true});
    }

    async delete(skillId: string): Promise<void> {
        const dirPath = this.getSkillDirectoryPath(skillId);
        await fs.rm(dirPath, {recursive: true, force: true});
    }

    async import(fileName: string, fileData: string, fileSize: number): Promise<{skill: Skill; isOverwrite: boolean}> {
        // 驗證檔案大小
        if (fileSize > MAX_FILE_SIZE) {
            throw new Error('檔案大小超過 5MB 限制');
        }

        // 驗證檔名是否以 .zip 結尾
        if (!fileName.toLowerCase().endsWith('.zip')) {
            throw new Error('檔案格式錯誤，僅支援 ZIP 檔案');
        }

        // 將 Base64 解碼為 Buffer
        let buffer: Buffer;
        try {
            buffer = Buffer.from(fileData, 'base64');
        } catch {
            throw new Error('解壓縮失敗，請確認 ZIP 檔案完整性');
        }

        // 解析 ZIP 檔案結構
        let entries: Record<string, Uint8Array>;
        try {
            entries = unzipSync(new Uint8Array(buffer));
        } catch {
            throw new Error('解壓縮失敗，請確認 ZIP 檔案完整性');
        }

        // 驗證 ZIP 結構
        this.validateZipStructure(entries);

        // 從檔名提取 Skill ID
        const skillId = fileName.slice(0, -4); // 移除 .zip 副檔名

        // 立即驗證 skillId
        if (!validateSkillId(skillId)) {
            throw new Error('檔名格式不正確');
        }

        // 檢查同名 Skill 是否存在
        const isOverwrite = await this.exists(skillId);

        // 建立目標目錄路徑
        const destDir = this.getSkillDirectoryPath(skillId);

        // 若目錄存在，先刪除
        if (isOverwrite) {
            await fs.rm(destDir, {recursive: true, force: true});
        }

        // 建立目錄並解壓縮所有檔案
        await this.extractZipToDirectory(entries, destDir);

        // 讀取 SKILL.md 取得 description
        const skillFilePath = path.join(destDir, SKILL_FILE_NAME);
        const content = await fs.readFile(skillFilePath, 'utf-8');
        const description = parseFrontmatterDescription(content);

        const skill: Skill = {
            id: skillId,
            name: skillId,
            description,
        };

        return {skill, isOverwrite};
    }

    private getSkillDirectoryPath(skillId: string): string {
        if (!validateSkillId(skillId)) {
            throw new Error('無效的技能 ID 格式');
        }

        const safePath = path.join(config.skillsPath, path.basename(skillId));

        if (!isPathWithinDirectory(safePath, config.skillsPath)) {
            throw new Error('無效的技能路徑');
        }

        return safePath;
    }

    private getSkillFilePath(skillId: string): string {
        const skillDir = this.getSkillDirectoryPath(skillId);
        return path.join(skillDir, 'SKILL.md');
    }

    private async copyDirectoryRecursive(
        srcDir: string,
        destDir: string,
        depth: number = 0
    ): Promise<void> {
        if (depth > MAX_DEPTH) {
            throw new Error('超過最大目錄深度');
        }

        await fs.mkdir(destDir, {recursive: true});

        const entries = await fs.readdir(srcDir, {withFileTypes: true});

        if (entries.length > MAX_FILES) {
            throw new Error('超過最大檔案數量');
        }

        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                await this.copyDirectoryRecursive(srcPath, destPath, depth + 1);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    private validateZipStructure(entries: Record<string, Uint8Array>): void {
        // 檢查是否有根目錄的 SKILL.md
        let hasRootSkillMd = false;
        let hasNestedSkillMd = false;

        for (const entryName of Object.keys(entries)) {
            // 檢查是否為根目錄的 SKILL.md
            if (entryName === SKILL_FILE_NAME) {
                hasRootSkillMd = true;
            }
            // 檢查是否有嵌套的 SKILL.md
            if (entryName.endsWith(`/${SKILL_FILE_NAME}`) || entryName.endsWith(`\\${SKILL_FILE_NAME}`)) {
                hasNestedSkillMd = true;
            }
        }

        if (!hasRootSkillMd && !hasNestedSkillMd) {
            throw new Error('ZIP 檔案內找不到 SKILL.md');
        }

        if (!hasRootSkillMd && hasNestedSkillMd) {
            throw new Error('SKILL.md 必須位於根目錄');
        }
    }

    private async extractZipToDirectory(entries: Record<string, Uint8Array>, destDir: string): Promise<void> {
        // 檢查檔案數量限制
        const entryCount = Object.keys(entries).length;
        if (entryCount > MAX_ENTRIES) {
            throw new Error(`ZIP 檔案內容過多，最多允許 ${MAX_ENTRIES} 個檔案`);
        }

        // 檢查解壓後總大小和單檔大小
        let totalSize = 0;
        for (const data of Object.values(entries)) {
            if (data.length > MAX_INDIVIDUAL_FILE_SIZE) {
                throw new Error('ZIP 內包含超過 1MB 的單一檔案');
            }
            totalSize += data.length;
            if (totalSize > MAX_TOTAL_UNZIPPED_SIZE) {
                throw new Error('解壓縮後檔案總大小超過 10MB 限制');
            }
        }

        await fs.mkdir(destDir, {recursive: true});

        for (const [entryName, data] of Object.entries(entries)) {
            // 標準化路徑並移除 null bytes
            let normalizedPath = path.normalize(entryName.replace(/\\/g, '/'));
            normalizedPath = normalizedPath.replace(/\0/g, '');

            // 建構目標路徑
            const destPath = path.join(destDir, normalizedPath);

            // 檢查路徑安全性
            if (!isPathWithinDirectory(destPath, destDir)) {
                throw new Error('偵測到不安全的檔案路徑');
            }

            // 如果是目錄（以 / 結尾），建立目錄
            if (normalizedPath.endsWith('/')) {
                await fs.mkdir(destPath, {recursive: true});
            } else {
                // 確保父目錄存在
                const parentDir = path.dirname(destPath);
                await fs.mkdir(parentDir, {recursive: true});

                // 寫入檔案
                await fs.writeFile(destPath, data);
            }
        }
    }

}

export const skillService = new SkillService();
