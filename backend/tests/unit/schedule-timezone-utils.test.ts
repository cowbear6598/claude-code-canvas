import {
  toOffsettedParts,
  isSameDayWithOffset,
} from "../../src/utils/timezoneUtils.js";

describe("toOffsettedParts", () => {
  it("offset=8 時 UTC 04:00 轉換為 hours=12, minutes=0, seconds=0", () => {
    const date = new Date("2026-03-20T04:00:00Z");
    const parts = toOffsettedParts(date, 8);

    expect(parts.hours).toBe(12);
    expect(parts.minutes).toBe(0);
    expect(parts.seconds).toBe(0);
    expect(parts.date).toBe(20);
  });

  it("offset=8 時 UTC 20:00 轉換為隔日 hours=4", () => {
    const date = new Date("2026-03-20T20:00:00Z");
    const parts = toOffsettedParts(date, 8);

    expect(parts.hours).toBe(4);
    expect(parts.date).toBe(21);
  });

  it("offset=-5 時 UTC 15:00 轉換為 hours=10", () => {
    const date = new Date("2026-03-20T15:00:00Z");
    const parts = toOffsettedParts(date, -5);

    expect(parts.hours).toBe(10);
    expect(parts.minutes).toBe(0);
    expect(parts.date).toBe(20);
  });

  it("offset=8 時 UTC 23:30 轉換為隔日 hours=7 minutes=30", () => {
    const date = new Date("2026-03-20T23:30:00Z");
    const parts = toOffsettedParts(date, 8);

    expect(parts.hours).toBe(7);
    expect(parts.minutes).toBe(30);
    expect(parts.date).toBe(21);
  });

  it("offset=0 時等同 UTC", () => {
    const date = new Date("2026-03-20T15:30:45Z");
    const parts = toOffsettedParts(date, 0);

    expect(parts.hours).toBe(15);
    expect(parts.minutes).toBe(30);
    expect(parts.seconds).toBe(45);
  });

  it("offset=8 時正確回傳 day（星期幾）", () => {
    // 2026-03-22T16:00:00Z 是 UTC 週日，加 8 小時後為 2026-03-23T00:00:00+08 即週一
    const date = new Date("2026-03-22T16:00:00Z");
    const parts = toOffsettedParts(date, 8);

    expect(parts.day).toBe(1); // 週一
  });
});

describe("isSameDayWithOffset", () => {
  it("兩個 UTC 時間在 offset=8 下屬於同一天回傳 true", () => {
    const date1 = new Date("2026-03-20T00:00:00Z"); // 台北 08:00
    const date2 = new Date("2026-03-20T10:00:00Z"); // 台北 18:00

    expect(isSameDayWithOffset(date1, date2, 8)).toBe(true);
  });

  it("兩個 UTC 時間在 offset=8 下跨日回傳 false", () => {
    const date1 = new Date("2026-03-20T10:00:00Z"); // 台北 3/20 18:00
    const date2 = new Date("2026-03-20T20:00:00Z"); // 台北 3/21 04:00

    expect(isSameDayWithOffset(date1, date2, 8)).toBe(false);
  });

  it("UTC 同一天但在 offset=8 下已跨日回傳 false", () => {
    const date1 = new Date("2026-03-20T15:00:00Z"); // 台北 3/20 23:00
    const date2 = new Date("2026-03-20T16:00:00Z"); // 台北 3/21 00:00

    expect(isSameDayWithOffset(date1, date2, 8)).toBe(false);
  });
});
