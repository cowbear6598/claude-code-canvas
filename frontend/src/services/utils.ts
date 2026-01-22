/**
 * Generate a unique request ID using the Web Crypto API
 * @returns A unique UUID string
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}
