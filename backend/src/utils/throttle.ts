export interface ThrottledFunction<T extends unknown[]> {
  (...args: T): void;
  cancel: () => void;
  flush: () => void;
}

export function throttle<T extends unknown[]>(
  func: (...args: T) => void,
  delay: number
): ThrottledFunction<T> {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | undefined;
  let pendingArgs: T | undefined;

  const throttled = function (...args: T): void {
    pendingArgs = args;
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func(...args);
      pendingArgs = undefined;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        if (pendingArgs) {
          func(...pendingArgs);
        }
        timeoutId = undefined;
        pendingArgs = undefined;
      }, delay - timeSinceLastCall);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    pendingArgs = undefined;
  };

  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (pendingArgs) {
      lastCall = Date.now();
      func(...pendingArgs);
      pendingArgs = undefined;
    }
  };

  return throttled as ThrottledFunction<T>;
}
