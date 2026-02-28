import { Result, ok, err } from '../types';
import { logger, type LogCategory } from './logger.js';

export async function gitOperation<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<Result<T>> {
  try {
    const data = await operation();
    return ok(data);
  } catch (error) {
    logger.error('Git', 'Error', `[Git] ${errorContext}`, error);
    return err(errorContext);
  }
}

export async function fsOperation<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<Result<T>> {
  try {
    const data = await operation();
    return ok(data);
  } catch (error) {
    logger.error('Workspace', 'Error', `[FS] ${errorContext}`, error);
    return err(errorContext);
  }
}

export function fireAndForget(promise: Promise<unknown>, category: LogCategory, errorContext: string): void {
  promise.catch((error) => {
    logger.error(category, 'Error', errorContext, error);
  });
}

export type { Result };
