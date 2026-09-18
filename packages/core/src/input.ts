/**
 * One canonical way to say "a civil date" across the whole package.
 *
 * Accepted forms:
 *   "2026-02-17"                 ISO date string (preferred)
 *   [2026, 2, 17]                tuple
 *   { year: 2026, month: 2, day: 17 }
 *   new Date(...)                the date's **UTC** calendar fields are used. If you hold a local
 *                                Date, pass an ISO string or use `civilFromDate(date, utcOffsetMinutes)`.
 */
export type DateInput = string | [number, number, number] | { year: number; month: number; day: number } | Date;

export interface Civil { year: number; month: number; day: number }

export function toCivil(input: DateInput): Civil {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
    if (!m) throw new TypeError(`Expected ISO date "YYYY-MM-DD", got "${input}"`);
    return check({ year: +m[1], month: +m[2], day: +m[3] });
  }
  if (Array.isArray(input)) return check({ year: input[0], month: input[1], day: input[2] });
  if (input instanceof Date) {
    if (isNaN(input.getTime())) throw new TypeError("Invalid Date");
    return { year: input.getUTCFullYear(), month: input.getUTCMonth() + 1, day: input.getUTCDate() };
  }
  return check({ year: input.year, month: input.month, day: input.day });
}

/** Civil date of an instant as observed at a fixed UTC offset (minutes). */
export function civilFromDate(date: Date, utcOffsetMinutes: number): Civil {
  return toCivil(new Date(date.getTime() + utcOffsetMinutes * 60_000));
}

function check(c: Civil): Civil {
  const { year, month, day } = c;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) throw new TypeError("Date fields must be integers");
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day)
    throw new RangeError(`Invalid civil date ${year}-${month}-${day}`);
  return c;
}

export function iso(c: Civil): string {
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

export function addDays(c: Civil, n: number): Civil {
  return toCivil(new Date(Date.UTC(c.year, c.month - 1, c.day + n)));
}

/** Days since Unix epoch, DST-proof. */
export function dayNumber(c: Civil): number {
  return Math.floor(Date.UTC(c.year, c.month - 1, c.day) / 86_400_000);
}

/** JS weekday, 0 = Sunday. */
export function weekday(c: Civil): number {
  return ((dayNumber(c) + 4) % 7 + 7) % 7;
}

