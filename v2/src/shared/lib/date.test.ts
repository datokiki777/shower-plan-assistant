import { describe, expect, it } from "vitest";
import { isDateOnlyString, formatDateOnly, todayDateOnly } from "./date";

describe("date (date-only helpers)", () => {
  it("isDateOnlyString validates strict YYYY-MM-DD shape", () => {
    expect(isDateOnlyString("2026-08-15")).toBe(true);
    expect(isDateOnlyString("2026-8-15")).toBe(false);
    expect(isDateOnlyString("2026-08-15T00:00:00.000Z")).toBe(false);
    expect(isDateOnlyString("")).toBe(false);
  });

  it("formatDateOnly does not shift the date regardless of the local timezone", () => {
    // The classic bug: new Date("2026-01-01") is parsed as UTC midnight, which
    // displays as 31 Dec in any negative-UTC-offset timezone. formatDateOnly
    // must parse as a LOCAL calendar date instead, so this never happens.
    const formatted = formatDateOnly("2026-01-01");
    expect(formatted).toContain("01");
    expect(formatted).not.toContain("31");
  });

  it("formatDateOnly returns an em dash for null/invalid input", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly("not-a-date")).toBe("—");
  });

  it("todayDateOnly returns a valid date-only string", () => {
    expect(isDateOnlyString(todayDateOnly())).toBe(true);
  });
});
