import { describe, it, expect } from 'vitest';
import { buildClaudeContentBlocks } from '../../src/services/claude/messageBuilder.js';
import type { ContentBlock } from '../../src/types/index.js';

function textBlock(text: string): ContentBlock {
    return { type: 'text', text };
}

describe('messageBuilder', () => {
    describe('applyCommandPrefix（透過 buildClaudeContentBlocks 驗證）', () => {
        it('prefix 為空字串時應直接回傳原 text，不套用 prefix', () => {
            const blocks: ContentBlock[] = [textBlock('hello')];

            const result = buildClaudeContentBlocks(blocks, null);

            expect(result[0]).toEqual({ type: 'text', text: 'hello' });
        });

        it('prefixApplied 已為 true 時不應再次套用 prefix（第二個 text block 不套用）', () => {
            const blocks: ContentBlock[] = [
                textBlock('first'),
                textBlock('second'),
            ];

            const result = buildClaudeContentBlocks(blocks, 'cmd');

            expect(result[0]).toEqual({ type: 'text', text: '/cmd first' });
            expect(result[1]).toEqual({ type: 'text', text: 'second' });
        });

        it('正常套用 prefix 並將 prefixApplied 改為 true', () => {
            const blocks: ContentBlock[] = [textBlock('message')];

            const result = buildClaudeContentBlocks(blocks, 'myCommand');

            expect(result[0]).toEqual({ type: 'text', text: '/myCommand message' });
        });
    });
});
