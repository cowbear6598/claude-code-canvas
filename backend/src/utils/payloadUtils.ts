export function extractRequestId(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null && 'requestId' in payload) {
    const reqId = (payload as { requestId?: unknown }).requestId;
    return typeof reqId === 'string' ? reqId : undefined;
  }
  return undefined;
}

export function extractPodId(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null && 'podId' in payload) {
    const podId = (payload as { podId?: unknown }).podId;
    return typeof podId === 'string' ? podId : undefined;
  }
  return undefined;
}

export function isValidPodId(podId: unknown): podId is string {
  return typeof podId === 'string' && podId.length > 0;
}
