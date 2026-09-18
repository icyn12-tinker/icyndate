# @icyn/date

**Date context for AI agents and developers: Chinese lunar calendar, the 24 solar terms, holidays and
workdays for 12 regions — offline, verified 1900–2100, every answer tagged with its source and confidence.**

**给 AI Agent 和开发者的日期语义层：农历、二十四节气、12 个地区的节假日与工作日——离线、可验证、每个答案都带来源与置信度。**

Zero runtime dependencies. No network. No API key. MIT.

```bash
npm i @icyn/date
```

## One call

```ts
import { dateContext } from "@icyn/date";

dateContext("2026-02-17", { region: "CN" });
// {
//   date: "2026-02-17", region: "CN",
//   civil:    { weekday: 2, isoWeek: 8, isoWeekYear: 2026, dayOfYear: 48, leapYear: false },
//   workday:  { available: true, kind: "public_holiday", isWorkday: false,
//               source: "official", confidence: "certain",
//               holiday: { id: "spring-festival", festival: "lunar-new-year",
//                          name: { "zh-Hans": "春节", en: "Chinese New Year" }, dayIndex: 3, span: 9 },
//               meta: { region: "CN", data_version: "2026.09.18", verified_until: 2026, … } },
//   lunar:    { year: 2026, month: 1, day: 1, yearGanZhi: "丙午", zodiac: "马",
//               monthName: "正月", dayName: "初一", … },
//   solarTerm:{ onThisDay: null,
//               current: { name: { zh: "立春", en: "Beginning of Spring" }, at: "2026-02-03T20:01:51.000Z" },
//               next: { name: { zh: "雨水", en: "Rain Water" }, … } }
// }

import { describe } from "@icyn/date";
describe("2026-02-17", { region: "CN" });
// "2026-02-17 星期二，农历丙午马年正月初一，CN 放假：春节（第 3/9 天）。"
describe("2026-02-17", { region: "CN", lang: "en" });
// "2026-02-17 is a Tuesday; lunar 正月初一 (丙午, year of the 马); public holiday in CN: Chinese New Year (day 3 of 9)."
```

## Regions

`CN` ships in the main entry point. The other eleven are opt-in so you only pay for what you use:

```ts
import "@icyn/date/regions/all";   // HK MO TW JP KR VN SG US GB DE FR (+ 70﹢ subdivisions)
import "@icyn/date/regions/JP";    // …or just one
```

| Region | Data | Coverage |
|---|---|---|
| `CN` | `official` — State Council notices, incl. 调休; verified day-by-day against `chinesecalendar` | 2024–2026, then `predicted` statutory days |
| `HK` `MO` `TW` `JP` `KR` `VN` `SG` `US` `GB` `DE` `FR` | `baseline` — python-holidays rules, not yet gazette-checked | 2024–2028 |

Subdivisions are stored as diffs on top of the national list: `US-CA`, `DE-BY`, `GB-SCT`, …

## Holidays and workdays

```ts
import { dayInfo, isWorkday, holidays, nextWorkday, workdaysBetween,
         addWorkdays, workdayCount, holidaysBetween, isHolidayEve,
         nextLongWeekend, regionsObserving, coverage } from "@icyn/date";

dayInfo("2026-02-14", "CN");            // { kind: "adjusted_workday", isWorkday: true, source: "official", confidence: "certain", … }
dayInfo("2027-02-13", "CN");            // { kind: "weekend", source: "predicted", confidence: "uncertain", note: "Within the usual 调休 window…" }
dayInfo("2026-01-06", "DE-BY");         // Heilige Drei Könige — resolvedRegion "DE-BY", holiday.scope "subdivision"
nextWorkday("CN", "2026-09-30");        // "2026-10-08"
workdaysBetween("CN", "2026-02-13", "2026-02-24");
nextLongWeekend("CN", "2026-09-18", 7); // { start: "2026-10-01", end: "2026-10-07", days: 7, holidays: ["national-day"] }
regionsObserving("lunar-new-year", 2026); // [{ region: "CN", days: [...] }, { region: "HK", … }, …]
coverage("CN");                         // { years, official, baseline, predictable, predictedFrom, weekend, tz }
```

