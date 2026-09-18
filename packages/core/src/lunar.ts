/**
 * Chinese lunisolar calendar, 1900-02-09 (庚子 正月初一) .. 2100-12-31.
 *
 * Data: a per-year table (new-year solar date, leap month, month lengths) derived from
 * two independent reference implementations and checked day-by-day in `fixtures/`.
 * No astronomy is computed at runtime; this keeps the package tiny and deterministic.
 */
import table from "./data/lunar-table.json";
import { type DateInput, toCivil, dayNumber as dn } from "./input";

export interface LunarDate {
  year: number;      // lunar year, boundary = Chinese New Year
  month: number;     // 1..12
  day: number;       // 1..30
  leap: boolean;     // true if this is the leap (閏) month
}

export interface LunarInfo extends LunarDate {
  yearGanZhi: string;   // e.g. 丙午
  dayGanZhi: string;    // e.g. 甲辰
  zodiac: string;       // 马
  monthName: string;    // 正月 / 閏五月 ...
  dayName: string;      // 初一 / 十五 / 廿三 / 三十
  isLeapYear: boolean;  // lunar year contains a leap month
  /** 29 or 30 — or `null` for the final month of lunar 2100, which the table truncates (see MAX_DATE). */
  monthLength: number | null;
}

type YearRow = [newYear: string, leapMonth: number, monthLengths: number[]];
const TABLE = table as unknown as Record<string, YearRow>;

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
/** Last solar date in the table. It falls inside lunar 2100 腊月, so that month's length is unknown. */
export const MAX_DATE = "2100-12-31";

/**
 * The table stops at MAX_DATE, part-way through the last lunar month, so that month's recorded
 * length is a truncation artefact, not its real length. We report `null` rather than a wrong number.
 */
function isTruncatedMonth(lunarYear: number, idx: number): boolean {
  return lunarYear === MAX_YEAR && idx === TABLE[String(MAX_YEAR)][2].length - 1;
}

const GAN = "甲乙丙丁戊己庚辛壬癸";
const ZHI = "子丑寅卯辰巳午未申酉戌亥";
const ZODIAC = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
const MONTH_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const DAY_NAMES = (() => {
  const tens = ["初", "十", "廿", "三"];
  const ones = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const out: string[] = [];
  for (let d = 1; d <= 30; d++) {
    if (d === 10) out.push("初十");
    else if (d === 20) out.push("二十");
    else if (d === 30) out.push("三十");
    else out.push(tens[Math.floor((d - 1) / 10)] + ones[(d - 1) % 10]);
  }
  return out;
})();

const MS_PER_DAY = 86_400_000;

function dayNumber(y: number, m: number, d: number): number { return dn({ year: y, month: m, day: d }); }
function fromDayNumber(n: number): [number, number, number] {
  const dt = new Date(n * MS_PER_DAY);
  return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
}
function parseISO(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return dayNumber(y, m, d);
}

// Precompute new-year day numbers for fast lookup.
const NEW_YEAR_DAY: number[] = [];
for (let y = MIN_YEAR; y <= MAX_YEAR; y++) NEW_YEAR_DAY.push(parseISO(TABLE[String(y)][0]));

/** Position of (month, leap) within the year's month-length array, or -1. */
function monthIndex(row: YearRow, month: number, leap: boolean): number {
  const leapMonth = row[1];
  if (leap && leapMonth !== month) return -1;
  return leap ? month : month - (leapMonth && month > leapMonth ? 0 : 1);
}
function indexToMonth(row: YearRow, idx: number): [month: number, leap: boolean] {
  const leapMonth = row[1];
  if (!leapMonth || idx < leapMonth) return [idx + 1, false];
  if (idx === leapMonth) return [leapMonth, true];
  return [idx, false];
}

export function yearGanZhi(lunarYear: number): string {
  const i = ((lunarYear - 4) % 60 + 60) % 60;
  return GAN[i % 10] + ZHI[i % 12];
}
export function zodiac(lunarYear: number): string {
  return ZODIAC[((lunarYear - 4) % 12 + 12) % 12];
}
/** 1900-01-31 is 甲辰 (index 40 in the 60-cycle). */
export function dayGanZhi(input: DateInput): string {
  const { year: y, month: m, day: d } = toCivil(input);
  const i = ((dayNumber(y, m, d) - dayNumber(1900, 1, 31) + 40) % 60 + 60) % 60;
  return GAN[i % 10] + ZHI[i % 12];
}

export function solarToLunar(input: DateInput): LunarInfo {
  const { year: y, month: m, day: d } = toCivil(input);
  const n = dayNumber(y, m, d);
  if (n < NEW_YEAR_DAY[0]) throw new RangeError(`Date before ${TABLE[String(MIN_YEAR)][0]} is out of range`);
  if (y > MAX_YEAR) throw new RangeError(`Date after ${MAX_YEAR}-12-31 is out of range`);

  // Binary search the last new year <= n.
  let lo = 0, hi = NEW_YEAR_DAY.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (NEW_YEAR_DAY[mid] <= n) lo = mid; else hi = mid - 1;
  }
  const lunarYear = MIN_YEAR + lo;
  const row = TABLE[String(lunarYear)];
  let rem = n - NEW_YEAR_DAY[lo];
  let idx = 0;
  while (idx < row[2].length && rem >= row[2][idx]) { rem -= row[2][idx]; idx++; }
  if (idx >= row[2].length) throw new RangeError("Date past end of table");
  const [month, leap] = indexToMonth(row, idx);
  return decorate({ year: lunarYear, month, day: rem + 1, leap }, { year: y, month: m, day: d }, row,
    isTruncatedMonth(lunarYear, idx) ? null : row[2][idx]);
}

