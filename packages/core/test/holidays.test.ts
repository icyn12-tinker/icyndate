import { describe, it, expect } from "vitest";
import { dayInfo, isWorkday, holidays, workdaysBetween, nextWorkday, schedule, coverage, regionsObserving } from "../src";

describe("CN holidays (official 2024-2026)", () => {
  it("2026 schedule matches the State Council notice", () => {
    expect(dayInfo("2026-02-15", "CN")).toMatchObject({ kind: "public_holiday", source: "official", holiday: { id: "spring-festival", dayIndex: 1, span: 9 } });
    expect(dayInfo("2026-02-14", "CN")).toMatchObject({ kind: "adjusted_workday", isWorkday: true, adjusted: true });
    expect(dayInfo("2026-02-28", "CN")).toMatchObject({ kind: "adjusted_workday" });
    expect(dayInfo("2026-10-07", "CN")).toMatchObject({ kind: "public_holiday", holiday: { id: "national-day", dayIndex: 7, span: 7 } });
    expect(dayInfo("2026-09-20", "CN")).toMatchObject({ kind: "adjusted_workday" });
    expect(dayInfo("2026-09-19", "CN")).toMatchObject({ kind: "weekend", isWorkday: false });
    expect(dayInfo("2026-09-17", "CN")).toMatchObject({ kind: "workday", weekday: 4 });
  });

  it("day counts per notice", () => {
    const count = (id: string) => holidays("CN", 2026).filter(h => h.holiday.id === id).length;
    expect(count("new-year")).toBe(3); expect(count("spring-festival")).toBe(9); expect(count("labour-day")).toBe(5); expect(count("national-day")).toBe(7);
    expect(holidays("CN", 2025).filter(h => h.holiday.id === "national-day-mid-autumn")).toHaveLength(8);
    expect(schedule("CN", 2024)!.workdays).toHaveLength(8);
  });

  it("workday arithmetic", () => {
    expect(workdaysBetween("CN", "2026-02-13", "2026-02-24")).toEqual(["2026-02-13", "2026-02-14", "2026-02-24"]);
    expect(nextWorkday("CN", "2026-09-30")).toBe("2026-10-08");
    expect(nextWorkday("CN", "2026-09-30", 2)).toBe("2026-10-09");
    expect(isWorkday("2026-10-10", "CN")).toBe(true);
  });
});

describe("CN predicted years", () => {
  it("2027 falls back to statutory days with source=predicted", () => {
    const s = schedule("CN", 2027)!;
    expect(s.source).toBe("predicted");
    expect(s.workdays).toEqual([]);
    const byId = Object.fromEntries(s.holidays.map(h => [h.id, h.days]));
    expect(byId["spring-festival"]).toEqual(["2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08"]); // 除夕..初三, 正月初一 = 2027-02-06
    expect(byId["qingming"]).toHaveLength(1);
    expect(byId["qingming"][0]).toMatch(/^2027-04-0[456]$/);
    expect(byId["dragon-boat"]).toEqual(["2027-06-09"]);
    expect(byId["mid-autumn"]).toEqual(["2027-09-15"]);
    expect(dayInfo("2027-02-06", "CN")).toMatchObject({ kind: "public_holiday", source: "predicted" });
  });

  it("predictor reproduces the statutory core of official 2026", () => {
    const p = Object.fromEntries(schedule("CN", 2027)!.holidays.map(h => [h.id, h.days]));
    expect(p["new-year"]).toEqual(["2027-01-01"]);
    expect(coverage("CN").official).toEqual([2024, 2025, 2026]);
  });

  it("unknown region throws", () => {
    expect(() => dayInfo("2026-01-01", "XX")).toThrow(/Unknown region/);
  });
});

describe("prediction is forward-only (never invents history)", () => {
  // The predictor encodes the 2024-revised statutory rules. Applying them to a past year would
  // be wrong three ways over: no PRC holidays before 1949, no 清明/端午/中秋 before 2008, and
  // 春节 only runs 除夕..初三 from 2025. Those years must read as "no data", not as a guess.
  it.each([1900, 1949, 1990, 2005, 2008, 2023])("%i is not predicted", (year) => {
    expect(schedule("CN", year)).toBeNull();
    const info = dayInfo(`${year}-10-01`, "CN");
    expect(info.available).toBe(false);
    if (!info.available) expect(info.reason).toMatch(/never predicted/);
  });

  it("the year after the entered data still is predicted", () => {
    expect(coverage("CN").predictedFrom).toBe(2027);
    expect(schedule("CN", 2027)!.source).toBe("predicted");
    expect(schedule("CN", 2099)!.source).toBe("predicted");
  });

  it("scalar functions throw rather than answer for a past uncovered year", () => {
    expect(() => isWorkday("2005-10-01", "CN")).toThrow(RangeError);
    expect(holidays("CN", 2005)).toEqual([]);
  });

  it("regionsObserving does not report festivals in unpredicted past years", () => {
    expect(regionsObserving("lunar-new-year", 2005)).toEqual([]);
    expect(regionsObserving("lunar-new-year", 2026).map(r => r.region)).toContain("CN");
  });
});
