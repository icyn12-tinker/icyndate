# icyndate

**Date context for AI agents and developers: lunar calendar, solar terms, holidays and "what does this day mean" — offline, verified, MIT.**
**给 AI Agent 和开发者的日期语义层：农历、节气、节假日、"这一天意味着什么"——离线、可验证、MIT。**

> Status: week 1. Lunar calendar, the 24 solar terms and the holiday layer (12 regions) are in;
> lunar & solar terms verified for 1900–2100, CN holidays for 2024–2026.
> 状态：第一周。农历、二十四节气、节假日层（12 个地区）均已落地；农历与节气 1900–2100 全量验证，
> 中国大陆节假日 2024–2026 逐天对拍。

## Install / 安装

```bash
npm i @icyn/date                       # library: lunar + solar terms + CN holidays (~90 KB)
import "@icyn/date/regions/all";       # opt in to the other 11 regions (+ subdivisions), or "@icyn/date/regions/JP"

npx -y @icyn/date-mcp                  # MCP server for Claude Desktop / Cursor / any MCP client
```

## What works today / 现在能用的

One call:

```ts
import { dateContext } from "@icyn/date";

dateContext("2026-02-17", { region: "CN" });
// {
//   date: "2026-02-17", region: "CN",
//   civil:    { weekday: 2, isoWeek: 8, isoWeekYear: 2026, dayOfYear: 48, leapYear: false },
//   workday:  { available: true, kind: "public_holiday", isWorkday: false, confidence: "certain", source: "official",
//               holiday: { id: "spring-festival", festival: "lunar-new-year", name: { "zh-Hans": "春节", en: "Chinese New Year" }, dayIndex: 3, span: 9 },
//               meta: { region: "CN", data_version: "2026.09.18", verified_until: 2026, … } },
//   lunar:    { year: 2026, month: 1, day: 1, yearGanZhi: "丙午", zodiac: "马", monthName: "正月", dayName: "初一", … },
//   solarTerm:{ onThisDay: null, current: { name: { zh: "立春", en: "Beginning of Spring" }, at: "2026-02-03T20:01:51.000Z" }, next: { zh: "雨水", … } }
// }
```

Dates can be given as `"2026-02-17"`, `[2026, 2, 17]`, `{ year, month, day }` or a `Date` (UTC fields). Every holiday
answer carries `source` (official / baseline / predicted), `confidence` (certain / likely / uncertain) and data
version metadata; a year we know nothing about comes back as `{ available: false, reason }`, never a guess.

Pieces:

```ts
import { solarToLunar, lunarToSolar } from "@icyn/date";

solarToLunar("2026-02-17");
// { year: 2026, month: 1, day: 1, leap: false, yearGanZhi: "丙午", dayGanZhi: "…",
//   zodiac: "马", monthName: "正月", dayName: "初一", isLeapYear: false, monthLength: 30 }

lunarToSolar({ year: 2033, month: 11, day: 1, leap: true }); // [2033, 12, 22]

import { solarTerms, solarTermAt, solarTermOnDay } from "@icyn/date";
solarTermOnDay("2026-02-04");          // { name: { zh: "立春", en: "Beginning of Spring" }, at: 2026-02-03T20:01:51Z, … }
solarTermAt(new Date());               // { current, next } with exact instants
solarTerms(2027);                      // all 24 of the year

import { dayInfo, nextWorkday, workdaysBetween, holidays } from "@icyn/date";
dayInfo("2026-02-14", "CN");           // { kind: "adjusted_workday", isWorkday: true, source: "official", confidence: "certain", … }
dayInfo("2027-02-13", "CN");           // { kind: "weekend", source: "predicted", confidence: "uncertain", note: "Within the usual 调休 window…" }
regionsObserving("lunar-new-year", 2026); // [{ region: "HK", days: [...] }, { region: "KR", … }, …]
dayInfo("2026-01-06", "DE-BY");        // Heilige Drei Könige — subdivision holiday, resolvedRegion "DE-BY"
nextLongWeekend("CN", "2026-09-18", 7); // { start: "2026-10-01", end: "2026-10-07", days: 7 }
nextLunarDate(8, 15, "2026-09-18");    // next 中秋: { date: "2026-09-25", lunarYear: 2026, adjusted: false }
describe("2026-02-17", { region: "CN" });
// "2026-02-17 星期二，农历丙午马年正月初一，CN 放假：春节（第 3/9 天）。"
nextWorkday("CN", "2026-09-30");       // "2026-10-08"
workdaysBetween("CN", "2026-02-13", "2026-02-24");
```

- Solar ⇄ lunar for every day 1900-01-31 .. 2100-12-31 (`MAX_DATE`; that last date falls inside lunar
  2100 腊月, so `monthLength` for that month is `null` — the table ends mid-month and the real length is unknown)
