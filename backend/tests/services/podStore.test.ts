// PodStore Unit Tests
// Tests for in-memory Pod storage service

import { describe, it, expect, beforeEach } from 'vitest';
import { podStore } from '../../src/services/podStore.js';
import { CreatePodRequest } from '../../src/types/index.js';

describe('PodStore', () => {
  // Clear the store before each test
  beforeEach(() => {
    // Get all pods and delete them
    const allPods = podStore.getAll();
    allPods.forEach((pod) => podStore.delete(pod.id));
  });

  describe('create', () => {
    it('should create a pod with valid data', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const pod = podStore.create(request);

      expect(pod).toBeDefined();
      expect(pod.id).toBeDefined();
      expect(pod.name).toBe(request.name);
      expect(pod.type).toBe(request.type);
      expect(pod.color).toBe(request.color);
      expect(pod.status).toBe('idle');
      expect(pod.gitUrl).toBeNull();
      expect(pod.workspacePath).toContain('pod-');
      expect(pod.createdAt).toBeInstanceOf(Date);
      expect(pod.lastActiveAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for multiple pods', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const pod1 = podStore.create(request);
      const pod2 = podStore.create(request);

      expect(pod1.id).not.toBe(pod2.id);
    });

    it('should set initial status to idle', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Chat Companion',
        color: 'coral',
      };

      const pod = podStore.create(request);

      expect(pod.status).toBe('idle');
    });

    it('should generate workspace path based on pod ID', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Creative Writer',
        color: 'pink',
      };

      const pod = podStore.create(request);

      expect(pod.workspacePath).toContain(`pod-${pod.id}`);
    });
  });

  describe('getById', () => {
    it('should return pod if exists', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Data Analyst',
        color: 'yellow',
      };

      const created = podStore.create(request);
      const retrieved = podStore.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it('should return undefined if pod does not exist', () => {
      const retrieved = podStore.getById('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no pods exist', () => {
      const pods = podStore.getAll();

      expect(pods).toEqual([]);
    });

    it('should return all pods', () => {
      const request1: CreatePodRequest = {
        name: 'Pod 1',
        type: 'Code Assistant',
        color: 'blue',
      };
      const request2: CreatePodRequest = {
        name: 'Pod 2',
        type: 'Chat Companion',
        color: 'coral',
      };

      podStore.create(request1);
      podStore.create(request2);

      const pods = podStore.getAll();

      expect(pods).toHaveLength(2);
      expect(pods[0].name).toBe('Pod 1');
      expect(pods[1].name).toBe('Pod 2');
    });
  });

  describe('update', () => {
    it('should update existing pod', () => {
      const request: CreatePodRequest = {
        name: 'Original Name',
        type: 'General AI',
        color: 'green',
      };

      const created = podStore.create(request);
      const updated = podStore.update(created.id, {
        name: 'Updated Name',
        status: 'busy',
      });

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(created.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.status).toBe('busy');
      expect(updated?.type).toBe(created.type);
      expect(updated?.color).toBe(created.color);
    });

    it('should return undefined for non-existent pod', () => {
      const updated = podStore.update('non-existent-id', {
        name: 'Updated Name',
      });

      expect(updated).toBeUndefined();
    });

    it('should update gitUrl', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const created = podStore.create(request);
      const updated = podStore.update(created.id, {
        gitUrl: 'https://github.com/user/repo.git',
      });

      expect(updated?.gitUrl).toBe('https://github.com/user/repo.git');
    });
  });

  describe('delete', () => {
    it('should remove pod and return true', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const created = podStore.create(request);
      const deleted = podStore.delete(created.id);

      expect(deleted).toBe(true);
      expect(podStore.getById(created.id)).toBeUndefined();
    });

    it('should return false for non-existent pod', () => {
      const deleted = podStore.delete('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  describe('setStatus', () => {
    it('should update pod status', () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const created = podStore.create(request);
      podStore.setStatus(created.id, 'busy');

      const retrieved = podStore.getById(created.id);
      expect(retrieved?.status).toBe('busy');
    });

    it('should not throw error for non-existent pod', () => {
      expect(() => {
        podStore.setStatus('non-existent-id', 'busy');
      }).not.toThrow();
    });
  });

  describe('updateLastActive', () => {
    it('should update lastActiveAt timestamp', async () => {
      const request: CreatePodRequest = {
        name: 'Test Pod',
        type: 'Code Assistant',
        color: 'blue',
      };

      const created = podStore.create(request);
      const originalTime = created.lastActiveAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      podStore.updateLastActive(created.id);

      const retrieved = podStore.getById(created.id);
      expect(retrieved?.lastActiveAt.getTime()).toBeGreaterThan(
        originalTime.getTime()
      );
    });

    it('should not throw error for non-existent pod', () => {
      expect(() => {
        podStore.updateLastActive('non-existent-id');
      }).not.toThrow();
    });
  });
});
