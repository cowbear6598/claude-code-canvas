export function isValidPodId(podId: unknown): podId is string {
  return typeof podId === 'string' && podId.length > 0;
}
