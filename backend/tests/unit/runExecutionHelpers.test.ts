import { describe, it, expect } from 'vitest';
import { isInstanceUnreachable } from '../../src/services/workflow/runExecutionService.js';
import type { RunPodInstance } from '../../src/services/runStore.js';
import type { Connection } from '../../src/types/index.js';

function makeInstance(overrides?: Partial<RunPodInstance>): RunPodInstance {
  return {
    id: 'i-1',
    runId: 'run-1',
    podId: 'pod-a',
    status: 'pending',
    claudeSessionId: null,
    errorMessage: null,
    triggeredAt: null,
    completedAt: null,
    autoPathwaySettled: 'not-applicable',
    directPathwaySettled: 'not-applicable',
    ...overrides,
  };
}

function makeConn(overrides?: Partial<Connection>): Connection {
  return {
    id: 'c-1',
    sourcePodId: 'pod-src',
    targetPodId: 'pod-a',
    sourceAnchor: 'right',
    targetAnchor: 'left',
    triggerMode: 'auto',
    decideStatus: 'none',
    decideReason: null,
    connectionStatus: 'idle',
    ...overrides,
  };
}

describe('isInstanceUnreachable', () => {
  it('auto source skipped → autoUnreachable=true', () => {
    const instance = makeInstance({ autoPathwaySettled: 'pending' });
    const srcA = makeInstance({ id: 'i-src', podId: 'pod-src', status: 'skipped', autoPathwaySettled: 'settled' });
    const conn = makeConn({ sourcePodId: 'pod-src', triggerMode: 'auto' });

    const result = isInstanceUnreachable(instance, [conn], [srcA, instance]);

    expect(result.autoUnreachable).toBe(true);
    expect(result.directUnreachable).toBe(false);
  });

  it('auto source error → autoUnreachable=true', () => {
    const instance = makeInstance({ autoPathwaySettled: 'pending' });
    const srcA = makeInstance({ id: 'i-src', podId: 'pod-src', status: 'error', autoPathwaySettled: 'settled' });
    const conn = makeConn({ sourcePodId: 'pod-src', triggerMode: 'auto' });

    const result = isInstanceUnreachable(instance, [conn], [srcA, instance]);

    expect(result.autoUnreachable).toBe(true);
  });

  it('auto source 仍在執行中 → autoUnreachable=false', () => {
    const instance = makeInstance({ autoPathwaySettled: 'pending' });
    const srcA = makeInstance({ id: 'i-src', podId: 'pod-src', status: 'running', autoPathwaySettled: 'settled' });
    const conn = makeConn({ sourcePodId: 'pod-src', triggerMode: 'auto' });

    const result = isInstanceUnreachable(instance, [conn], [srcA, instance]);

    expect(result.autoUnreachable).toBe(false);
  });

  it('direct：只有部分 source 失敗 → directUnreachable=false（需全部失敗）', () => {
    const instance = makeInstance({ directPathwaySettled: 'pending' });
    const srcA = makeInstance({ id: 'i-a', podId: 'pod-a-src', status: 'error' });
    const srcB = makeInstance({ id: 'i-b', podId: 'pod-b-src', status: 'running' });
    const connA = makeConn({ id: 'c-a', sourcePodId: 'pod-a-src', triggerMode: 'direct' });
    const connB = makeConn({ id: 'c-b', sourcePodId: 'pod-b-src', triggerMode: 'direct' });

    const result = isInstanceUnreachable(instance, [connA, connB], [srcA, srcB, instance]);

    expect(result.directUnreachable).toBe(false);
  });

  it('direct：全部 source 失敗 → directUnreachable=true', () => {
    const instance = makeInstance({ directPathwaySettled: 'pending' });
    const srcA = makeInstance({ id: 'i-a', podId: 'pod-a-src', status: 'error' });
    const srcB = makeInstance({ id: 'i-b', podId: 'pod-b-src', status: 'skipped' });
    const connA = makeConn({ id: 'c-a', sourcePodId: 'pod-a-src', triggerMode: 'direct' });
    const connB = makeConn({ id: 'c-b', sourcePodId: 'pod-b-src', triggerMode: 'direct' });

    const result = isInstanceUnreachable(instance, [connA, connB], [srcA, srcB, instance]);

    expect(result.directUnreachable).toBe(true);
  });

  it('directPathwaySettled 非 pending 時 directUnreachable=false（已結算，不須再處理）', () => {
    const instance = makeInstance({ directPathwaySettled: 'settled' });
    const srcA = makeInstance({ id: 'i-src', podId: 'pod-src', status: 'skipped' });
    const conn = makeConn({ sourcePodId: 'pod-src', triggerMode: 'direct' });

    const result = isInstanceUnreachable(instance, [conn], [srcA, instance]);

    expect(result.directUnreachable).toBe(false);
  });

  it('autoPathwaySettled 非 pending 時 autoUnreachable=false（已結算，不須再處理）', () => {
    const instance = makeInstance({ autoPathwaySettled: 'settled' });
    const srcA = makeInstance({ id: 'i-src', podId: 'pod-src', status: 'skipped' });
    const conn = makeConn({ sourcePodId: 'pod-src', triggerMode: 'auto' });

    const result = isInstanceUnreachable(instance, [conn], [srcA, instance]);

    expect(result.autoUnreachable).toBe(false);
  });

  it('無 incoming connections → autoUnreachable=false, directUnreachable=false', () => {
    const instance = makeInstance({ autoPathwaySettled: 'pending', directPathwaySettled: 'pending' });

    const result = isInstanceUnreachable(instance, [], [instance]);

    expect(result.autoUnreachable).toBe(false);
    expect(result.directUnreachable).toBe(false);
  });
});
