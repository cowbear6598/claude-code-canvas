import { configStore } from '../../src/services/configStore.js';
import { initTestDb, closeDb } from '../../src/database/index.js';
import { resetStatements } from '../../src/database/statements.js';

describe('ConfigStore', () => {
  beforeEach(() => {
    resetStatements();
    initTestDb();
  });

  afterEach(() => {
    closeDb();
  });

  describe('取得設定', () => {
    it('DB 無資料時回傳預設值', () => {
      const config = configStore.getAll();

      expect(config.summaryModel).toBe('sonnet');
      expect(config.aiDecideModel).toBe('sonnet');
    });

    it('DB 有資料時回傳 DB 中的值', () => {
      configStore.update({ summaryModel: 'opus' });

      const config = configStore.getAll();

      expect(config.summaryModel).toBe('opus');
      expect(config.aiDecideModel).toBe('sonnet');
    });
  });

  describe('更新設定', () => {
    it('成功寫入並讀取回正確值', () => {
      const result = configStore.update({ summaryModel: 'opus', aiDecideModel: 'haiku' });

      expect(result.summaryModel).toBe('opus');
      expect(result.aiDecideModel).toBe('haiku');
    });

    it('只更新 summaryModel 不影響 aiDecideModel', () => {
      configStore.update({ summaryModel: 'opus', aiDecideModel: 'opus' });
      configStore.update({ summaryModel: 'haiku' });

      const config = configStore.getAll();

      expect(config.summaryModel).toBe('haiku');
      expect(config.aiDecideModel).toBe('opus');
    });

    it('只更新 aiDecideModel 不影響 summaryModel', () => {
      configStore.update({ summaryModel: 'opus', aiDecideModel: 'opus' });
      configStore.update({ aiDecideModel: 'haiku' });

      const config = configStore.getAll();

      expect(config.summaryModel).toBe('opus');
      expect(config.aiDecideModel).toBe('haiku');
    });
  });

  describe('取得單一設定', () => {
    it('getSummaryModel 回傳正確值', () => {
      configStore.update({ summaryModel: 'haiku' });

      expect(configStore.getSummaryModel()).toBe('haiku');
    });

    it('getAiDecideModel 回傳正確值', () => {
      configStore.update({ aiDecideModel: 'opus' });

      expect(configStore.getAiDecideModel()).toBe('opus');
    });
  });
});