- Year / day 干支, zodiac, Chinese month & day names, leap month handling (incl. the 2033 閏冬月 case)
- 24 solar terms as exact instants (second precision), current/next lookup, "is there a term on this day" at any UTC offset
- Workday / holiday queries for 12 regions, every answer tagged `official` / `baseline` / `predicted` — never silently guessed
- Zero dependencies, no runtime astronomy; ~480 KB of table data, of which only the lunar/solar-term tables and CN are in the default entry point — the other 11 regions and their 70+ subdivisions load only if you import them

## Error model / 失败行为

- Functions that return an info object (`dayInfo`, `dateContext`, `holidays`) never throw for missing data: they return `{ available: false, reason }` or an empty list.
- Functions that return a scalar (`isWorkday`, `addWorkdays`, `nextWorkday`, `workdayCount`) throw `RangeError` when the region-year is not covered.
- Search functions (`nextLongWeekend`, `nextLunarDate`) return `null` when nothing is found in range, and throw when data runs out.
- Bad input (unknown region, malformed date, 2 月 30 日) always throws `TypeError` / `RangeError`.
  Region codes are case-insensitive (`"us-ca"` = `"US-CA"`); a code with no data at all still throws.
- **Prediction is forward-only.** A year we have not entered is extrapolated only if it is *after* the
  last entered year (`coverage(region).predictedFrom`). Past uncovered years return
  `{ available: false }` rather than a guess — extrapolating the current 《放假办法》 backwards would
  invent history (清明/端午/中秋 became statutory only in 2008, 春节 runs 除夕..初三 only from 2025).

## How it is verified / 验证方式

`tools/gen_fixtures.py` and `tools/gen_solar_terms.py` generate `fixtures/lunar-1900-2100.json` (73,384 rows) from **two independent reference
implementations** (`sxtwl`, `lunar_python`). The test suite converts every row in both directions.
Anything the two references disagree on is written to `fixtures/lunar-disagreements.json` and adjudicated by hand
(see `NOTES.md`). A release is blocked unless 100% of rows pass.

```bash
npm install
npm test                 # Node only

# the full release gate: build + tsc + tests + the CN cross-check
python3 -m pip install -r tools/requirements.txt   # one pure-Python package
npm run check
```

The last step of `npm run check` verifies `CN.json` day-by-day against `chinesecalendar`. If that
package is missing it fails loudly rather than skipping — an unverified table must not look like a
passing gate.

## Roadmap / 路线图

- [x] Lunar core + 1900–2100 fixtures
- [x] 24 solar terms with exact instants (two references agree within 55 s; spot-check against 紫金山天文台 published values before release)
- [x] Holidays CN 2024–2026 official (incl. 调休), cross-checked day-by-day with `chinesecalendar`; later years → statutory days `predicted` from lunar/solar-term rules (forward-only; earlier years are never guessed)
- [x] Holidays HK/MO/TW/JP/KR/VN/SG/US/GB/DE/FR 2024–2028 as `baseline` (python-holidays rules), CNY dates cross-checked against our lunar table
- [x] Region time zones (DST-aware via Intl) so JP/KR/EU decide solar-term days in their own zone; region hierarchy (`US-CA`, `DE-BY`, `GB-SCT`, 70+ subdivisions as diffs); holiday `kind` (public/federal/bank/substitute); `previousWorkday` / `addWorkdays` / `workdayCount` / `holidaysBetween` / `isHolidayEve` / `nextLongWeekend`; month & hour 干支, `nextLunarDate` (lunar birthdays); `describe()` one-sentence zh/en output for MCP
- [x] `dateContext()` one-call API, canonical date input, confidence levels, BCP-47 names with guaranteed `en` + `zh-Hans`, canonical festival ids across regions, data version metadata, graceful `available: false`
- [ ] Upgrade baseline regions to `official` year by year against gazettes (TW 補班, HK gazette, KR substitute days first)
- [ ] "On this day" from Wikipedia (CC BY-SA, attributed per entry)
- [x] `@icyn/date` npm package (esbuild ESM, per-region entry points, d.ts) · `@icyn/date-mcp` MCP server (11 tools, stdio, smoke-tested end to end)
- [ ] `icyndate` pip package (same test vectors)
- [ ] Hosted API

## Repository layout / 目录

```
docs/        product & technical plan（产品与技术方案）, worklog
fixtures/    reference test vectors (generated, committed)
tools/       fixture generators (Python, not shipped)
packages/core/  @icyn/date — the library
packages/mcp/   @icyn/date-mcp — MCP server
```

## License

MIT for code and the derived lunar / solar-term tables. The `baseline` holiday tables for the eleven
non-CN regions are derived from [python-holidays](https://github.com/vacanza/holidays) (MIT) — its
licence is reproduced in `THIRD-PARTY-LICENSES`, and each generated file records the exact version in
`baseline_note`. Other third-party data (Wikipedia, government holiday notices) keeps its own licence
and is attributed per entry.
