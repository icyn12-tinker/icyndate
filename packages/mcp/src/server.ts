/**
 * @icyn/date-mcp — MCP server (stdio) over @icyn/date.
 * Every tool returns a short human sentence first, then the JSON, so a model can quote either.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import "@icyn/date/regions/all";
import {
  dateContext, describe, dayInfo, holidays, holidaysBetween, workdaysBetween, workdayCount, addWorkdays, nextWorkday,
  nextLongWeekend, isHolidayEve, solarTerms, solarToLunar, lunarToSolar, nextLunarDate, regionsObserving, festivals,
  regions, regionTree, coverage, regionMeta,
} from "@icyn/date";

const INSTRUCTIONS = `Date context for China and 11 other regions: lunar calendar, the 24 solar terms, holidays and workdays.

Every answer this server gives carries its provenance, and you must pass that on to the user — it is
the whole point of this server. Never present a \`predicted\` or \`baseline\` answer as if it were settled fact.

  computed  — lunar dates, 干支, solar terms. Derived from a table verified day-by-day 1900–2100
              against two independent reference implementations. Say it plainly; no hedging needed.
  official  — from a government notice. Cite it as official.
  baseline  — from a holiday library, NOT yet checked against the government gazette.
              Say it is unverified.
  predicted — no notice has been published for that year; these are the statutory days derived from
              the current rules. Say so, and say that 调休 (the shifted work/rest days) is NOT known.

Rules of thumb:
- Say the source in the answer itself, not only if asked. One clause is enough
  ("据国务院公告", "尚未公布，按法定假日推算").
- When a result names the document it came from (e.g. 国务院办公厅关于2026年部分节假日安排的通知),
  cite that document, not just the word "official" — a tier is not something a user can go and check.
- Never blend two tiers into one sentence. A future year's festival DATE is computed and certain,
  while whether it is a day off that year is predicted and unknown. Say which is which, or say only
  the part you have.
- A year with no data comes back as available:false. Report that as "no data", never fill the gap
  from your own memory — the user came here precisely because your memory is not citable.
- 调休 (make-up workdays) only exists in official years. For a predicted year, do not guess it.
- date_context is the richest single call; prefer it when the user asks "what is this day".`;

const server = new McpServer({ name: "icyn-date", version: "0.1.0" }, { instructions: INSTRUCTIONS });

/** Provenance of the astronomical tables — the most trustworthy layer, and previously the only one
 *  that said nothing about itself. Holidays carry their own per-answer source. */
const COMPUTED = "source: computed (lunar/solar-term table, verified 1900–2100 against two independent references)";

// Normalised here too, so the sentences we hand back to the model quote the canonical code.
const Region = z.string().default("CN").describe('Region code, case-insensitive: CN HK MO TW JP KR VN SG US GB DE FR, or a subdivision like US-CA, DE-BY, GB-SCT')
  .transform(r => r.trim().toUpperCase());
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO date YYYY-MM-DD");
const Lang = z.enum(["zh", "en"]).default("zh");

/** The first line is what a model is most likely to quote, so provenance belongs in it, not only in the JSON. */
function out(text: string, data: unknown, provenance?: string) {
  const head = provenance ? `${text} [${provenance}]` : text;
  return { content: [{ type: "text" as const, text: `${head}\n\n${JSON.stringify(data, null, 0)}` }] };
}
/**
 * Provenance line for the headline sentence: the tier plus the *document* it came from.
 * A tier alone ("official") is not citable; `source_ref` is what a user can go and check.
 */
function provenance(source?: string, ref?: string): string | undefined {
  if (!source) return undefined;
  const cite = ref ? ` — ${ref}` : "";
  switch (source) {
    case "official":  return `source: official${cite}`;
    // the CN source_ref already says 调休安排未公布 — only spell it out when there is no ref
    case "predicted": return ref ? `source: predicted — ${ref}` : "source: predicted — statutory days derived from the current rules; no notice published for this year, so 调休 is unknown";
    case "baseline":  return `source: baseline${cite} — a holiday library, NOT yet verified against the government gazette`;
    default:          return `source: ${source}${cite}`;
  }
}
/** Summarise the sources present in a list of holiday rows, for the headline sentence. */
function sourcesOf(rows: { source?: string; source_ref?: string }[]): string | undefined {
  const seen = new Map<string, string | undefined>();
  for (const r of rows) if (r.source && !seen.has(r.source)) seen.set(r.source, r.source_ref);
  if (!seen.size) return undefined;
  if (seen.size === 1) { const [[src, ref]] = [...seen]; return provenance(src, ref); }
  return [...seen].map(([src, ref]) => provenance(src, ref)).join(" | ") + " (mixed — see each row)";
}
/** Tier + document reference for a given day in a region, for tools that answer about days. */
function dayProvenance(date: string, region: string): string | undefined {
  try { const d = dayInfo(date, region); return d.available ? provenance(d.source, d.source_ref) : undefined; }
  catch { return undefined; }
}
function safe<T>(fn: () => T) {
  try { return fn(); } catch (e) { return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true }; }
}

server.tool("date_context", "Everything known about one date in one region: weekday/ISO week, workday status with source & confidence, holiday, lunar date & 干支, current/next solar term.",
  { date: DateStr, region: Region, lang: Lang },
  ({ date, region, lang }) => safe(() => out(describe(date, { region, lang }), dateContext(date, { region }), dayProvenance(date, region))));

server.tool("is_workday", "Is this date a working day in the region? Answers carry source (official/baseline/predicted) and confidence.",
  { date: DateStr, region: Region },
  ({ date, region }) => safe(() => { const d = dayInfo(date, region); return out(d.available ? `${date} in ${d.resolvedRegion}: ${d.kind} (${d.confidence})` : `${date}: ${d.reason}`, d, d.available ? provenance(d.source, d.source_ref) : undefined); }));

