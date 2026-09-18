/**
 * Holidays and workdays per region.
 *
 * Every answer carries a `source` and a `confidence`; nothing is silently guessed:
 *  - official  : government gazette, hand-entered            → confidence "certain"
 *  - baseline  : python-holidays rules, not gazette-checked  → confidence "likely"
 *  - predicted : statutory days from our own rules, for years nobody has published
 *                → holidays "likely"; days near a holiday "uncertain" (调休 may flip them)
 */
import { HOLIDAY_DATA } from "./data/holidays/index";
import { lunarToSolar } from "./lunar";
import { solarTermOnDay } from "./solar-terms";
import { type DateInput, type Civil, toCivil, iso, addDays, weekday, dayNumber } from "./input";

export type Source = "official" | "baseline" | "predicted";
export type Confidence = "certain" | "likely" | "uncertain";
export interface I18nName { en: string; "zh-Hans"?: string; [lang: string]: string | undefined }

/** public = statutory public holiday; federal = US federal; bank = UK bank holiday; substitute = observed/in-lieu day; observance = not a day off */
export type HolidayKind = "public" | "federal" | "bank" | "substitute" | "observance";
export interface HolidayDef { id: string; festival?: string | null; kind?: HolidayKind; name: I18nName; name_fallback?: boolean; days: string[] }
export interface YearSchedule { source: Source; source_ref?: string; holidays: HolidayDef[]; workdays: string[] }
export interface RegionData {
  region: string; name: I18nName; weekend: number[]; tz?: string;
  data_version: string; generated_at: string; verified_until: number | null;
  years: Record<string, YearSchedule>;
  /** Subdivision schedules hold only the holidays *added* on top of the national list. */
  subdivisions?: Record<string, { years: Record<string, YearSchedule> }>;
}
export interface DataMeta { region: string; data_version: string; generated_at: string; verified_until: number | null }

export type DayKind = "workday" | "weekend" | "public_holiday" | "adjusted_workday";
export interface HolidayRef { id: string; festival: string | null; kind: HolidayKind; name: I18nName; dayIndex: number; span: number; scope: "national" | "subdivision" }
export interface DayInfo {
  available: true;
  date: string; region: string; resolvedRegion: string; weekday: number;
  isWorkday: boolean; kind: DayKind;
  holiday?: HolidayRef;          // primary (first listed) holiday on this day
  otherHolidays?: HolidayRef[];  // further holidays that coincide on the same day
  adjusted: boolean;          // 调休 flipped this day's default status
  source: Source; source_ref?: string;
  confidence: Confidence;
  note?: string;
  meta: DataMeta;
}
export interface Unavailable { available: false; date: string; region: string; resolvedRegion?: string; weekday: number; reason: string; meta?: DataMeta }

const REGIONS: Record<string, RegionData> = Object.fromEntries(Object.entries(HOLIDAY_DATA).map(([k, v]) => [k, v as unknown as RegionData]));
const PREDICT_WINDOW_DAYS = 10;

export function registerRegion(data: RegionData): void { REGIONS[canonicalRegion(data.region)] = data; }
/** Top-level regions. */
export function regions(): string[] { return Object.keys(REGIONS); }
/** Region tree: { US: ["US-CA", …], DE: ["DE-BY", …], CN: [] } */
export function regionTree(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(REGIONS).map(([k, v]) => [k, Object.keys(v.subdivisions ?? {}).map(s => `${k}-${s}`)]));
}
/** Time zone (IANA id) a region's calendar is observed in. */
export function regionTz(region: string): string | undefined { return getRegion(resolve(region).parent).tz; }

interface Resolved { parent: string; subdivision?: string; code: string }
/**
 * Canonical form of a region code: trimmed and upper-cased, so "us-ca" and " US-CA " are the same
 * region. Agents and LLM clients do not reliably send the canonical casing, and a case mismatch is
 * not a question worth failing on.
 */
