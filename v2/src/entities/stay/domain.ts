import type { Stay } from "./types";
import { todayDateOnly } from "@/shared/lib/date";

/**
 * Ported carefully from V1 (js/periods.js) - the date math itself is
 * UNCHANGED: whole-day UTC arithmetic via Date.UTC/getTime, never calendar-
 * month math. Verified against real short-month cases in the original app.
 * The only change is the data shape: V1 read `worker.stays[]` (nested);
 * these functions take a plain `Stay[]` (already normalized/queryable in
 * V2 - see DATA_MODEL.md §6), so they don't depend on React/Dexie/Zustand.
 */

const DAY_MS = 86400000;

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, n: number): string {
  return toDateOnly(new Date(parseDateOnly(value).getTime() + n * DAY_MS));
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDateOnly(b).getTime() - parseDateOnly(a).getTime()) / DAY_MS);
}

export interface NormalizedInterval {
  entry: string;
  exit: string; // resolved - never null (open stays are closed at "today" or at a cap for what-if calculations)
}

/** All of a worker's stays as closed intervals, treating a still-open stay
 * (exitDate: null) as running through today. `excludeStayId` lets
 * maxDeparture ask "what if this stay's exit were X" without double-
 * counting the stay itself. */
export function normalizedStays(stays: Stay[], excludeStayId: string | null = null): NormalizedInterval[] {
  return stays
    .filter((s) => s.id !== excludeStayId)
    .map((s) => ({ entry: s.entryDate, exit: s.exitDate ?? todayDateOnly() }));
}

function isPresent(date: string, intervals: NormalizedInterval[]): boolean {
  return intervals.some((s) => date >= s.entry && date <= s.exit);
}

/** Days present within the 180-day rolling window ending on `endDate` (inclusive). */
export function usedInWindow(endDate: string, intervals: NormalizedInterval[]): number {
  let used = 0;
  for (let i = 0; i < 180; i++) {
    if (isPresent(addDays(endDate, -i), intervals)) used++;
  }
  return used;
}

/** The latest date `stay` could end without the worker exceeding 90 days
 * used in any 180-day window. */
export function maxDeparture(allStays: Stay[], stay: Stay): string {
  const historical = normalizedStays(allStays, stay.id);
  let lastAllowed = addDays(stay.entryDate, -1);
  for (let i = 0; i < 370; i++) {
    const candidate = addDays(stay.entryDate, i);
    const proposed = [...historical, { entry: stay.entryDate, exit: candidate }];
    if (i >= 90 || usedInWindow(candidate, proposed) > 90) break;
    lastAllowed = candidate;
  }
  return lastAllowed;
}

/** The earliest date the worker could re-enter after leaving on `exitDate`
 * without immediately exceeding the 90/180 rule. */
export function earliestReturn(allStays: Stay[], exitDate: string): string {
  const intervals = normalizedStays(allStays).map((s) => (s.exit > exitDate ? { ...s, exit: exitDate } : s));
  const candidateStart = addDays(exitDate, 91);
  for (let i = 0; i < 370; i++) {
    const day = addDays(candidateStart, i);
    if (usedInWindow(day, [...intervals, { entry: day, exit: day }]) <= 90) return day;
  }
  return candidateStart;
}

export function activeStay(stays: Stay[]): Stay | undefined {
  return stays.find((s) => s.exitDate === null);
}

export interface WorkerPeriodInfo {
  inside: boolean;
  active: Stay | null;
  last: Stay | null;
  /** Max departure date if inside; earliest-return date if outside and
   * there's a most-recent completed stay. */
  maxDepartureDate: string | null;
  backDate: string | null;
  /** Days used in the current/most-recent stay's own span (not the rolling window). */
  elapsedDays: number;
  /** Days remaining before hitting the 90-day cap, relative to today, if inside. */
  remainingDays: number | null;
  /** Days of the 90 not yet used, shown for both inside and outside workers. */
  unusedDays: number;
}

/** The single function the UI needs per worker - mirrors V1's `currentInfo`. */
export function currentPeriodInfo(stays: Stay[]): WorkerPeriodInfo {
  const today = todayDateOnly();
  const active = activeStay(stays);

  if (active) {
    const max = maxDeparture(stays, active);
    const elapsed = Math.max(0, diffDays(active.entryDate, today) + 1);
    const remaining = Math.max(0, diffDays(today, max));
    return {
      inside: true,
      active,
      last: null,
      maxDepartureDate: max,
      backDate: earliestReturn(stays, max),
      elapsedDays: elapsed,
      remainingDays: remaining,
      unusedDays: remaining
    };
  }

  const completed = [...stays].filter((s) => s.exitDate !== null).sort((a, b) => (b.exitDate as string).localeCompare(a.exitDate as string));
  const last = completed[0] ?? null;
  if (!last) {
    return { inside: false, active: null, last: null, maxDepartureDate: null, backDate: null, elapsedDays: 0, remainingDays: null, unusedDays: 90 };
  }
  const lastMax = maxDeparture(stays, last);
  const unused = last.exitDate && last.exitDate <= lastMax ? Math.max(0, diffDays(last.exitDate, lastMax)) : 0;
  return {
    inside: false,
    active: null,
    last,
    maxDepartureDate: lastMax,
    backDate: earliestReturn(stays, last.exitDate as string),
    elapsedDays: 0,
    remainingDays: null,
    unusedDays: unused
  };
}