server.tool("holidays", "List public holidays of a region for a year, or within a date range.",
  { region: Region, year: z.number().int().optional(), from: DateStr.optional(), to: DateStr.optional() },
  ({ region, year, from, to }) => safe(() => {
    const y = year ?? new Date().getUTCFullYear();
    const list = from && to ? holidaysBetween(region, from, to) : holidays(region, y);
    const rows = list.map(h => ({ date: h.date, id: h.holiday.id, festival: h.holiday.festival, kind: h.holiday.kind, name: h.holiday.name, source: h.source, source_ref: h.source_ref, confidence: h.confidence }));
    const prov = sourcesOf(rows);
    // An empty list can mean "no holidays" or "no data for that year" — never let a model read the second as the first.
    if (!rows.length && !(from && to)) {
      const cov = coverage(region);
      if (!cov.years.includes(y) && !(cov.predictedFrom != null && y >= cov.predictedFrom))
        return out(`No holiday data for ${region} in ${y} (covered: ${cov.years.join(", ")}${cov.predictedFrom != null ? `, predicted from ${cov.predictedFrom}` : ""})`, { available: false, region, year: y, coverage: cov });
    }
    return out(`${rows.length} holiday days in ${region}${year ? ` ${year}` : ` ${from}..${to}`}`, rows, prov);
  }));

server.tool("workdays", "Workday arithmetic: list or count workdays in a range, or move N workdays from a date (negative = backwards).",
  { region: Region, from: DateStr, to: DateStr.optional(), add: z.number().int().optional().describe("Move this many workdays from `from` instead of listing a range") },
  ({ region, from, to, add }) => safe(() => {
    const prov = dayProvenance(from, region);
    if (add !== undefined) { const d = addWorkdays(region, from, add); return out(`${add} workdays from ${from} in ${region} → ${d}`, { date: d }, prov); }
    if (!to) { const d = nextWorkday(region, from); return out(`Next workday after ${from} in ${region}: ${d}`, { date: d }, prov); }
    const list = workdaysBetween(region, from, to);
    return out(`${list.length} workdays between ${from} and ${to} in ${region}`, { count: workdayCount(region, from, to), dates: list }, prov);
  }));

server.tool("next_long_weekend", "Next stretch of at least N consecutive non-working days from a date (holiday + weekend runs).",
  { region: Region, from: DateStr, minDays: z.number().int().min(2).default(3) },
  ({ region, from, minDays }) => safe(() => {
    const r = nextLongWeekend(region, from, minDays);
    const prov = r ? dayProvenance(r.start, region) : undefined;
    return out(r ? `${r.start} → ${r.end} (${r.days} days${r.holidays.length ? `, ${r.holidays.join(", ")}` : ""})` : `No ${minDays}+ day break found within a year of ${from}`, r, prov);
  }));

server.tool("holiday_eve", "Is this date the last working day before a public holiday?",
  { date: DateStr, region: Region },
  ({ date, region }) => safe(() => { const r = isHolidayEve(date, region); return out(`${date} in ${region} is ${r ? "" : "not "}a holiday eve`, { holidayEve: r }, dayProvenance(date, region)); }));

server.tool("lunar", "Convert a solar date to the Chinese lunar calendar (year/month/day, leap month, 干支, zodiac), or a lunar date to solar.",
  { date: DateStr.optional(), lunar: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(30), leap: z.boolean().default(false) }).optional() },
  ({ date, lunar }) => safe(() => {
    if (lunar) { const [y, m, d] = lunarToSolar(lunar); const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return out(`Lunar ${lunar.year}/${lunar.leap ? "閏" : ""}${lunar.month}/${lunar.day} = ${s}`, { date: s }, COMPUTED); }
    if (!date) throw new Error("Give either `date` or `lunar`");
    const l = solarToLunar(date); return out(`${date} = 农历${l.yearGanZhi}${l.zodiac}年${l.monthName}${l.dayName}`, l, COMPUTED);
  }));

server.tool("next_lunar_date", "Next solar date on which a lunar month/day occurs (e.g. a lunar birthday or 中秋 8/15).",
  { month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(30), from: DateStr },
  ({ month, day, from }) => safe(() => { const r = nextLunarDate(month, day, from); return out(`Lunar ${month}/${day} next falls on ${r.date}${r.adjusted ? " (month has 29 days; using 29th)" : ""}`, r, `${COMPUTED}. This is the lunar date only — whether it is a day off is a separate question, ask is_workday or holidays`); }));

server.tool("solar_terms", "The 24 solar terms (节气) of a year with exact instants (UTC).",
  { year: z.number().int().min(1900).max(2100) },
  ({ year }) => safe(() => out(`24 solar terms of ${year}`, solarTerms(year).map(t => ({ index: t.index, zh: t.name.zh, en: t.name.en, at: t.at.toISOString() })), COMPUTED)));

server.tool("regions_observing", "Which regions take a canonical festival off in a given year (e.g. lunar-new-year, mid-autumn, christmas), and on which dates.",
  { festival: z.string().describe(`One of: ${festivals().join(", ")}`), year: z.number().int() },
  ({ festival, year }) => safe(() => { const r = regionsObserving(festival, year); return out(`${r.length} regions observe ${festival} in ${year}`, r, sourcesOf(r)); }));

server.tool("regions", "Supported regions, subdivisions, data coverage and data version.",
  {},
  () => safe(() => out(`${regions().length} regions`, regions().map(r => ({ region: r, ...coverage(r), meta: regionMeta(r), subdivisions: regionTree()[r].length })))));

const transport = new StdioServerTransport();
await server.connect(transport);
