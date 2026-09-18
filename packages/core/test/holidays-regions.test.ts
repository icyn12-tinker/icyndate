import { describe, it, expect } from "vitest";
import "../src/regions/all";
import { dayInfo, regions, coverage, holidays, nextWorkday } from "../src";

describe("baseline regions", () => {
  it("12 regions loaded", () => {
    expect(regions().sort()).toEqual(["CN","DE","FR","GB","HK","JP","KR","MO","SG","TW","US","VN"]);
    expect(coverage("HK").baseline).toEqual([2024, 2025, 2026, 2027, 2028]);
  });
  it("spot checks", () => {
    expect(dayInfo("2026-02-17", "HK")).toMatchObject({ kind: "public_holiday", source: "baseline" });
    expect(dayInfo("2026-01-12", "JP")).toMatchObject({ kind: "public_holiday" });   // 成人の日, 2nd Monday of Jan
    expect(dayInfo("2026-05-25", "US")).toMatchObject({ kind: "public_holiday" });   // Memorial Day
    expect(dayInfo("2026-04-03", "GB")).toMatchObject({ kind: "public_holiday" });    // Good Friday
    expect(dayInfo("2026-10-03", "DE")).toMatchObject({ kind: "public_holiday" });   // Tag der Deutschen Einheit (Saturday)
    expect(dayInfo("2026-07-14", "FR")).toMatchObject({ kind: "public_holiday" });
    expect(dayInfo("2026-10-03", "KR")).toMatchObject({ kind: "public_holiday" });   // 개천절
    expect(dayInfo("2026-09-02", "VN")).toMatchObject({ kind: "public_holiday" });    // Quốc khánh
    expect(dayInfo("2026-08-09", "SG")).toMatchObject({ kind: "public_holiday" });    // National Day
  });
  it("every holiday carries en + native name and a source", () => {
    for (const r of regions()) for (const h of holidays(r, 2026)) {
      expect(h.holiday.name.en).toBeTruthy();
      expect(Object.keys(h.holiday.name).length).toBeGreaterThanOrEqual(2);
      expect(["official", "baseline", "predicted"]).toContain(h.source);
    }
  });
  it("workday arithmetic works across regions", () => {
    expect(nextWorkday("US", "2026-05-22")).toBe("2026-05-26"); // Fri → skip weekend + Memorial Day
    expect(nextWorkday("JP", "2026-01-09")).toBe("2026-01-13"); // Fri → skip weekend + 成人の日
  });
});
