import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { solarToLunar, lunarToSolar, dayGanZhi } from "../src";

const fx = JSON.parse(readFileSync(new URL("../../../fixtures/lunar-1900-2100.json", import.meta.url), "utf8"));
const rows: [string, number, number, number, number, string, string][] = fx.rows;

describe("lunar 1900-2100 against fixtures", () => {
  it("solar -> lunar for every day", () => {
    const bad: string[] = [];
    for (const [solar, ly, lm, ld, leap, ygz, dgz] of rows) {
      const [y, m, d] = solar.split("-").map(Number);
      const r = solarToLunar([y, m, d]);
      if (r.year !== ly || r.month !== lm || r.day !== ld || r.leap !== !!leap || r.yearGanZhi !== ygz || r.dayGanZhi !== dgz)
        bad.push(`${solar}: got ${r.year}/${r.leap ? "閏" : ""}${r.month}/${r.day} ${r.yearGanZhi} ${r.dayGanZhi}, want ${ly}/${leap ? "閏" : ""}${lm}/${ld} ${ygz} ${dgz}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it("lunar -> solar round-trips every day", () => {
    let bad = 0;
    for (const [solar, ly, lm, ld, leap] of rows) {
      const [y, m, d] = lunarToSolar({ year: ly, month: lm, day: ld, leap: !!leap });
      if (`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` !== solar) bad++;
    }
    expect(bad).toBe(0);
  });

  it("well-known dates", () => {
    expect(solarToLunar("2026-02-17")).toMatchObject({ year: 2026, month: 1, day: 1, yearGanZhi: "丙午", zodiac: "马", monthName: "正月", dayName: "初一" });
    expect(solarToLunar("2033-12-22")).toMatchObject({ year: 2033, month: 11, leap: true, monthName: "閏冬月" });
    expect(dayGanZhi("1900-01-31")).toBe("甲辰");
  });

  it("rejects invalid input", () => {
    expect(() => solarToLunar("1900-01-01")).toThrow(RangeError);
    expect(() => lunarToSolar({ year: 2026, month: 5, day: 1, leap: true })).toThrow(/Invalid lunar month/);
    expect(() => lunarToSolar({ year: 2026, month: 2, day: 30, leap: false })).toThrow(/Invalid lunar day/);
  });
});
