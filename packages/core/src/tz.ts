/** Time-zone helpers built on Intl — no tz database shipped, DST handled by the runtime. */
import { type Civil } from "./input";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    } catch { throw new RangeError(`Unknown IANA time zone "${tz}"`); }
    fmtCache.set(tz, f);
  }
  return f;
}

/** UTC offset in minutes of `tz` at `instant` (positive east of Greenwich). */
export function tzOffsetAt(tz: string, instant: Date): number {
  const parts = Object.fromEntries(fmt(tz).formatToParts(instant).filter(p => p.type !== "literal").map(p => [p.type, +p.value]));
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUTC - instant.getTime()) / 60_000);
}

/** UTC instants [start, end) of the civil day in `tz` (IANA id) or at a fixed offset in minutes. */
export function civilDayBounds(c: Civil, tz: string | number): [number, number] {
  if (typeof tz === "number") { const s = Date.UTC(c.year, c.month - 1, c.day) - tz * 60_000; return [s, s + 86_400_000]; }
  const startOf = (y: number, m: number, d: number) => {
    let guess = Date.UTC(y, m - 1, d);
    for (let i = 0; i < 3; i++) guess = Date.UTC(y, m - 1, d) - tzOffsetAt(tz, new Date(guess)) * 60_000; // converge through DST edges
    return guess;
  };
  const next = new Date(Date.UTC(c.year, c.month - 1, c.day + 1));
  return [startOf(c.year, c.month, c.day), startOf(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())];
}

/** Civil date of an instant in `tz`. */
export function civilInTz(instant: Date, tz: string | number): Civil {
  const off = typeof tz === "number" ? tz : tzOffsetAt(tz, instant);
  const d = new Date(instant.getTime() + off * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
