import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { solarTerms, solarTermAt, solarTermOnDay, SOLAR_TERM_NAMES } from "../src";

const fx = JSON.parse(readFileSync(new URL("../../../fixtures/solar-terms-1900-2100.json", import.meta.url), "utf8"));

function bj(d: Date): string { // format instant as Beijing time ISO, matching fixtures
  return new Date(d.getTime() + 8 * 3600_000).toISOString().replace(".000Z", "+08:00");
}

describe("solar terms 1900-2100", () => {
  it("every instant matches the fixture exactly", () => {
    let bad = 0;
    for (const [year, rows] of Object.entries(fx.years) as [string, [string, string, number][]][]) {
      const got = solarTerms(Number(year));
      rows.forEach(([name, instant], i) => {
        if (got[i].name.zh !== name || bj(got[i].at) !== instant) bad++;
      });
    }
    expect(bad).toBe(0);
  });

  it("cross-check against second reference stays under 60 s", () => {
    expect(fx.max_diff_seconds).toBeLessThan(60);
  });

  it("2026 立春 is 2026-02-04 04:01:51 Beijing time", () => {
    const t = solarTermOnDay("2026-02-04");
    expect(t?.name.zh).toBe("立春");
    expect(bj(t!.at)).toBe("2026-02-04T04:01:51+08:00");
    expect(solarTermOnDay("2026-02-05")).toBeNull();
  });

  it("current/next across the year boundary", () => {
    const r = solarTermAt(new Date("2026-01-02T00:00:00+08:00"));
    expect(r.current.name.zh).toBe("冬至"); expect(r.current.year).toBe(2025);
    expect(r.next.name.zh).toBe("小寒"); expect(r.next.year).toBe(2026);
  });

  it("name table has 24 entries with longitudes stepping by 15°", () => {
    expect(SOLAR_TERM_NAMES).toHaveLength(24);
    SOLAR_TERM_NAMES.forEach((n, i) => expect(n.longitude).toBe((285 + 15 * i) % 360));
  });
});
