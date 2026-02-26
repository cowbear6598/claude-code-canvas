import { fireAndForget } from '../../src/utils/operationHelpers.js';
import { logger } from '../../src/utils/logger.js';

describe('fireAndForget', () => {
    beforeEach(() => {
        vi.spyOn(logger, 'error').mockImplementation(() => {});
    });

    it('Promise resolve 時不應呼叫 logger.error', async () => {
        fireAndForget(Promise.resolve(), 'Chat', '成功情境測試');

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(logger.error).not.toHaveBeenCalled();
    });

    it('Promise reject 時應呼叫 logger.error 並帶正確的 category 和 context', async () => {
        const error = new Error('發生錯誤');
        fireAndForget(Promise.reject(error), 'Chat', '失敗情境測試');

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(logger.error).toHaveBeenCalledWith('Chat', 'Error', '失敗情境測試', error);
    });
});