Every holiday answer carries:

- `source` — `official` (gazette, hand-entered) · `baseline` (library rules, not gazette-checked) · `predicted` (our own rules for years nobody has published)
- `confidence` — `certain` · `likely` · `uncertain` (a day inside the usual 调休 window of a predicted year)
- `meta` — `data_version`, `generated_at`, `verified_until`

**Prediction is forward-only.** Past years we have not entered are not extrapolated — they come back
`{ available: false, reason }`. Guessing backwards would invent history (清明/端午/中秋 only became
statutory in 2008, 春节 runs 除夕..初三 only from 2025), and a wrong answer is worse than no answer.

## Lunar calendar and solar terms

```ts
import { solarToLunar, lunarToSolar, nextLunarDate, lunarNewYear,
         monthGanZhi, hourGanZhi, dayGanZhi, lunarMonthLength,
         solarTerms, solarTermAt, solarTermOnDay } from "@icyn/date";

solarToLunar("2026-02-17");
// { year: 2026, month: 1, day: 1, leap: false, yearGanZhi: "丙午", dayGanZhi: "壬戌",
//   zodiac: "马", monthName: "正月", dayName: "初一", isLeapYear: false, monthLength: 30 }

lunarToSolar({ year: 2033, month: 11, day: 1, leap: true });  // [2033, 12, 22]  (the 2033 閏冬月 case)
nextLunarDate(8, 15, "2026-09-18");     // next 中秋: { date: "2026-09-25", lunarYear: 2026, adjusted: false }

solarTermOnDay("2026-02-04");           // { name: { zh: "立春", en: "Beginning of Spring" }, at: 2026-02-03T20:01:51Z, … }
solarTermOnDay("2026-03-20", "Asia/Tokyo");   // decide the civil day in any IANA zone or fixed offset
solarTermAt(new Date());                // { current, next } with exact instants
solarTerms(2027);                       // all 24 of the year
```

- Solar ⇄ lunar for every day 1900-01-31 .. `MAX_DATE` (2100-12-31), leap months included.
  That final date sits inside lunar 2100 腊月 and the table ends mid-month, so `monthLength` is `null`
  there and `lunarMonthLength(2100, 12)` throws — an unknown length is reported as unknown, not as the
  truncated count.
- Year / month / day / hour 干支, zodiac, Chinese month & day names
- 24 solar terms as exact instants (second precision), DST-aware via `Intl`

## Date input

Anywhere a date is accepted: `"2026-02-17"` · `[2026, 2, 17]` · `{ year, month, day }` · a `Date`
(its **UTC** calendar fields are used). Region codes are case-insensitive — `"us-ca"`, `"US-CA"` and
`" Us-Ca "` are the same region, and the answer reports the canonical `US-CA`.

## Error model

- Info-returning functions (`dayInfo`, `dateContext`, `holidays`) never throw for missing data — they
  return `{ available: false, reason }` or an empty list.
- Scalar functions (`isWorkday`, `nextWorkday`, `previousWorkday`, `addWorkdays`, `workdayCount`)
  throw `RangeError` when the region-year is not covered.
- Search functions (`nextLongWeekend`, `nextLunarDate`) return `null` when nothing is in range, and
  throw when the data runs out.
- Bad input (unknown region, malformed date, 2 月 30 日) throws `TypeError` / `RangeError`.

## How it is verified

The lunar table and solar-term instants are generated from two independent reference implementations
(`sxtwl`, `lunar_python`) and checked day-by-day for all 73,384 days and 4,824 instants; every
disagreement is adjudicated by hand and logged. CN holidays are cross-checked day-by-day against the
`chinesecalendar` package. See the repository's `NOTES.md` and `fixtures/`.

## MCP server

[`@icyn/date-mcp`](https://www.npmjs.com/package/@icyn/date-mcp) exposes all of this to any MCP client:

```bash
npx -y @icyn/date-mcp
```

## License

MIT. Holiday data for the eleven `baseline` regions is derived from
[python-holidays](https://github.com/vacanza/holidays) (MIT); see `THIRD-PARTY-LICENSES` in the repository.
