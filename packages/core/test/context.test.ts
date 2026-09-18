import { describe, it, expect } from "vitest";
import "../src/regions/all";
import { dateContext, dayInfo, toCivil, civilFromDate, regionsObserving, festivals, regionMeta, solarToLunar, holidays } from "../src";

describe("dateContext", () => {
  it("composes everything for 2026-02-17 CN", () => {
    const c = dateContext("2026-02-17", { region: "CN" });
    expect(c.civil).toMatchObject({ weekday: 2, dayOfYear: 48, leapYear: false, isoWeek: 8 });
    expect(c.workday).toMatchObject({ available: true, kind: "public_holiday", confidence: "certain", holiday: { festival: "lunar-new-year", dayIndex: 3, span: 9 } });
    expect(c.lunar).toMatchObject({ year: 2026, month: 1, day: 1, yearGanZhi: "丙午", zodiac: "马" });
    expect(c.solarTerm?.current.name.zh).toBe("立春");
    expect(c.solarTerm?.next.name.zh).toBe("雨水");
    expect(c.solarTerm?.onThisDay).toBeNull();
  });
  it("accepts every input form", () => {
    const a = dateContext("2026-02-04"), b = dateContext([2026, 2, 4]), c = dateContext({ year: 2026, month: 2, day: 4 }), d = dateContext(new Date(Date.UTC(2026, 1, 4)));
    for (const x of [b, c, d]) expect(x).toEqual(a);
    expect(a.solarTerm?.onThisDay?.name.zh).toBe("立春");
    expect(civilFromDate(new Date("2026-02-03T22:00:00Z"), 480)).toEqual({ year: 2026, month: 2, day: 4 });
    expect(() => toCivil("2026-02-30")).toThrow(RangeError);
    expect(() => toCivil("17/02/2026")).toThrow(TypeError);
  });
  it("ISO week edge cases", () => {
    expect(dateContext("2027-01-01").civil).toMatchObject({ isoWeek: 53, isoWeekYear: 2026 });
    expect(dateContext("2024-12-30").civil).toMatchObject({ isoWeek: 1, isoWeekYear: 2025 });
  });
  it("include filter", () => {
    const c = dateContext("2026-02-17", { include: ["civil"] });
    expect(c.workday).toBeUndefined(); expect(c.lunar).toBeUndefined(); expect(c.solarTerm).toBeUndefined();
  });
  it("out-of-range degrades instead of throwing", () => {
    const c = dateContext("1850-05-01", { region: "CN" });
    expect(c.lunar).toMatchObject({ available: false });
    expect(c.solarTerm).toBeUndefined();
    expect(c.workday).toMatchObject({ available: false });
  });
});

describe("confidence & availability", () => {
  it("predicted year marks days near holidays as uncertain", () => {
    expect(dayInfo("2027-02-13", "CN")).toMatchObject({ kind: "weekend", source: "predicted", confidence: "uncertain" });   // Saturday a week after 春节
    expect(dayInfo("2027-03-20", "CN")).toMatchObject({ kind: "weekend", source: "predicted", confidence: "likely" });
    expect(dayInfo("2027-02-06", "CN")).toMatchObject({ kind: "public_holiday", confidence: "likely" });
  });
  it("baseline regions are 'likely', official are 'certain'", () => {
    expect(dayInfo("2026-05-25", "US")).toMatchObject({ confidence: "likely", source: "baseline" });
    expect(dayInfo("2026-05-01", "CN")).toMatchObject({ confidence: "certain", source: "official" });
  });
  it("uncovered year returns available:false with coverage in reason", () => {
    const r = dayInfo("2031-01-01", "US");
    expect(r.available).toBe(false);
    if (!r.available) expect(r.reason).toMatch(/2024, 2025, 2026, 2027, 2028/);
    expect(holidays("US", 2031)).toEqual([]);
  });
  it("carries data version metadata", () => {
    const m = regionMeta("CN");
    expect(m.data_version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(m.verified_until).toBe(2026);
    expect(dayInfo("2026-01-01", "JP")).toMatchObject({ meta: { region: "JP", verified_until: null } });
  });
});

describe("festivals & i18n", () => {
  it("lunar new year across regions in 2026 all start on 02-17", () => {
    const obs = regionsObserving("lunar-new-year", 2026);
    const regions = obs.map(o => o.region).sort();
    expect(regions).toEqual(expect.arrayContaining(["CN", "HK", "MO", "TW", "KR", "VN", "SG"]));
    for (const o of obs) expect(o.days).toContain("2026-02-17");
    expect(festivals()).toContain("mid-autumn");
  });
  it("every holiday name has en and zh-Hans under BCP-47 keys", () => {
    for (const r of ["CN", "HK", "TW", "JP", "KR", "VN", "SG", "US", "GB", "DE", "FR", "MO"]) for (const h of holidays(r, 2026)) {
      expect(h.holiday.name.en).toBeTruthy();
      expect(h.holiday.name["zh-Hans"]).toBeTruthy();
      for (const k of Object.keys(h.holiday.name)) expect(k).toMatch(/^[a-z]{2}(-[A-Za-z]{2,4})*$/);
    }
    expect(holidays("TW", 2026)[0].holiday.name["zh-Hant-TW"]).toBeTruthy();
  });
});
