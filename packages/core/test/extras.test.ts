import { describe, it, expect } from "vitest";
import "../src/regions/all";
import {
  dateContext, describe as say, dayInfo, regionTree, regionTz, coverage, schedule, holidays,
  previousWorkday, addWorkdays, workdayCount, holidaysBetween, isHolidayEve, nextLongWeekend,
  monthGanZhi, hourGanZhi, lunarMonthLength, nextLunarDate, dayGanZhi,
  tzOffsetAt, civilDayBounds, civilInTz, solarTermOnDay,
  canonicalRegion, solarToLunar, lunarToSolar, MAX_DATE, isWorkday,
} from "../src";

describe("8. region time zones & DST-aware solar terms", () => {
  it("offsets", () => {
    expect(tzOffsetAt("Asia/Tokyo", new Date("2026-03-20T00:00:00Z"))).toBe(540);
    expect(tzOffsetAt("Europe/Berlin", new Date("2026-01-15T00:00:00Z"))).toBe(60);
    expect(tzOffsetAt("Europe/Berlin", new Date("2026-07-15T00:00:00Z"))).toBe(120);
    expect(() => tzOffsetAt("Mars/Olympus", new Date())).toThrow(RangeError);
  });
  it("civil day bounds across a DST switch", () => {
    const [s, e] = civilDayBounds({ year: 2026, month: 3, day: 29 }, "Europe/Berlin"); // DST starts 02:00 → 23-hour day
    expect((e - s) / 3_600_000).toBe(23);
    expect(civilInTz(new Date("2026-03-20T15:30:00Z"), "Asia/Tokyo")).toEqual({ year: 2026, month: 3, day: 21 });
  });
  it("JP 春分の日: equinox instant 2026-03-20 14:46 UTC is the 20th in Beijing but the 21st in Tokyo? (check)", () => {
    const bj = solarTermOnDay("2026-03-20", "Asia/Shanghai");
    const tk20 = solarTermOnDay("2026-03-20", "Asia/Tokyo"), tk21 = solarTermOnDay("2026-03-21", "Asia/Tokyo");
    expect(bj?.name.zh).toBe("春分");
    expect((tk20 ?? tk21)?.name.zh).toBe("春分");
    expect(regionTz("JP")).toBe("Asia/Tokyo");
    expect(dateContext("2026-03-20", { region: "JP" }).solarTerm?.tz).toBe("Asia/Tokyo");
  });
});

describe("9. region hierarchy", () => {
  it("subdivisions resolve and add extras", () => {
    expect(regionTree().DE).toContain("DE-BY");
    expect(regionTree().US).toContain("US-CA");
    expect(dayInfo("2026-01-06", "DE-BY")).toMatchObject({ kind: "public_holiday", resolvedRegion: "DE-BY", holiday: { festival: "epiphany", scope: "subdivision" } }); // Heilige Drei Könige
    expect(dayInfo("2026-01-06", "DE")).toMatchObject({ kind: "workday" });
    expect(dayInfo("2026-01-06", "DE-XX")).toMatchObject({ kind: "workday", resolvedRegion: "DE", note: expect.stringMatching(/unknown/) });
    expect(dayInfo("2026-05-25", "US-CA")).toMatchObject({ kind: "public_holiday", holiday: { scope: "national", kind: "federal" } });
    expect(coverage("GB-SCT").tz).toBe("Europe/London");
    expect(schedule("GB-SCT", 2026)!.holidays.some(h => h.id.endsWith("@SCT"))).toBe(true);
  });
});

describe("10. holiday kinds", () => {
  it("bank / federal / substitute / public", () => {
    expect(dayInfo("2026-05-04", "GB")).toMatchObject({ holiday: { kind: "bank" } });
    expect(dayInfo("2026-07-03", "US")).toMatchObject({ holiday: { kind: "substitute" } }); // Independence Day observed (Jul 4 is Saturday)
    expect(dayInfo("2026-10-01", "CN")).toMatchObject({ holiday: { kind: "public" } });
    const kinds = new Set(holidays("JP", 2026).map(h => h.holiday.kind));
    expect([...kinds].every(k => ["public", "substitute"].includes(k))).toBe(true);
  });
});

describe("11. date arithmetic", () => {
  it("backwards and counts", () => {
    expect(previousWorkday("CN", "2026-10-08")).toBe("2026-09-30");
    expect(addWorkdays("CN", "2026-10-08", -2)).toBe("2026-09-29");
    expect(addWorkdays("CN", "2026-09-30", 1)).toBe("2026-10-08");
    expect(addWorkdays("CN", "2026-09-30", 0)).toBe("2026-09-30");
    expect(workdayCount("CN", "2026-10-01", "2026-10-11")).toBe(3); // 8, 9, 10(调休)
    expect(holidaysBetween("CN", "2026-12-20", "2027-01-05").map(h => h.date)).toEqual(["2027-01-01"]);
  });
  it("eve and long weekends", () => {
    expect(isHolidayEve("2026-09-30", "CN")).toBe(true);
    expect(isHolidayEve("2026-09-29", "CN")).toBe(false);
    expect(nextLongWeekend("CN", "2026-03-01")).toEqual({ start: "2026-04-04", end: "2026-04-06", days: 3, holidays: ["qingming"] });
    expect(nextLongWeekend("US", "2026-05-01")).toMatchObject({ start: "2026-05-23", end: "2026-05-25", days: 3 });
    expect(nextLongWeekend("CN", "2026-09-18", 7)).toMatchObject({ start: "2026-10-01", end: "2026-10-07", days: 7 });
  });
});

