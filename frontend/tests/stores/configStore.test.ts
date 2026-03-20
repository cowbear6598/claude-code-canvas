import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// 使用 vi.hoisted 確保 mock 在 vi.mock 中可用
const { mockGetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
}));

vi.mock("@/services/configApi", () => ({
  getConfig: mockGetConfig,
}));

describe("configStore", () => {
  let useConfigStore: typeof import("@/stores/configStore").useConfigStore;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const module = await import("@/stores/configStore");
    useConfigStore = module.useConfigStore;
  });

  it("初始 timezoneOffset 應為 8", () => {
    const store = useConfigStore();
    expect(store.timezoneOffset).toBe(8);
  });

  it("fetchConfig 應從 API 載入 timezoneOffset 並更新 state", async () => {
    mockGetConfig.mockResolvedValueOnce({
      success: true,
      timezoneOffset: -3,
    });

    const store = useConfigStore();
    await store.fetchConfig();

    expect(store.timezoneOffset).toBe(-3);
  });

  it("setTimezoneOffset 應更新 state", () => {
    const store = useConfigStore();
    store.setTimezoneOffset(5);
    expect(store.timezoneOffset).toBe(5);
  });

  it("fetchConfig 回傳 undefined timezoneOffset 時應保持預設值 8", async () => {
    mockGetConfig.mockResolvedValueOnce({
      success: true,
      summaryModel: "sonnet",
      aiDecideModel: "sonnet",
    });

    const store = useConfigStore();
    await store.fetchConfig();

    expect(store.timezoneOffset).toBe(8);
  });
});
