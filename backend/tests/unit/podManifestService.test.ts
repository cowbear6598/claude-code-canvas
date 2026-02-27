import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {vi} from 'vitest';
import {podManifestService} from '../../src/services/podManifestService.js';
import {logger} from '../../src/utils/logger.js';

describe('PodManifestService', () => {
    let tmpDir: string;
    const podId = 'test-pod-id';

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pod-manifest-test-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, {recursive: true, force: true});
    });

    describe('getManifestPath', () => {
        it('應回傳正確的 manifest 路徑', () => {
            const result = podManifestService.getManifestPath('/repo/path', podId);
            expect(result).toBe(`/repo/path/.claude/.pod-manifest-${podId}.json`);
        });
    });

    describe('readManifest', () => {
        it('manifest 不存在時回傳空陣列', async () => {
            const result = await podManifestService.readManifest(tmpDir, podId);
            expect(result).toEqual([]);
        });

        it('manifest 存在時回傳正確的 managedFiles', async () => {
            const claudeDir = path.join(tmpDir, '.claude');
            await fs.mkdir(claudeDir, {recursive: true});

            const manifestPath = path.join(claudeDir, `.pod-manifest-${podId}.json`);
            const managedFiles = ['.claude/commands/test.md', '.claude/agents/agent.md'];
            await fs.writeFile(manifestPath, JSON.stringify({managedFiles}), 'utf-8');

            const result = await podManifestService.readManifest(tmpDir, podId);
            expect(result).toEqual(managedFiles);
        });

        it('manifest 內容損壞時回傳空陣列並記錄警告', async () => {
            const claudeDir = path.join(tmpDir, '.claude');
            await fs.mkdir(claudeDir, {recursive: true});

            const manifestPath = path.join(claudeDir, `.pod-manifest-${podId}.json`);
            await fs.writeFile(manifestPath, '{ 這不是有效的 JSON }', 'utf-8');

            const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
            const result = await podManifestService.readManifest(tmpDir, podId);

            expect(result).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('writeManifest', () => {
        it('正確寫入 managedFiles 到指定路徑', async () => {
            const managedFiles = ['.claude/commands/test.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            const manifestPath = podManifestService.getManifestPath(tmpDir, podId);
            const content = await fs.readFile(manifestPath, 'utf-8');
            const parsed = JSON.parse(content);

            expect(parsed.managedFiles).toEqual(managedFiles);
        });

        it('目錄不存在時自動建立', async () => {
            const nestedDir = path.join(tmpDir, 'nested-repo');
            const managedFiles = ['.claude/commands/test.md'];

            await podManifestService.writeManifest(nestedDir, podId, managedFiles);

            const manifestPath = podManifestService.getManifestPath(nestedDir, podId);
            const exists = await fs.access(manifestPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('deleteManagedFiles', () => {
        it('只刪除 manifest 中的檔案，保留其他檔案', async () => {
            const claudeCommandsDir = path.join(tmpDir, '.claude', 'commands');
            await fs.mkdir(claudeCommandsDir, {recursive: true});

            await fs.writeFile(path.join(claudeCommandsDir, 'test.md'), 'managed file');
            await fs.writeFile(path.join(claudeCommandsDir, 'user-own.md'), 'user file');

            const managedFiles = ['.claude/commands/test.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            await podManifestService.deleteManagedFiles(tmpDir, podId);

            const testExists = await fs.access(path.join(claudeCommandsDir, 'test.md')).then(() => true).catch(() => false);
            const userOwnExists = await fs.access(path.join(claudeCommandsDir, 'user-own.md')).then(() => true).catch(() => false);

            expect(testExists).toBe(false);
            expect(userOwnExists).toBe(true);
        });

        it('manifest 中的檔案已不存在時不報錯', async () => {
            const managedFiles = ['.claude/commands/not-exist.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            await expect(podManifestService.deleteManagedFiles(tmpDir, podId)).resolves.not.toThrow();
        });

        it('刪除後清理空目錄', async () => {
            const skillDir = path.join(tmpDir, '.claude', 'skills', 'my-skill');
            await fs.mkdir(skillDir, {recursive: true});
            await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'skill content');

            const managedFiles = ['.claude/skills/my-skill/SKILL.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            await podManifestService.deleteManagedFiles(tmpDir, podId);

            const skillDirExists = await fs.access(skillDir).then(() => true).catch(() => false);
            expect(skillDirExists).toBe(false);
        });

        it('刪除後刪除 manifest 檔案本身', async () => {
            const managedFiles = ['.claude/commands/test.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            await podManifestService.deleteManagedFiles(tmpDir, podId);

            const manifestPath = podManifestService.getManifestPath(tmpDir, podId);
            const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
            expect(manifestExists).toBe(false);
        });
    });

    describe('deleteManifestFile', () => {
        it('僅刪除 manifest 檔案本身', async () => {
            const claudeCommandsDir = path.join(tmpDir, '.claude', 'commands');
            await fs.mkdir(claudeCommandsDir, {recursive: true});
            await fs.writeFile(path.join(claudeCommandsDir, 'test.md'), 'content');

            const managedFiles = ['.claude/commands/test.md'];
            await podManifestService.writeManifest(tmpDir, podId, managedFiles);

            await podManifestService.deleteManifestFile(tmpDir, podId);

            const manifestPath = podManifestService.getManifestPath(tmpDir, podId);
            const manifestExists = await fs.access(manifestPath).then(() => true).catch(() => false);
            const fileExists = await fs.access(path.join(claudeCommandsDir, 'test.md')).then(() => true).catch(() => false);

            expect(manifestExists).toBe(false);
            expect(fileExists).toBe(true);
        });

        it('manifest 不存在時不報錯', async () => {
            await expect(podManifestService.deleteManifestFile(tmpDir, podId)).resolves.not.toThrow();
        });
    });

    describe('collectCommandFiles', () => {
        it('回傳正確的 command 檔案路徑格式', () => {
            const result = podManifestService.collectCommandFiles('my-command');
            expect(result).toEqual(['.claude/commands/my-command.md']);
        });
    });

    describe('collectSubAgentFiles', () => {
        it('回傳正確的 subAgent 檔案路徑格式', () => {
            const result = podManifestService.collectSubAgentFiles('my-agent');
            expect(result).toEqual(['.claude/agents/my-agent.md']);
        });
    });

    describe('collectSkillFiles', () => {
        it('收集 skill 目錄下所有檔案路徑', async () => {
            const skillDir = path.join(tmpDir, 'my-skill-source');
            await fs.mkdir(skillDir, {recursive: true});
            await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'skill content');
            await fs.writeFile(path.join(skillDir, 'helper.ts'), 'helper code');

            const result = await podManifestService.collectSkillFiles('my-skill', skillDir);

            expect(result).toContain('.claude/skills/my-skill/SKILL.md');
            expect(result).toContain('.claude/skills/my-skill/helper.ts');
            expect(result).toHaveLength(2);
        });

        it('遞迴收集子目錄下的檔案', async () => {
            const skillDir = path.join(tmpDir, 'my-skill-source');
            const subDir = path.join(skillDir, 'utils');
            await fs.mkdir(subDir, {recursive: true});
            await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'skill content');
            await fs.writeFile(path.join(subDir, 'util.ts'), 'util code');

            const result = await podManifestService.collectSkillFiles('my-skill', skillDir);

            expect(result).toContain('.claude/skills/my-skill/SKILL.md');
            expect(result).toContain('.claude/skills/my-skill/utils/util.ts');
            expect(result).toHaveLength(2);
        });
    });
});
