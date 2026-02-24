// timer id 不需要是 reactive，放在模組層級避免觸發不必要的響應式更新
export const abortSafetyTimers = new Map<string, ReturnType<typeof setTimeout>>()
