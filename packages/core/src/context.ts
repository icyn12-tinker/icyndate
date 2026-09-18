/**
 * The one call the product promises: a date + a region → everything we know about that day.
 */
import { type DateInput, toCivil, iso, weekday, dayNumber } from "./input";
import { solarToLunar, type LunarInfo, MIN_YEAR, MAX_YEAR } from "./lunar";
import { solarTermAt, solarTermOnDay, type SolarTerm } from "./solar-terms";
import { civilDayBounds } from "./tz";
import { dayInfo, regionTz, type DayInfo, type Unavailable } from "./holidays";

export interface ContextOptions {
  region?: string;            // default "CN"
  /** Zone used to decide which civil day a solar term falls on: IANA id or fixed offset (minutes).
   *  Default: the region's own time zone (DST-aware), falling back to +08:00. */
  tz?: string | number;
  include?: ("civil" | "workday" | "lunar" | "solarTerm")[];
}

export interface TermBrief { index: number; name: { zh: string; en: string }; at: string }
export interface DateContext {
  date: string;
  region: string;
  civil: { weekday: number; isoWeek: number; isoWeekYear: number; dayOfYear: number; leapYear: boolean };
  workday?: DayInfo | Unavailable;
  lunar?: LunarInfo | { available: false; reason: string };
  solarTerm?: { onThisDay: TermBrief | null; current: TermBrief; next: TermBrief; tz: string | number };
}

const ALL: NonNullable<ContextOptions["include"]> = ["civil", "workday", "lunar", "solarTerm"];

export function dateContext(input: DateInput, opts: ContextOptions = {}): DateContext {
  const civil = toCivil(input);
  const region = opts.region ?? "CN";
  const tz: string | number = opts.tz ?? regionTz(region) ?? 480;
  const include = new Set(opts.include ?? ALL);
  const date = iso(civil);
  const out: DateContext = { date, region, civil: civilInfo(civil) };

  if (include.has("workday")) out.workday = dayInfo(civil, region);
  if (include.has("lunar")) {
    try { out.lunar = solarToLunar(civil); }
    catch (e) { out.lunar = { available: false, reason: (e as Error).message }; }
  }
  if (include.has("solarTerm") && civil.year >= MIN_YEAR && civil.year <= MAX_YEAR) {
    // instant at local noon of the civil day, so `current` is the term in effect during that day
    const [dayStart, dayEnd] = civilDayBounds(civil, tz);
    const { current, next } = solarTermAt(new Date((dayStart + dayEnd) / 2));
    const on = solarTermOnDay(civil, tz);
    out.solarTerm = { onThisDay: on ? brief(on) : null, current: brief(current), next: brief(next), tz };
  }
  return out;
}

function brief(t: SolarTerm): TermBrief { return { index: t.index, name: { zh: t.name.zh, en: t.name.en }, at: t.at.toISOString() }; }

function civilInfo(c: { year: number; month: number; day: number }) {
  const wd = weekday(c);
  const leapYear = (c.year % 4 === 0 && c.year % 100 !== 0) || c.year % 400 === 0;
  const dayOfYear = dayNumber(c) - dayNumber({ year: c.year, month: 1, day: 1 }) + 1;
  // ISO week: Thursday-based
  const isoWd = wd === 0 ? 7 : wd;
  const thursday = dayNumber(c) - isoWd + 4;
  const thuDate = new Date(thursday * 86_400_000);
  const isoWeekYear = thuDate.getUTCFullYear();
  const jan1 = dayNumber({ year: isoWeekYear, month: 1, day: 1 });
  const isoWeek = Math.floor((thursday - jan1) / 7) + 1;
  return { weekday: wd, isoWeek, isoWeekYear, dayOfYear, leapYear };
}
