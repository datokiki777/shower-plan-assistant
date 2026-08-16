import { describe, expect, it } from "vitest";
import { addDays, diffDays, usedInWindow, maxDeparture, earliestReturn, currentPeriodInfo, normalizedStays } from "./domain";
import type { Stay } from "./types";

function stay(entryDate: string, exitDate: string | null, id = "s1", workerId = "w1"): Stay {
  return { id, workerId, entryDate, exitDate, createdAt: entryDate, updatedAt: entryDate };
}

describe("addDays / diffDays (whole-day UTC arithmetic)", () => {
  it("crosses a short month (Feb 2026, non-leap) correctly", () => {
    // 15 Jan + 89 days should land in mid-April, not be thrown off by Feb having 28 days.
    expect(addDays("2026-01-15", 89)).toBe("2026-04-14");
  });

  it("crosses a leap-year February correctly", () => {
    expect(addDays("2028-02-01", 28)).toBe("2028-02-29"); // 2028 is a leap year
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("diffDays is symmetric and zero for the same date", () => {
    expect(diffDays("2026-05-01", "2026-05-01")).toBe(0);
    expect(diffDays("2026-05-01", "2026-05-10")).toBe(9);
    expect(diffDays("2026-05-10", "2026-05-01")).toBe(-9);
  });
});

describe("usedInWindow", () => {
  it("counts a single ongoing stay correctly within the 180-day window", () => {
    const intervals = normalizedStays([stay("2026-01-01", "2026-01-10")]);
    expect(usedInWindow("2026-01-10", intervals)).toBe(10);
  });

  it("does not double count overlapping stays", () => {
    const intervals = normalizedStays([stay("2026-01-01", "2026-01-10", "s1"), stay("2026-01-05", "2026-01-15", "s2")]);
    expect(usedInWindow("2026-01-15", intervals)).toBe(15); // union of [1..10] and [5..15] = 1..15 = 15 days
  });
});

describe("maxDeparture (the core 90-day cap)", () => {
  it("caps a fresh stay at exactly 90 days including the entry day", () => {
    const entry = stay("2026-01-15", null);
    const max = maxDeparture([entry], entry);
    // 90 days total means entry day + 89 more days.
    expect(diffDays("2026-01-15", max)).toBe(89);
    expect(max).toBe(addDays("2026-01-15", 89));
  });

  it("matches the exact figure verified in the live app: 15 Jan entry -> 14 Apr max departure", () => {
    const entry = stay("2026-01-15", null);
    expect(maxDeparture([entry], entry)).toBe("2026-04-14");
  });

  it("a prior stay in the same 180-day window reduces the allowed days on a new stay", () => {
    const priorStay = stay("2026-01-01", "2026-01-30", "prior"); // 30 days used
    const newStay = stay("2026-02-01", null, "new");
    const max = maxDeparture([priorStay, newStay], newStay);
    // 90 - 30 = 60 days available on the new stay (entry day counts as day 1).
    expect(diffDays("2026-02-01", max)).toBe(59);
  });
});

describe("earliestReturn", () => {
  it("allows return the day after the 90-day rolling window fully clears (matches V1's exact algorithm)", () => {
    const entry = stay("2026-01-15", null);
    const maxExit = maxDeparture([entry], entry); // 2026-04-14, a full 90-day stay
    const completed = { ...entry, exitDate: maxExit };
    const back = earliestReturn([completed], maxExit);
    // The algorithm starts probing at exit+91 and returns the first day the
    // 180-day window (looking back from that day) has <=90 used days. For a
    // full 90-day stay this is exit+91, not a naive 180-90=90 - verified
    // against the real, already-shipped V1 implementation this was ported
    // from (js/periods.js), not re-derived independently.
    expect(diffDays(maxExit, back)).toBe(91);
  });
});

describe("currentPeriodInfo", () => {
  it("reports inside:true with correct elapsed/remaining for an open stay", () => {
    const s = stay("2026-01-15", null);
    const info = currentPeriodInfo([s]);
    expect(info.inside).toBe(true);
    expect(info.active?.id).toBe(s.id);
    expect(info.maxDepartureDate).toBe("2026-04-14");
  });

  it("reports inside:false with last stay info for a worker with only completed stays", () => {
    const s = stay("2026-01-01", "2026-01-10");
    const info = currentPeriodInfo([s]);
    expect(info.inside).toBe(false);
    expect(info.last?.id).toBe(s.id);
    expect(info.backDate).not.toBeNull();
  });

  it("a worker with zero stays is outside with 90 unused days and no dates", () => {
    const info = currentPeriodInfo([]);
    expect(info.inside).toBe(false);
    expect(info.last).toBeNull();
    expect(info.maxDepartureDate).toBeNull();
    expect(info.unusedDays).toBe(90);
  });
});