export function lunarToSolar(lunar: LunarDate): [number, number, number] {
  const { year, month, day, leap } = lunar;
  if (year < MIN_YEAR || year > MAX_YEAR) throw new RangeError(`Lunar year ${year} out of range`);
  const row = TABLE[String(year)];
  const idx = monthIndex(row, month, leap);
  if (month < 1 || month > 12 || idx < 0) throw new RangeError(`Invalid lunar month ${leap ? "閏" : ""}${month} in ${year}`);
  if (day < 1) throw new RangeError(`Invalid lunar day ${day}`);
  if (day > row[2][idx]) {
    if (isTruncatedMonth(year, idx)) throw new RangeError(`Lunar ${year} month ${month} extends past ${MAX_DATE}, where the table ends; only day 1..${row[2][idx]} is known`);
    throw new RangeError(`Invalid lunar day ${day}: month has ${row[2][idx]} days`);
  }
  let n = NEW_YEAR_DAY[year - MIN_YEAR] + day - 1;
  for (let i = 0; i < idx; i++) n += row[2][i];
  return fromDayNumber(n);
}

export function leapMonthOf(lunarYear: number): number {
  return TABLE[String(lunarYear)]?.[1] ?? 0;
}
export function lunarNewYear(lunarYear: number): [number, number, number] {
  return fromDayNumber(NEW_YEAR_DAY[lunarYear - MIN_YEAR]);
}

function decorate(l: LunarDate, c: { year: number; month: number; day: number }, row: YearRow, monthLength: number | null): LunarInfo {
  return {
    ...l,
    yearGanZhi: yearGanZhi(l.year),
    dayGanZhi: dayGanZhi(c),
    zodiac: zodiac(l.year),
    monthName: (l.leap ? "閏" : "") + MONTH_NAMES[l.month - 1] + "月",
    dayName: DAY_NAMES[l.day - 1],
    isLeapYear: row[1] !== 0,
    monthLength,
  };
}

/* ---------- 12. extras ---------- */

/**
 * Month 干支 by the calendar convention (month branch fixed: 正月 = 寅; stem from the year stem, 五虎遁).
 * A leap month takes the 干支 of the month it follows. The 命理 convention (boundaries at 节) is in the backlog.
 */
export function monthGanZhi(lunarYear: number, lunarMonth: number): string {
  const yearStem = ((lunarYear - 4) % 10 + 10) % 10;
  const stem = (yearStem * 2 + lunarMonth + 1) % 10;
  const branch = (lunarMonth + 1) % 12;
  return GAN[stem] + ZHI[branch];
}

/** Hour 干支 (五鼠遁): hour 0–23 in the local civil day whose day 干支 is given. 23:00 belongs to the next day's 子时 by many conventions; here 23:00–00:59 = 子. */
export function hourGanZhi(dayGZ: string, hour: number): string {
  const dayStem = GAN.indexOf(dayGZ[0]);
  if (dayStem < 0 || hour < 0 || hour > 23) throw new RangeError("hourGanZhi: bad day 干支 or hour");
  const branch = Math.floor(((hour + 1) % 24) / 2);
  const stem = (dayStem * 2 + branch) % 10;
  return GAN[stem] + ZHI[branch];
}

/** Length (29/30) of a lunar month; leap=true for the leap month. Throws if no such month. */
export function lunarMonthLength(lunarYear: number, month: number, leap = false): number {
  const row = TABLE[String(lunarYear)];
  if (!row) throw new RangeError(`Lunar year ${lunarYear} out of range`);
  const idx = monthIndex(row, month, leap);
  if (idx < 0) throw new RangeError(`No ${leap ? "leap " : ""}month ${month} in lunar ${lunarYear}`);
  if (isTruncatedMonth(lunarYear, idx)) throw new RangeError(`Length of lunar ${lunarYear} month ${month} is unknown: the table ends mid-month at ${MAX_DATE}`);
  return row[2][idx];
}

/**
 * Next solar date on which lunar (month, day) occurs, strictly after `from` (or on it, if `inclusive`).
 * Leap months are ignored (birthdays are kept on the regular month). If the month has only 29 days
 * and day is 30, the 29th is used — the customary rule for 三十 birthdays — and `adjusted` is true.
 */
export function nextLunarDate(month: number, day: number, from: DateInput, inclusive = false): { date: string; lunarYear: number; adjusted: boolean } {
  const { year: fy, month: fm, day: fd } = toCivil(from);
  const fromN = dn({ year: fy, month: fm, day: fd });
  const startLunarYear = solarToLunar({ year: fy, month: fm, day: fd }).year;
  for (let ly = startLunarYear; ly <= MAX_YEAR; ly++) {
    let len: number;
    try { len = lunarMonthLength(ly, month, false); }
    catch { continue; }   // month absent, or truncated at the end of the table
    const useDay = Math.min(day, len);
    const [y, m, d] = lunarToSolar({ year: ly, month, day: useDay, leap: false });
    const n = dn({ year: y, month: m, day: d });
    if (n > fromN || (inclusive && n === fromN))
      return { date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, lunarYear: ly, adjusted: useDay !== day };
  }
  throw new RangeError("No occurrence within table range");
}
