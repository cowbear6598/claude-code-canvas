import { describe, it, expect } from 'bun:test';
import { validatePathSegment, sanitizePathSegment, validateGroupName } from '../../src/utils/pathValidator.js';

describe('路徑驗證工具', () => {
  describe('validateGroupName', () => {
    it('允許有效的群組名稱', () => {
      expect(validateGroupName('valid-name')).toBe(true);
      expect(validateGroupName('test123')).toBe(true);
      expect(validateGroupName('my-group-123')).toBe(true);
      expect(validateGroupName('ABC-def-123')).toBe(true);
    });

    it('拒絕空字串', () => {
      expect(validateGroupName('')).toBe(false);
    });

    it('拒絕包含斜線的名稱', () => {
      expect(validateGroupName('path/traversal')).toBe(false);
      expect(validateGroupName('path\\traversal')).toBe(false);
    });

    it('拒絕包含點點的名稱', () => {
      expect(validateGroupName('..')).toBe(false);
      expect(validateGroupName('../evil')).toBe(false);
    });

    it('拒絕包含特殊字元的名稱', () => {
      expect(validateGroupName('test@group')).toBe(false);
      expect(validateGroupName('test#group')).toBe(false);
      expect(validateGroupName('test group')).toBe(false);
      expect(validateGroupName('test_group')).toBe(false);
    });

    it('拒絕超過100字元的名稱', () => {
      const longName = 'a'.repeat(101);
      expect(validateGroupName(longName)).toBe(false);
    });

    it('允許剛好100字元的名稱', () => {
      const maxName = 'a'.repeat(100);
      expect(validateGroupName(maxName)).toBe(true);
    });
  });

  describe('validatePathSegment', () => {
    it('允許有效的路徑名稱', () => {
      expect(validatePathSegment('valid-name')).toBe(true);
      expect(validatePathSegment('test123')).toBe(true);
      expect(validatePathSegment('my-group-123')).toBe(true);
      expect(validatePathSegment('ABC-def-123')).toBe(true);
    });

    it('拒絕包含斜線的路徑', () => {
      expect(validatePathSegment('path/traversal')).toBe(false);
      expect(validatePathSegment('path\\traversal')).toBe(false);
    });

    it('拒絕包含點點的路徑', () => {
      expect(validatePathSegment('..')).toBe(false);
      expect(validatePathSegment('../evil')).toBe(false);
    });

    it('拒絕包含特殊字元的路徑', () => {
      expect(validatePathSegment('test@group')).toBe(false);
      expect(validatePathSegment('test#group')).toBe(false);
      expect(validatePathSegment('test group')).toBe(false);
      expect(validatePathSegment('test_group')).toBe(false);
    });

    it('拒絕超過100字元的路徑', () => {
      const longName = 'a'.repeat(101);
      expect(validatePathSegment(longName)).toBe(false);
    });

    it('允許剛好100字元的路徑', () => {
      const maxName = 'a'.repeat(100);
      expect(validatePathSegment(maxName)).toBe(true);
    });
  });

  describe('sanitizePathSegment', () => {
    it('回傳有效的路徑名稱', () => {
      expect(sanitizePathSegment('valid-name')).toBe('valid-name');
      expect(sanitizePathSegment('test123')).toBe('test123');
    });

    it('使用basename萃取檔名但仍需符合規則', () => {
      expect(sanitizePathSegment('test-path')).toBe('test-path');
    });

    it('拋出錯誤當路徑包含不允許的字元', () => {
      expect(() => sanitizePathSegment('test@group')).toThrow('名稱格式不正確，只能包含英文、數字、dash');
      expect(() => sanitizePathSegment('test group')).toThrow('名稱格式不正確，只能包含英文、數字、dash');
      expect(() => sanitizePathSegment('test_group')).toThrow('名稱格式不正確，只能包含英文、數字、dash');
    });

    it('拋出錯誤當路徑包含遍歷字元', () => {
      expect(() => sanitizePathSegment('..')).toThrow('名稱格式不正確，只能包含英文、數字、dash');
      expect(() => sanitizePathSegment('.')).toThrow('名稱格式不正確，只能包含英文、數字、dash');
    });

    it('拋出錯誤當路徑超過100字元', () => {
      const longName = 'a'.repeat(101);
      expect(() => sanitizePathSegment(longName)).toThrow('名稱格式不正確，只能包含英文、數字、dash');
    });
  });
});
