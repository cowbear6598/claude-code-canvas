import { describe, it, expect, beforeEach } from 'bun:test';
import { directTriggerStore } from '../../src/services/directTriggerStore.js';

describe('DirectTriggerStore', () => {
  const targetPodId = 'target-pod-1';
  const sourcePodId1 = 'source-pod-1';
  const sourcePodId2 = 'source-pod-2';

  beforeEach(() => {
    directTriggerStore.clearDirectPending(targetPodId);
    directTriggerStore.clearDirectPending('target-pod-2');
  });

  describe('基本功能', () => {
    it('initializeDirectPending 正確初始化 direct 等待狀態', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      expect(directTriggerStore.hasDirectPending(targetPodId)).toBe(true);
      const summaries = directTriggerStore.getReadySummaries(targetPodId);
      expect(summaries).not.toBeNull();
      expect(summaries?.size).toBe(0);
      expect(directTriggerStore.hasActiveTimer(targetPodId)).toBe(false);
    });

    it('recordDirectReady 正確記錄單條 direct 就緒', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      const count = directTriggerStore.recordDirectReady(targetPodId, sourcePodId1, 'Summary 1');

      expect(count).toBe(1);
      expect(directTriggerStore.getReadyCount(targetPodId)).toBe(1);

      const summaries = directTriggerStore.getReadySummaries(targetPodId);
      expect(summaries?.get(sourcePodId1)).toBe('Summary 1');
    });

    it('recordDirectReady 多條 direct 正確累積', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      directTriggerStore.recordDirectReady(targetPodId, sourcePodId1, 'Summary 1');
      const count = directTriggerStore.recordDirectReady(targetPodId, sourcePodId2, 'Summary 2');

      expect(count).toBe(2);
      expect(directTriggerStore.getReadyCount(targetPodId)).toBe(2);

      const summaries = directTriggerStore.getReadySummaries(targetPodId);
      expect(summaries?.get(sourcePodId1)).toBe('Summary 1');
      expect(summaries?.get(sourcePodId2)).toBe('Summary 2');
    });

    it('getReadySummaries 回傳所有已就緒的摘要', () => {
      directTriggerStore.initializeDirectPending(targetPodId);
      directTriggerStore.recordDirectReady(targetPodId, sourcePodId1, 'Summary 1');
      directTriggerStore.recordDirectReady(targetPodId, sourcePodId2, 'Summary 2');

      const summaries = directTriggerStore.getReadySummaries(targetPodId);

      expect(summaries).not.toBeNull();
      expect(summaries?.size).toBe(2);
      expect(Array.from(summaries!.keys())).toEqual([sourcePodId1, sourcePodId2]);
    });

    it('clearDirectPending 正確清除', () => {
      directTriggerStore.initializeDirectPending(targetPodId);
      directTriggerStore.recordDirectReady(targetPodId, sourcePodId1, 'Summary 1');

      directTriggerStore.clearDirectPending(targetPodId);

      expect(directTriggerStore.hasDirectPending(targetPodId)).toBe(false);
      expect(directTriggerStore.getReadySummaries(targetPodId)).toBeNull();
    });
  });

  describe('倒數計時', () => {
    it('hasActiveTimer 正確偵測倒數狀態', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      expect(directTriggerStore.hasActiveTimer(targetPodId)).toBe(false);

      const timer = setTimeout(() => {}, 1000);
      directTriggerStore.setTimer(targetPodId, timer);

      expect(directTriggerStore.hasActiveTimer(targetPodId)).toBe(true);

      clearTimeout(timer);
    });

    it('setTimer / getTimer 正確儲存與取得 timer 參考', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      const timer = setTimeout(() => {}, 1000);
      directTriggerStore.setTimer(targetPodId, timer);

      const retrievedTimer = directTriggerStore.getTimer(targetPodId);
      expect(retrievedTimer).toBe(timer);

      clearTimeout(timer);
    });

    it('clearTimer 正確清除 timer', () => {
      directTriggerStore.initializeDirectPending(targetPodId);

      const timer = setTimeout(() => {}, 1000);
      directTriggerStore.setTimer(targetPodId, timer);

      expect(directTriggerStore.hasActiveTimer(targetPodId)).toBe(true);

      directTriggerStore.clearTimer(targetPodId);

      expect(directTriggerStore.hasActiveTimer(targetPodId)).toBe(false);
      expect(directTriggerStore.getTimer(targetPodId)).toBeNull();
    });
  });
});