export function canonicalRegion(region: string): string { return region.trim().toUpperCase(); }
/** "us-ca" → { parent: "US", subdivision: "CA", code: "US-CA" }. Unknown subdivisions fall back to the parent with a note. */
function resolve(region: string): Resolved {
  const [parent, sub] = canonicalRegion(region).split("-");
  const r = getRegion(parent);
  if (sub && r.subdivisions?.[sub]) return { parent, subdivision: sub, code: `${parent}-${sub}` };
  return { parent, code: parent };
}
export function regionMeta(region: string): DataMeta {
  const r = getRegion(resolve(region).parent);
  return { region: r.region, data_version: r.data_version, generated_at: r.generated_at, verified_until: r.verified_until };
}
export function coverage(region: string): { years: number[]; official: number[]; baseline: number[]; predictable: boolean; predictedFrom: number | null; weekend: number[]; tz?: string } {
  const r = getRegion(resolve(region).parent);
  const years = Object.keys(r.years).map(Number).sort((a, b) => a - b);
  const floor = predictionFloor(r);
  return {
    years, official: years.filter(y => r.years[y].source === "official"), baseline: years.filter(y => r.years[y].source === "baseline"),
    predictable: floor != null,
    /** First year the predictor covers; years before `years[0]` are never predicted. */
    predictedFrom: floor != null ? floor + 1 : null,
    weekend: r.weekend, tz: r.tz,
  };
}
function getRegion(region: string): RegionData {
  const r = REGIONS[canonicalRegion(region)];
  if (!r) throw new RangeError(`Unknown region ${region}. Known: ${regions().join(", ")}`);
  return r;
}
function subSchedule(region: string, year: number): YearSchedule | null {
  const { parent, subdivision } = resolve(region);
  return subdivision ? getRegion(parent).subdivisions?.[subdivision]?.years[String(year)] ?? null : null;
}

/* ---------- predicted statutory days (CN) ---------- */
function predictCN(year: number): YearSchedule {
  const lunarDay = (month: number, day: number) => { const [y, m, d] = lunarToSolar({ year, month, day, leap: false }); return iso({ year: y, month: m, day: d }); };
  const cny = toCivil(lunarDay(1, 1));
  const springDays = [-1, 0, 1, 2].map(n => iso(addDays(cny, n)));
  let qingming = "";
  for (let d = 4; d <= 6; d++) if (solarTermOnDay([year, 4, d], 480)?.name.zh === "清明") qingming = iso({ year, month: 4, day: d });
  const N = (zh: string, en: string) => ({ "zh-Hans": zh, en });
  return {
    source: "predicted",
    source_ref: "《全国年节及纪念日放假办法》法定假日推算；调休安排未公布",
    holidays: [
      { id: "new-year", festival: "new-year", name: N("元旦", "New Year's Day"), days: [iso({ year, month: 1, day: 1 })] },
      { id: "spring-festival", festival: "lunar-new-year", name: N("春节", "Chinese New Year"), days: springDays },
      { id: "qingming", festival: "qingming", name: N("清明节", "Qingming Festival"), days: [qingming] },
      { id: "labour-day", festival: "labour-day", name: N("劳动节", "Labour Day"), days: [iso({ year, month: 5, day: 1 }), iso({ year, month: 5, day: 2 })] },
      { id: "dragon-boat", festival: "dragon-boat", name: N("端午节", "Dragon Boat Festival"), days: [lunarDay(5, 5)] },
      { id: "mid-autumn", festival: "mid-autumn", name: N("中秋节", "Mid-Autumn Festival"), days: [lunarDay(8, 15)] },
      { id: "national-day", festival: "national-day", name: N("国庆节", "National Day"), days: [1, 2, 3].map(d => iso({ year, month: 10, day: d })) },
    ],
    workdays: [],
  };
}
const PREDICTORS: Record<string, (year: number) => YearSchedule> = { CN: predictCN };

/**
 * Prediction is forward-only: we extrapolate the *current* statutory rules past the last
 * hand-entered year, never backwards across years whose real schedule was published long ago.
 * Extrapolating backwards would invent history — the 2024-revised 《放假办法》 runs 春节 from
 * 除夕 to 初三, 清明/端午/中秋 only became statutory in 2008, and none of it existed before 1949.
 * For a past year we have not entered, the honest answer is "no data", not a guess.
 */
function predictionFloor(r: RegionData): number | null {
  if (!(r.region in PREDICTORS)) return null;
  if (r.verified_until != null) return r.verified_until;
  const entered = Object.keys(r.years).map(Number).filter(Number.isFinite);
  return entered.length ? Math.max(...entered) : null;
}
function canPredict(r: RegionData, year: number): boolean {
  const floor = predictionFloor(r);
  return floor != null && year > floor;
}

