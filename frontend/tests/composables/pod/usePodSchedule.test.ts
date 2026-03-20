import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import { usePodSchedule } from "@/composables/pod/usePodSchedule";
import type { Schedule } from "@/types";

const { mockFormatScheduleTooltip } = vi.hoisted(() => ({
  mockFormatScheduleTooltip: vi.fn(),
}));

vi.mock("@/utils/scheduleUtils", () => ({
  formatScheduleTooltip: mockFormatScheduleTooltip,
}));

// configStore mock，timezoneOffset 使用 ref 以便測試響應性
const mockTimezoneOffsetRef = ref(8);
vi.mock("@/stores/configStore", () => ({
  useConfigStore: () => ({
    get timezoneOffset() {
      return mockTimezoneOffsetRef.value;
    },
  }),
}));

const makeSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  frequency: "every-day",
  second: 0,
  intervalMinute: 0,
  intervalHour: 0,
  hour: 9,
  minute: 0,
  weekdays: [],
  enabled: true,
  lastTriggeredAt: null,
  ...overrides,
});

describe("usePodSchedule", () => {
  const podId = ref("pod-1");

  let mockPodStore: {
    setScheduleWithBackend: ReturnType<typeof vi.fn>;
    isScheduleFiredAnimating: ReturnType<typeof vi.fn>;
    clearScheduleFiredAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTimezoneOffsetRef.value = 8;

    mockPodStore = {
      setScheduleWithBackend: vi.fn().mockResolvedValue(null),
      isScheduleFiredAnimating: vi.fn().mockReturnValue(false),
      clearScheduleFiredAnimation: vi.fn(),
    };
  });

  function buildComposable(schedule: Schedule | null | undefined = null) {
    const getPodSchedule = vi.fn(() => schedule);
    return {
      ...usePodSchedule(podId, getPodSchedule, {
        podStore: mockPodStore as Parameters<
          typeof usePodSchedule
        >[2]["podStore"],
      }),
      getPodSchedule,
    };
  }

  describe("hasSchedule", () => {
    it("schedule 為 null 時應回傳 false", () => {
      const { hasSchedule } = buildComposable(null);
      expect(hasSchedule.value).toBe(false);
    });

    it("schedule 為 undefined 時應回傳 false", () => {
      const { hasSchedule } = buildComposable(undefined);
      expect(hasSchedule.value).toBe(false);
    });

    it("schedule 有值時應回傳 true", () => {
      const { hasSchedule } = buildComposable(makeSchedule());
      expect(hasSchedule.value).toBe(true);
    });
  });

  describe("scheduleEnabled", () => {
    it("schedule 為 null 時應回傳 false", () => {
      const { scheduleEnabled } = buildComposable(null);
      expect(scheduleEnabled.value).toBe(false);
    });

    it("schedule.enabled 為 false 時應回傳 false", () => {
      const { scheduleEnabled } = buildComposable(
        makeSchedule({ enabled: false }),
      );
      expect(scheduleEnabled.value).toBe(false);
    });

    it("schedule.enabled 為 true 時應回傳 true", () => {
      const { scheduleEnabled } = buildComposable(
        makeSchedule({ enabled: true }),
      );
      expect(scheduleEnabled.value).toBe(true);
    });
  });

  describe("scheduleTooltip", () => {
    it("schedule 為 null 時應回傳空字串", () => {
      const { scheduleTooltip } = buildComposable(null);
      expect(scheduleTooltip.value).toBe("");
    });

    it("schedule 有值時應呼叫 formatScheduleTooltip 並回傳結果", () => {
      const schedule = makeSchedule();
      mockFormatScheduleTooltip.mockReturnValue("每天 09:00");

      const { scheduleTooltip } = buildComposable(schedule);
      expect(scheduleTooltip.value).toBe("每天 09:00");
      expect(mockFormatScheduleTooltip).toHaveBeenCalledWith(
        schedule,
        expect.any(Number),
      );
    });

    it("scheduleTooltip 應從 configStore 取得 timezoneOffset 並傳給 formatScheduleTooltip", () => {
      mockTimezoneOffsetRef.value = 9;
      const schedule = makeSchedule();
      mockFormatScheduleTooltip.mockReturnValue("每天 09:00");

      const { scheduleTooltip } = buildComposable(schedule);
      void scheduleTooltip.value;

      expect(mockFormatScheduleTooltip).toHaveBeenCalledWith(schedule, 9);
    });

    it("configStore 的 timezoneOffset 變更時，scheduleTooltip 應即時更新", () => {
      mockTimezoneOffsetRef.value = 8;
      const schedule = makeSchedule();
      mockFormatScheduleTooltip.mockReturnValue("每天 09:00");

      const { scheduleTooltip } = buildComposable(schedule);
      void scheduleTooltip.value;

      mockTimezoneOffsetRef.value = -5;
      void scheduleTooltip.value;

      // 第二次呼叫時應使用更新後的 timezoneOffset
      const calls = mockFormatScheduleTooltip.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[1]).toBe(-5);
    });
  });

  describe("isScheduleFiredAnimating", () => {
    it("podStore.isScheduleFiredAnimating 回傳 false 時應為 false", () => {
      mockPodStore.isScheduleFiredAnimating.mockReturnValue(false);
      const { isScheduleFiredAnimating } = buildComposable();
      expect(isScheduleFiredAnimating.value).toBe(false);
    });

    it("podStore.isScheduleFiredAnimating 回傳 true 時應為 true", () => {
      mockPodStore.isScheduleFiredAnimating.mockReturnValue(true);
      const { isScheduleFiredAnimating } = buildComposable();
      expect(isScheduleFiredAnimating.value).toBe(true);
    });

    it("應以正確的 podId 呼叫 isScheduleFiredAnimating", () => {
      buildComposable();
      // 存取 computed 以觸發求值
      const { isScheduleFiredAnimating } = buildComposable();
      void isScheduleFiredAnimating.value;
      expect(mockPodStore.isScheduleFiredAnimating).toHaveBeenCalledWith(
        "pod-1",
      );
    });
  });

  describe("handleOpenScheduleModal", () => {
    it("呼叫後 showScheduleModal 應變為 true", () => {
      const { showScheduleModal, handleOpenScheduleModal } = buildComposable();
      expect(showScheduleModal.value).toBe(false);
      handleOpenScheduleModal();
      expect(showScheduleModal.value).toBe(true);
    });
  });

  describe("handleScheduleConfirm", () => {
    it("應以正確的 podId 和 schedule 呼叫 setScheduleWithBackend", async () => {
      const { handleScheduleConfirm } = buildComposable();
      const schedule = makeSchedule();

      await handleScheduleConfirm(schedule);

      expect(mockPodStore.setScheduleWithBackend).toHaveBeenCalledWith(
        "pod-1",
        schedule,
      );
    });

    it("成功後應將 showScheduleModal 設為 false", async () => {
      const {
        showScheduleModal,
        handleOpenScheduleModal,
        handleScheduleConfirm,
      } = buildComposable();
      handleOpenScheduleModal();
      expect(showScheduleModal.value).toBe(true);

      await handleScheduleConfirm(makeSchedule());

      expect(showScheduleModal.value).toBe(false);
    });
  });

  describe("handleScheduleDelete", () => {
    it("應以 null 呼叫 setScheduleWithBackend", async () => {
      const { handleScheduleDelete } = buildComposable(makeSchedule());

      await handleScheduleDelete();

      expect(mockPodStore.setScheduleWithBackend).toHaveBeenCalledWith(
        "pod-1",
        null,
      );
    });

    it("成功後應將 showScheduleModal 設為 false", async () => {
      const {
        showScheduleModal,
        handleOpenScheduleModal,
        handleScheduleDelete,
      } = buildComposable(makeSchedule());
      handleOpenScheduleModal();
      expect(showScheduleModal.value).toBe(true);

      await handleScheduleDelete();

      expect(showScheduleModal.value).toBe(false);
    });
  });

  describe("handleScheduleToggle", () => {
    it("schedule 不存在時應直接 return，不呼叫 setScheduleWithBackend", async () => {
      const { handleScheduleToggle } = buildComposable(null);

      await handleScheduleToggle();

      expect(mockPodStore.setScheduleWithBackend).not.toHaveBeenCalled();
    });

    it("schedule.enabled 為 true 時應將 enabled 設為 false", async () => {
      const schedule = makeSchedule({ enabled: true });
      const { handleScheduleToggle } = buildComposable(schedule);

      await handleScheduleToggle();

      expect(mockPodStore.setScheduleWithBackend).toHaveBeenCalledWith(
        "pod-1",
        expect.objectContaining({ enabled: false }),
      );
    });

    it("schedule.enabled 為 false 時應將 enabled 設為 true", async () => {
      const schedule = makeSchedule({ enabled: false });
      const { handleScheduleToggle } = buildComposable(schedule);

      await handleScheduleToggle();

      expect(mockPodStore.setScheduleWithBackend).toHaveBeenCalledWith(
        "pod-1",
        expect.objectContaining({ enabled: true }),
      );
    });

    it("應保留 schedule 的其他欄位不變", async () => {
      const schedule = makeSchedule({ enabled: true, hour: 15, minute: 30 });
      const { handleScheduleToggle } = buildComposable(schedule);

      await handleScheduleToggle();

      expect(mockPodStore.setScheduleWithBackend).toHaveBeenCalledWith(
        "pod-1",
        expect.objectContaining({ hour: 15, minute: 30, enabled: false }),
      );
    });
  });

  describe("handleClearScheduleFiredAnimation", () => {
    it("應以正確的 podId 呼叫 clearScheduleFiredAnimation", () => {
      const { handleClearScheduleFiredAnimation } = buildComposable();

      handleClearScheduleFiredAnimation();

      expect(mockPodStore.clearScheduleFiredAnimation).toHaveBeenCalledWith(
        "pod-1",
      );
    });
  });
});
