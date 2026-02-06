import { describe, it, expect } from 'bun:test';
import { summaryPromptBuilder } from '../../src/services/summaryPromptBuilder.js';
import type { PersistedMessage } from '../../src/types';

describe('SummaryPromptBuilder', () => {
  const mockMessages: PersistedMessage[] = [
    {
      id: 'msg-1',
      podId: 'pod-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      toolUse: null,
    },
    {
      id: 'msg-2',
      podId: 'pod-1',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: Date.now(),
      toolUse: null,
    },
  ];

  const conversationHistory = '[User]: Hello\n\n[Assistant]: Hi there!';

  describe('buildUserPrompt 優先權規則', () => {
    it('只有 targetPodOutputStyle 時，使用 Output Style 篩選', () => {
      const context = {
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: 'You are a code reviewer.',
        targetPodCommand: null,
        conversationHistory,
      };

      const result = summaryPromptBuilder.buildUserPrompt(context);

      expect(result).toContain('Source Pod');
      expect(result).toContain('Target Pod');
      expect(result).toContain('You are a code reviewer.');
      expect(result).toContain('角色定位');
      expect(result).not.toContain('指令內容');
    });

    it('只有 targetPodCommand 時，使用 Command 內容篩選', () => {
      const context = {
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: null,
        targetPodCommand: 'Review the code for bugs.',
        conversationHistory,
      };

      const result = summaryPromptBuilder.buildUserPrompt(context);

      expect(result).toContain('Source Pod');
      expect(result).toContain('Target Pod');
      expect(result).toContain('Review the code for bugs.');
      expect(result).toContain('指令內容');
      expect(result).not.toContain('角色定位');
    });

    it('兩者都有時，Command 優先', () => {
      const context = {
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: 'You are a code reviewer.',
        targetPodCommand: 'Review the code for bugs.',
        conversationHistory,
      };

      const result = summaryPromptBuilder.buildUserPrompt(context);

      expect(result).toContain('Review the code for bugs.');
      expect(result).toContain('指令內容');
      expect(result).not.toContain('You are a code reviewer.');
      expect(result).not.toContain('角色定位');
    });

    it('兩者都沒有時，使用預設完整摘要', () => {
      const context = {
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: null,
        targetPodCommand: null,
        conversationHistory,
      };

      const result = summaryPromptBuilder.buildUserPrompt(context);

      expect(result).toContain('Source Pod');
      expect(result).toContain('完整摘要');
      expect(result).not.toContain('指令內容');
      expect(result).not.toContain('角色定位');
    });

    it('targetPodCommand 為空字串時，視為沒有 Command', () => {
      const context = {
        sourcePodName: 'Source Pod',
        sourcePodOutputStyle: null,
        targetPodName: 'Target Pod',
        targetPodOutputStyle: 'You are a code reviewer.',
        targetPodCommand: '   ',
        conversationHistory,
      };

      const result = summaryPromptBuilder.buildUserPrompt(context);

      expect(result).toContain('You are a code reviewer.');
      expect(result).toContain('角色定位');
      expect(result).not.toContain('指令內容');
    });
  });

  describe('buildSystemPrompt', () => {
    it('有 sourcePodOutputStyle 時加入風格指示', () => {
      const result = summaryPromptBuilder.buildSystemPrompt('You are a technical writer.');

      expect(result).toContain('You are a technical writer.');
      expect(result).toContain('摘要對話內容');
    });

    it('沒有 sourcePodOutputStyle 時使用預設', () => {
      const result = summaryPromptBuilder.buildSystemPrompt(null);

      expect(result).toContain('專業的內容摘要助手');
      expect(result).not.toContain('摘要對話內容');
    });
  });

  describe('formatConversationHistory', () => {
    it('正確格式化訊息歷史', () => {
      const result = summaryPromptBuilder.formatConversationHistory(mockMessages);

      expect(result).toBe('[User]: Hello\n\n[Assistant]: Hi there!');
    });

    it('空陣列回傳空字串', () => {
      const result = summaryPromptBuilder.formatConversationHistory([]);

      expect(result).toBe('');
    });
  });
});