/** Schedule for a region-year (national + subdivision extras merged), or null when nothing is known. */
export function schedule(region: string, year: number): YearSchedule | null {
  const { parent } = resolve(region);
  const r = getRegion(parent);
  let base: YearSchedule | null = r.years[String(year)] ?? null;
  if (!base && canPredict(r, year)) {
    const p = PREDICTORS[parent];
    if (p) { try { base = p(year); } catch { base = null; } }   // outside the lunar table range
  }
  if (!base) return null;
  const extra = subSchedule(region, year);
  if (!extra) return base;
  return { ...base, holidays: [...base.holidays, ...extra.holidays.map(h => ({ ...h, id: `${h.id}@${resolve(region).subdivision}` }))] };
}

/* ---------- day queries ---------- */

export function dayInfo(input: DateInput, region: string): DayInfo | Unavailable {
  const civil = toCivil(input);
  const res = resolve(region);
  const r = getRegion(res.parent);
  const s = schedule(region, civil.year);
  const asked = canonicalRegion(region);
  const date = iso(civil), wd = weekday(civil);
  if (!s) {
    const cov = coverage(region);
    const why = cov.predictedFrom != null && civil.year < cov.predictedFrom
      ? `; ${civil.year} predates the entered data and is never predicted (prediction starts at ${cov.predictedFrom})`
      : "";
    return { available: false, date, region: asked, resolvedRegion: res.code, weekday: wd, reason: `No holiday data for ${asked} in ${civil.year} (covered: ${cov.years.join(", ")})${why}`, meta: regionMeta(region) };
  }

  const isWeekend = r.weekend.includes(wd);
  const baseConf: Confidence = s.source === "official" ? "certain" : "likely";
  const base = { available: true as const, date, region: asked, resolvedRegion: res.code, weekday: wd, source: s.source, source_ref: s.source_ref, meta: regionMeta(region),
    ...(res.code !== asked ? { note: `Subdivision ${asked} unknown; using ${res.code}` } : {}) };

  const refs: HolidayRef[] = [];
  for (const h of s.holidays) {
    const i = h.days.indexOf(date);
    if (i >= 0) refs.push({ id: h.id, festival: h.festival ?? null, kind: h.kind ?? "public", name: h.name, dayIndex: i + 1, span: h.days.length, scope: h.id.includes("@") ? "subdivision" : "national" });
  }
  if (refs.length) return { ...base, isWorkday: false, kind: "public_holiday", adjusted: false, confidence: baseConf,
    holiday: refs[0], ...(refs.length > 1 ? { otherHolidays: refs.slice(1) } : {}) };
  if (s.workdays.includes(date)) return { ...base, isWorkday: true, kind: "adjusted_workday", adjusted: true, confidence: baseConf };

  let confidence: Confidence = baseConf, note: string | undefined = (base as { note?: string }).note;
  if (s.source === "predicted" && nearHoliday(s, civil)) {
    confidence = "uncertain";
    note = "Within the usual 调休 window of a statutory holiday; the published schedule may change this day's status.";
  }
  if (isWeekend) return { ...base, isWorkday: false, kind: "weekend", adjusted: false, confidence, note };
  return { ...base, isWorkday: true, kind: "workday", adjusted: false, confidence, note };
}

function nearHoliday(s: YearSchedule, c: Civil): boolean {
  const n = dayNumber(c);
  for (const h of s.holidays) for (const d of h.days) if (Math.abs(dayNumber(toCivil(d)) - n) <= PREDICT_WINDOW_DAYS) return true;
  return false;
}

/** Throws RangeError when the region-year is not covered (see "Error model" in README). */
export function isWorkday(input: DateInput, region: string): boolean {
  const info = dayInfo(input, region);
  if (!info.available) throw new RangeError(info.reason);
  return info.isWorkday;
}

/** All holiday days of a region-year (empty if unknown). */
export function holidays(region: string, year: number): (DayInfo & { holiday: HolidayRef })[] {
  const s = schedule(region, year);
  if (!s) return [];
  const out: (DayInfo & { holiday: HolidayRef })[] = [];
  for (const h of s.holidays) for (const day of h.days) {
    const info = dayInfo(day, region);
    if (info.available && info.holiday) out.push(info as DayInfo & { holiday: HolidayRef });
  }
  return out;
}

