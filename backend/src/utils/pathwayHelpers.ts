import type { PathwayState } from '../types/run.js';

export function pathwayStateToSqliteInt(state: PathwayState): number | null {
    if (state === 'not-applicable') return null;
    return state === 'settled' ? 1 : 0;
}

export function sqliteIntToPathwayState(value: number | null): PathwayState {
    if (value === null) return 'not-applicable';
    return value === 1 ? 'settled' : 'pending';
}

export function isAllPathwaysSettled(auto: PathwayState, direct: PathwayState): boolean {
    return auto !== 'pending' && direct !== 'pending';
}
