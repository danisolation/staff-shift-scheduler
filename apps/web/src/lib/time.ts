/**
 * The single shared time utility (AGENTS.md domain rule): the domain stores
 * and computes minutes-since-week-start — day 0–6 (0 = Monday) plus
 * minute-of-day 0–1440 — and ONLY this file turns those into display
 * strings (and back, for form inputs). Components never format times
 * themselves.
 *
 * Pure functions, unit-tested with hand-computed expectations.
 */

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** "Monday" for day 0 … "Sunday" for day 6. Throws on any other input. */
export function dayName(day: number): string {
  const name = DAY_NAMES[day];
  if (name === undefined) {
    throw new RangeError(`Invalid day index: ${day} (expected 0–6)`);
  }
  return name;
}

/** 480 → "08:00", 1440 → "24:00". Throws outside 0–1440. */
export function formatMinutesOfDay(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new RangeError(`Invalid minute of day: ${minute} (expected 0–1440)`);
  }
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Inverse of formatMinutesOfDay: "08:00" → 480, "24:00" → 1440. Throws on anything else. */
export function parseMinutesOfDay(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    throw new RangeError(`Invalid time of day: "${value}" (expected "HH:MM")`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const total = hours * 60 + minutes;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || total > 1440 || minutes > 59) {
    throw new RangeError(`Invalid time of day: "${value}" (expected "HH:MM")`);
  }
  return total;
}

/** "08:00–12:00" — the display label for a shift's time window. */
export function formatShiftWindow(shift: { startMinute: number; endMinute: number }): string {
  return `${formatMinutesOfDay(shift.startMinute)}–${formatMinutesOfDay(shift.endMinute)}`;
}

/**
 * 2400 → "40 h" — for weekly contract caps, which are minute amounts but
 * read as hours. Fractional minutes round to 2 decimals.
 */
export function formatMinutesAsWeeklyHours(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new RangeError(`Invalid minute amount: ${minutes} (expected ≥ 1)`);
  }
  return `${Number((minutes / 60).toFixed(2))} h`;
}