/** Inclusive list of workdays between two dates. */
export function workdaysBetween(region: string, from: DateInput, to: DateInput): string[] {
  const out: string[] = [];
  for (let c = toCivil(from), end = dayNumber(toCivil(to)); dayNumber(c) <= end; c = addDays(c, 1)) if (isWorkday(c, region)) out.push(iso(c));
  return out;
}
/** The n-th workday strictly after `from` (n = 1 → next workday). */
export function nextWorkday(region: string, from: DateInput, n = 1): string {
  let c = toCivil(from), count = 0;
  while (count < n) { c = addDays(c, 1); if (isWorkday(c, region)) count++; }
  return iso(c);
}

/** The n-th workday strictly before `from`. */
export function previousWorkday(region: string, from: DateInput, n = 1): string { return addWorkdays(region, from, -n); }
/** Move n workdays (negative = backwards). n = 0 returns `from` unchanged. */
export function addWorkdays(region: string, from: DateInput, n: number): string {
  let c = toCivil(from), count = 0; const step = n < 0 ? -1 : 1;
  while (count < Math.abs(n)) { c = addDays(c, step); if (isWorkday(c, region)) count++; }
  return iso(c);
}
export function workdayCount(region: string, from: DateInput, to: DateInput): number { return workdaysBetween(region, from, to).length; }
/** Holiday days in an inclusive date range (any year), in order. */
export function holidaysBetween(region: string, from: DateInput, to: DateInput): (DayInfo & { holiday: HolidayRef })[] {
  const a = toCivil(from), b = toCivil(to), out = [];
  for (let y = a.year; y <= b.year; y++) for (const h of holidays(region, y)) if (h.date >= iso(a) && h.date <= iso(b)) out.push(h);
  return out;
}
/** True when today is a workday and tomorrow is a public holiday (the "night before" question). */
export function isHolidayEve(input: DateInput, region: string): boolean {
  const c = toCivil(input), today = dayInfo(c, region), tomorrow = dayInfo(addDays(c, 1), region);
  return today.available && today.isWorkday && tomorrow.available && tomorrow.kind === "public_holiday";
}
/** Next run of ≥ minDays consecutive non-workdays from `from` (inclusive). null = none within lookahead; throws if data runs out. */
export function nextLongWeekend(region: string, from: DateInput, minDays = 3, lookaheadDays = 400): { start: string; end: string; days: number; holidays: string[] } | null {
  let c = toCivil(from);
  for (let i = 0; i < lookaheadDays; i++, c = addDays(c, 1)) {
    const info = dayInfo(c, region);
    if (!info.available) throw new RangeError(info.reason);
    if (info.isWorkday) continue;
    let end = c, days = 1; const hol: string[] = info.holiday ? [info.holiday.id] : [];
    for (;;) { const nx = dayInfo(addDays(end, 1), region); if (!nx.available || nx.isWorkday) break; end = addDays(end, 1); days++; if (nx.holiday && !hol.includes(nx.holiday.id)) hol.push(nx.holiday.id); }
    if (days >= minDays) return { start: iso(c), end: iso(end), days, holidays: hol };
    c = end;
  }
  return null;
}

/* ---------- festival queries ---------- */

/** Which regions observe a canonical festival in a given year, with the dates each takes off. */
export function regionsObserving(festival: string, year: number): { region: string; days: string[]; source: Source }[] {
  const out = [];
  for (const region of regions()) {
    const s = getRegion(region).years[String(year)] ?? schedule(region, year);
    if (!s) continue;
    const days = s.holidays.filter(h => h.festival === festival).flatMap(h => h.days).sort();
    if (days.length) out.push({ region, days, source: s.source });
  }
  return out;
}
/** Every canonical festival id present in the data. */
export function festivals(): string[] {
  const set = new Set<string>();
  for (const r of Object.values(REGIONS)) for (const y of Object.values(r.years)) for (const h of y.holidays) if (h.festival) set.add(h.festival);
  return [...set].sort();
}

export function lunarFestivalDate(lunarYear: number, month: number, day: number): string {
  const [y, m, d] = lunarToSolar({ year: lunarYear, month, day, leap: false }); return iso({ year: y, month: m, day: d });
}
