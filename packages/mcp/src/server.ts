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

const server = new McpServer({ name: "icyn-date", version: "0.1.0" });

// Normalised here too, so the sentences we hand back to the model quote the canonical code.
const Region = z.string().default("CN").describe('Region code, case-insensitive: CN HK MO TW JP KR VN SG US GB DE FR, or a subdivision like US-CA, DE-BY, GB-SCT')
  .transform(r => r.trim().toUpperCase());
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("ISO date YYYY-MM-DD");
const Lang = z.enum(["zh", "en"]).default("zh");

function out(text: string, data: unknown) {
  return { content: [{ type: "text" as const, text: `${text}\n\n${JSON.stringify(data, null, 0)}` }] };
}
function safe<T>(fn: () => T) {
  try { return fn(); } catch (e) { return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true }; }
}

server.tool("date_context", "Everything known about one date in one region: weekday/ISO week, workday status with source & confidence, holiday, lunar date & 干支, current/next solar term.",
  { date: DateStr, region: Region, lang: Lang },
  ({ date, region, lang }) => safe(() => out(describe(date, { region, lang }), dateContext(date, { region }))));

server.tool("is_workday", "Is this date a working day in the region? Answers carry source (official/baseline/predicted) and confidence.",
  { date: DateStr, region: Region },
  ({ date, region }) => safe(() => { const d = dayInfo(date, region); return out(d.available ? `${date} in ${d.resolvedRegion}: ${d.kind} (${d.source}, ${d.confidence})` : `${date}: ${d.reason}`, d); }));

server.tool("holidays", "List public holidays of a region for a year, or within a date range.",
  { region: Region, year: z.number().int().optional(), from: DateStr.optional(), to: DateStr.optional() },
  ({ region, year, from, to }) => safe(() => {
    const y = year ?? new Date().getUTCFullYear();
    const list = from && to ? holidaysBetween(region, from, to) : holidays(region, y);
    const rows = list.map(h => ({ date: h.date, id: h.holiday.id, festival: h.holiday.festival, kind: h.holiday.kind, name: h.holiday.name, source: h.source, confidence: h.confidence }));
    // An empty list can mean "no holidays" or "no data for that year" — never let a model read the second as the first.
    if (!rows.length && !(from && to)) {
      const cov = coverage(region);
      if (!cov.years.includes(y) && !(cov.predictedFrom != null && y >= cov.predictedFrom))
        return out(`No holiday data for ${region} in ${y} (covered: ${cov.years.join(", ")}${cov.predictedFrom != null ? `, predicted from ${cov.predictedFrom}` : ""})`, { available: false, region, year: y, coverage: cov });
    }
    return out(`${rows.length} holiday days in ${region}${year ? ` ${year}` : ` ${from}..${to}`}`, rows);
  }));

server.tool("workdays", "Workday arithmetic: list or count workdays in a range, or move N workdays from a date (negative = backwards).",
  { region: Region, from: DateStr, to: DateStr.optional(), add: z.number().int().optional().describe("Move this many workdays from `from` instead of listing a range") },
  ({ region, from, to, add }) => safe(() => {
    if (add !== undefined) { const d = addWorkdays(region, from, add); return out(`${add} workdays from ${from} in ${region} → ${d}`, { date: d }); }
    if (!to) { const d = nextWorkday(region, from); return out(`Next workday after ${from} in ${region}: ${d}`, { date: d }); }
    const list = workdaysBetween(region, from, to);
    return out(`${list.length} workdays between ${from} and ${to} in ${region}`, { count: workdayCount(region, from, to), dates: list });
  }));

server.tool("next_long_weekend", "Next stretch of at least N consecutive non-working days from a date (holiday + weekend runs).",
  { region: Region, from: DateStr, minDays: z.number().int().min(2).default(3) },
  ({ region, from, minDays }) => safe(() => { const r = nextLongWeekend(region, from, minDays); return out(r ? `${r.start} → ${r.end} (${r.days} days${r.holidays.length ? `, ${r.holidays.join(", ")}` : ""})` : `No ${minDays}+ day break found within a year of ${from}`, r); }));

server.tool("holiday_eve", "Is this date the last working day before a public holiday?",
  { date: DateStr, region: Region },
  ({ date, region }) => safe(() => { const r = isHolidayEve(date, region); return out(`${date} in ${region} is ${r ? "" : "not "}a holiday eve`, { holidayEve: r }); }));

server.tool("lunar", "Convert a solar date to the Chinese lunar calendar (year/month/day, leap month, 干支, zodiac), or a lunar date to solar.",
  { date: DateStr.optional(), lunar: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(30), leap: z.boolean().default(false) }).optional() },
  ({ date, lunar }) => safe(() => {
    if (lunar) { const [y, m, d] = lunarToSolar(lunar); const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; return out(`Lunar ${lunar.year}/${lunar.leap ? "閏" : ""}${lunar.month}/${lunar.day} = ${s}`, { date: s }); }
    if (!date) throw new Error("Give either `date` or `lunar`");
    const l = solarToLunar(date); return out(`${date} = 农历${l.yearGanZhi}${l.zodiac}年${l.monthName}${l.dayName}`, l);
  }));

server.tool("next_lunar_date", "Next solar date on which a lunar month/day occurs (e.g. a lunar birthday or 中秋 8/15).",
  { month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(30), from: DateStr },
  ({ month, day, from }) => safe(() => { const r = nextLunarDate(month, day, from); return out(`Lunar ${month}/${day} next falls on ${r.date}${r.adjusted ? " (month has 29 days; using 29th)" : ""}`, r); }));

server.tool("solar_terms", "The 24 solar terms (节气) of a year with exact instants (UTC).",
  { year: z.number().int().min(1900).max(2100) },
  ({ year }) => safe(() => out(`24 solar terms of ${year}`, solarTerms(year).map(t => ({ index: t.index, zh: t.name.zh, en: t.name.en, at: t.at.toISOString() })))));

server.tool("regions_observing", "Which regions take a canonical festival off in a given year (e.g. lunar-new-year, mid-autumn, christmas), and on which dates.",
  { festival: z.string().describe(`One of: ${festivals().join(", ")}`), year: z.number().int() },
  ({ festival, year }) => safe(() => { const r = regionsObserving(festival, year); return out(`${r.length} regions observe ${festival} in ${year}`, r); }));

server.tool("regions", "Supported regions, subdivisions, data coverage and data version.",
  {},
  () => safe(() => out(`${regions().length} regions`, regions().map(r => ({ region: r, ...coverage(r), meta: regionMeta(r), subdivisions: regionTree()[r].length })))));

const transport = new StdioServerTransport();
await server.connect(transport);
