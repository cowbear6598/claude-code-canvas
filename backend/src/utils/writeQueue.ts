import { getErrorMessage } from './errorHelpers.js';
import { logger } from './logger.js';
import type { LogCategory } from './logger.js';

export class WriteQueue {
    private queues: Map<string, Promise<void>> = new Map();
    private readonly category: LogCategory;
    private readonly storeName: string;

    constructor(category: LogCategory, storeName: string) {
        this.category = category;
        this.storeName = storeName;
    }

    /** 將寫入操作排入佇列，確保同一 key 的寫入依序執行 */
    enqueue(key: string, writeFn: () => Promise<void>): void {
        const previousWrite = this.queues.get(key) ?? Promise.resolve();
        const nextWrite = previousWrite
            .then(() => writeFn())
            .catch((error: unknown) => {
                const errorMsg = getErrorMessage(error);
                logger.error(this.category, 'Error', `[${this.storeName}] 寫入佇列執行失敗 (${key}): ${errorMsg}`);
            });
        this.queues.set(key, nextWrite);
    }

    /** 等待指定 key 所有排隊中的磁碟寫入完成 */
    flush(key: string): Promise<void> {
        return this.queues.get(key) ?? Promise.resolve();
    }

    /** 清除指定 key 的佇列（用於資源刪除後避免記憶體洩漏） */
    delete(key: string): void {
        this.queues.delete(key);
    }
}
