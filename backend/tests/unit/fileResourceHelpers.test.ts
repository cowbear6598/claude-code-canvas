import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { readJsonFileOrDefault } from '../../src/services/shared/fileResourceHelpers.js';

describe('fileResourceHelpers', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-resource-test-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    describe('readJsonFileOrDefault', () => {
        it('檔案不存在時應回傳 null', async () => {
            const result = await readJsonFileOrDefault(path.join(tmpDir, 'missing.json'));
            expect(result).toBeNull();
        });

        it('檔案存在且是有效 JSON 時應回傳解析後的資料', async () => {
            const data = [{ id: '1', name: 'test' }];
            await fs.writeFile(path.join(tmpDir, 'valid.json'), JSON.stringify(data));

            const result = await readJsonFileOrDefault(path.join(tmpDir, 'valid.json'));

            expect(result).toEqual(data);
        });

        it('檔案存在但 JSON 格式無效時應回傳 null（而非拋出錯誤）', async () => {
            await fs.writeFile(path.join(tmpDir, 'invalid.json'), '{ 這不是有效的 JSON }');

            const result = await readJsonFileOrDefault(path.join(tmpDir, 'invalid.json'));

            expect(result).toBeNull();
        });
    });
});