describe("12. lunar extras", () => {
  it("month & hour 干支", () => {
    expect(monthGanZhi(2026, 1)).toBe("庚寅");   // 丙午年正月
    expect(monthGanZhi(2024, 1)).toBe("丙寅");   // 甲辰年正月
    expect(monthGanZhi(2026, 12)).toBe("辛丑");
    expect(hourGanZhi("戊申", 13)).toBe("己未");
    expect(hourGanZhi("甲子", 0)).toBe("甲子");
    expect(hourGanZhi(dayGanZhi("2026-09-18"), 0)).toBe("丙子"); expect(hourGanZhi(dayGanZhi("2026-02-17"), 13)).toBe("丁未");
  });
  it("month lengths & next lunar date", () => {
    expect(lunarMonthLength(2033, 11, true)).toBe(29); expect(lunarMonthLength(2033, 11, false)).toBe(30);
    expect(() => lunarMonthLength(2026, 5, true)).toThrow(RangeError);
    expect(nextLunarDate(8, 15, "2026-09-18")).toEqual({ date: "2026-09-25", lunarYear: 2026, adjusted: false });
    expect(nextLunarDate(8, 15, "2026-09-25")).toEqual({ date: "2027-09-15", lunarYear: 2027, adjusted: false });
    expect(nextLunarDate(8, 15, "2026-09-25", true).date).toBe("2026-09-25");
    const r = nextLunarDate(2, 30, "2026-01-01"); // lunar 2026 二月 has 29 days
    expect(r).toMatchObject({ lunarYear: 2026, adjusted: true });
  });
});

describe("13. describe()", () => {
  it("zh and en", () => {
    expect(say("2026-02-17", { region: "CN" })).toBe("2026-02-17 星期二，农历丙午马年正月初一，CN 放假：春节（第 3/9 天）。");
    expect(say("2026-02-04", { region: "CN", lang: "en" })).toMatch(/^2026-02-04 is a Wednesday; lunar 腊月十七 \(乙巳, year of the 蛇\); solar term Beginning of Spring; working day in CN\.$/);
    expect(say("2027-02-13", { region: "CN" })).toMatch(/周末（调休安排未公布，可能变动）。$/);
    expect(say("2026-01-06", { region: "DE-BY", lang: "en" })).toMatch(/public holiday in DE-BY: Epiphany \(rule-based/);
  });
});

describe("coinciding holidays", () => {
  it("TW 2025-04-04 is both 兒童節 and 清明", () => {
    const d = dayInfo("2025-04-04", "TW");
    expect(d).toMatchObject({ kind: "public_holiday" });
    if (d.available) expect((d.otherHolidays ?? []).length).toBe(1);
  });
});

describe("14. region codes are case-insensitive", () => {
  // Agents and LLM clients do not reliably send canonical casing; a case mismatch is not worth failing on.
  it("accepts any casing and reports the canonical form", () => {
    expect(canonicalRegion(" us-ca ")).toBe("US-CA");
    expect(dayInfo("2026-02-17", "cn")).toMatchObject({ region: "CN", resolvedRegion: "CN", kind: "public_holiday" });
    expect(dayInfo("2026-01-06", "de-by")).toMatchObject({ region: "DE-BY", resolvedRegion: "DE-BY", kind: "public_holiday" });
    expect(dayInfo("2026-05-25", "Us")).toMatchObject({ resolvedRegion: "US", kind: "public_holiday" });
    expect(isWorkday("2026-10-10", "cn")).toBe(true);
    expect(coverage("gb-sct").tz).toBe("Europe/London");
    expect(regionTz("jp")).toBe("Asia/Tokyo");
  });
  it("still rejects a region that does not exist", () => {
    expect(() => dayInfo("2026-01-01", "zz")).toThrow(/Unknown region/);
  });
});

describe("15. the truncated tail of the lunar table", () => {
  // The table stops mid-month at MAX_DATE, so the last lunar month's length is unknown.
  // Reporting the truncated count (1) as if it were the month length would be a wrong number.
  it("reports monthLength as null instead of the truncation artefact", () => {
    expect(MAX_DATE).toBe("2100-12-31");
    const last = solarToLunar(MAX_DATE);
    expect(last).toMatchObject({ year: 2100, month: 12, day: 1, monthName: "腊月" });
    expect(last.monthLength).toBeNull();
    expect(solarToLunar("2100-12-30").monthLength).toBe(30);   // a complete month still reports its length
  });
  it("says the length is unknown rather than guessing", () => {
    expect(() => lunarMonthLength(2100, 12)).toThrow(/unknown/);
    expect(lunarMonthLength(2100, 11)).toBe(30);
  });
  it("lunarToSolar explains the truncation instead of claiming a 1-day month", () => {
    expect(lunarToSolar({ year: 2100, month: 12, day: 1, leap: false })).toEqual([2100, 12, 31]);
    expect(() => lunarToSolar({ year: 2100, month: 12, day: 2, leap: false })).toThrow(/extends past 2100-12-31/);
  });
  it("nextLunarDate skips the truncated month rather than throwing from inside", () => {
    expect(() => nextLunarDate(12, 1, "2100-12-31")).toThrow(/No occurrence/);
  });
});
