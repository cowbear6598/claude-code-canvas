import fs from 'fs/promises';
import path from 'path';
import {config} from '../config/index.js';
import type {Skill} from '../types/index.js';
import {isPathWithinDirectory, validatePodId, validateSkillId} from '../utils/pathValidator.js';
import {readFileOrNull, fileExists, parseFrontmatterDescription} from './shared/fileResourceHelpers.js';

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

    async getContent(skillId: string): Promise<string | null> {
        const filePath = this.getSkillFilePath(skillId);
        return readFileOrNull(filePath);
    }

    async exists(skillId: string): Promise<boolean> {
        const filePath = this.getSkillFilePath(skillId);
        return fileExists(filePath);
    }

    /**
     * Copy a skill directory to a pod's workspace
     */
    async copySkillToPod(skillId: string, podId: string): Promise<void> {
        if (!validateSkillId(skillId)) {
            throw new Error('無效的技能 ID 格式');
        }
        if (!validatePodId(podId)) {
            throw new Error('無效的 Pod ID 格式');
        }

        const srcDir = this.getSkillDirectoryPath(skillId);
        const destDir = path.join(config.canvasRoot, `pod-${podId}`, '.claude', 'skills', skillId);

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

    /**
     * Delete the .claude/skills directory from a path
     */
    async deleteSkillsFromPath(basePath: string): Promise<void> {
        const skillsDir = path.join(basePath, '.claude', 'skills');

        try {
            await fs.rm(skillsDir, {recursive: true, force: true});
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                // Intentionally not logging - too verbose
            }
        }
    }

    async delete(skillId: string): Promise<void> {
        const dirPath = this.getSkillDirectoryPath(skillId);
        await fs.rm(dirPath, {recursive: true, force: true});
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
        const MAX_DEPTH = 10;
        if (depth > MAX_DEPTH) {
            throw new Error('超過最大目錄深度');
        }

        await fs.mkdir(destDir, {recursive: true});

        const entries = await fs.readdir(srcDir, {withFileTypes: true});

        const MAX_FILES = 1000;
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

}

export const skillService = new SkillService();
