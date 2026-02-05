import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
import {v4 as uuidv4} from 'uuid';
import {zipSync} from 'fflate';
import {
    createTestServer,
    closeTestServer,
    createSocketClient,
    disconnectSocket,
    emitAndWaitResponse,
    type TestServerInstance,
    type TestWebSocketClient,
} from '../setup';
import {
    WebSocketRequestEvents,
    WebSocketResponseEvents,
    type SkillImportPayload,
} from '../../src/schemas';
import {
    type SkillImportedPayload,
} from '../../src/types';

describe('Skill 匯入', () => {
    let server: TestServerInstance;
    let client: TestWebSocketClient;

    beforeAll(async () => {
        server = await createTestServer();
        client = await createSocketClient(server.baseUrl, server.canvasId);
    }, 30000);

    afterAll(async () => {
        if (client?.connected) await disconnectSocket(client);
        if (server) await closeTestServer(server);
    });

    /**
     * 建立有效的 Skill ZIP（包含根目錄的 SKILL.md）
     */
    function createValidSkillZip(skillName: string = 'test-skill'): string {
        const files = {
            'SKILL.md': new TextEncoder().encode(`---
description: "測試技能描述"
---

# ${skillName}

這是一個測試技能。
`),
            'README.md': new TextEncoder().encode('# 說明文件'),
        };

        const zipped = zipSync(files);
        return Buffer.from(zipped).toString('base64');
    }

    /**
     * 建立不包含 SKILL.md 的 ZIP
     */
    function createInvalidSkillZip(): string {
        const files = {
            'README.md': new TextEncoder().encode('# 無效的 Skill'),
        };

        const zipped = zipSync(files);
        return Buffer.from(zipped).toString('base64');
    }

    /**
     * 建立 SKILL.md 在子目錄的 ZIP
     */
    function createNestedSkillZip(): string {
        const files = {
            'subfolder/SKILL.md': new TextEncoder().encode('---\ndescription: "嵌套技能"\n---\n\n# Nested'),
        };

        const zipped = zipSync(files);
        return Buffer.from(zipped).toString('base64');
    }

    describe('匯入成功', () => {
        it('success_when_skill_imported_with_valid_zip', async () => {
            const fileName = 'test-valid-skill.zip';
            const fileData = createValidSkillZip('test-valid-skill');
            const fileSize = Buffer.from(fileData, 'base64').length;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(true);
            expect(response.skill).toBeDefined();
            expect(response.skill!.id).toBe('test-valid-skill');
            expect(response.skill!.name).toBe('test-valid-skill');
            expect(response.skill!.description).toBe('"測試技能描述"');
            expect(response.isOverwrite).toBe(false);
        });

        it('success_when_skill_imported_with_overwrite', async () => {
            const fileName = 'test-overwrite-skill.zip';
            const fileData = createValidSkillZip('test-overwrite-skill');
            const fileSize = Buffer.from(fileData, 'base64').length;

            // 第一次匯入
            const response1 = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response1.success).toBe(true);
            expect(response1.isOverwrite).toBe(false);

            // 第二次匯入（覆蓋）
            const response2 = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response2.success).toBe(true);
            expect(response2.skill).toBeDefined();
            expect(response2.isOverwrite).toBe(true);
        });
    });

    describe('匯入失敗', () => {
        it('failed_when_file_size_exceeds_limit', async () => {
            const fileName = 'large-skill.zip';
            const fileData = createValidSkillZip('large-skill');
            const fileSize = 6 * 1024 * 1024; // 6MB

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('5MB');
        });

        it('failed_when_zip_missing_skill_md', async () => {
            const fileName = 'invalid-skill.zip';
            const fileData = createInvalidSkillZip();
            const fileSize = Buffer.from(fileData, 'base64').length;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('找不到 SKILL.md');
        });

        it('failed_when_skill_md_not_in_root', async () => {
            const fileName = 'nested-skill.zip';
            const fileData = createNestedSkillZip();
            const fileSize = Buffer.from(fileData, 'base64').length;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('根目錄');
        });

        it('failed_when_invalid_zip_format', async () => {
            const fileName = 'invalid-format.zip';
            const fileData = Buffer.from('這不是一個有效的 ZIP 檔案').toString('base64');
            const fileSize = Buffer.from(fileData, 'base64').length;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('解壓縮失敗');
        });

        it('failed_when_empty_base64_data', async () => {
            const fileName = 'empty.zip';
            const fileData = '';
            const fileSize = 0;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('failed_when_invalid_file_extension', async () => {
            const fileName = 'test-skill.txt';
            const fileData = createValidSkillZip('test-skill');
            const fileSize = Buffer.from(fileData, 'base64').length;

            const response = await emitAndWaitResponse<SkillImportPayload, SkillImportedPayload>(
                client,
                WebSocketRequestEvents.SKILL_IMPORT,
                WebSocketResponseEvents.SKILL_IMPORTED,
                {
                    requestId: uuidv4(),
                    canvasId: server.canvasId,
                    fileName,
                    fileData,
                    fileSize,
                }
            );

            expect(response.success).toBe(false);
            expect(response.error).toContain('檔名格式不正確');
        });
    });
});
