import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { festivals as knownFromCode } from "../src";
import "../src/regions/all";
import { FESTIVAL_IDS } from "./festival-ids";

const dir = new URL("../src/data/holidays/", import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith(".json"));
const BCP = /^[a-z]{2}(-[A-Za-z]{2,4})*$/;

describe("data lint (every region file)", () => {
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    describe(file, () => {
      it("header", () => {
        expect(data.region).toBe(file.replace(".json", ""));
        expect(data.name.en).toBeTruthy(); expect(data.name["zh-Hans"]).toBeTruthy();
        expect(data.tz).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$/);
        expect(data.weekend).toEqual([6, 0]);
        expect(data.data_version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
        expect(["official", "baseline"]).toContain(Object.values(data.years as any)[0] && (Object.values(data.years as any)[0] as any).source);
      });
      const checkYear = (label: string, year: string, y: any, nationalDays?: Set<string>) => {
        it(`${label} ${year}`, () => {
          const seen = new Map<string, string>();
          for (const h of y.holidays) {
            expect(h.id, "id").toMatch(/^[a-z0-9-]+$/);
            expect(h.name.en, `${h.id} en`).toBeTruthy();
            expect(h.name["zh-Hans"], `${h.id} zh-Hans`).toBeTruthy();
            for (const k of Object.keys(h.name)) expect(k, `${h.id} lang key`).toMatch(BCP);
            if (h.festival) expect(FESTIVAL_IDS, `${h.id} festival ${h.festival}`).toContain(h.festival);
            expect(["public", "federal", "bank", "substitute", "observance"]).toContain(h.kind);
            for (const d of h.days) {
              expect(d, "date format").toMatch(/^\d{4}-\d{2}-\d{2}$/);
              expect(d.slice(0, 4), `${h.id} year`).toBe(year);
              // two holidays may share a day (TW 兒童節 = 清明, KR 어린이날 = 부처님오신날) — but never the same id twice
              expect(seen.get(d) === h.id, `${d} listed twice in ${h.id}`).toBe(false);
              seen.set(d, h.id);
              if (nationalDays) expect(nationalDays.has(d), `${d} duplicates national holiday`).toBe(false);
            }
          }
          for (const w of y.workdays) {
            expect(w.slice(0, 4)).toBe(year);
            expect(seen.has(w), `adjusted workday ${w} overlaps holiday`).toBe(false);
          }
          expect(new Set(y.workdays).size).toBe(y.workdays.length);
        });
      };
      for (const [year, y] of Object.entries<any>(data.years)) checkYear("national", year, y);
      for (const [sub, s] of Object.entries<any>(data.subdivisions ?? {})) {
        expect(sub).toMatch(/^[A-Z]{2,3}$/);
        for (const [year, y] of Object.entries<any>(s.years)) checkYear(`sub ${sub}`, year, y, new Set(data.years[year].holidays.flatMap((h: any) => h.days)));
      }
    });
  }
  it("no holiday id is truncated mid-word by the generator's 48-char cut", () => {
    for (const file of files) {
      const data = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
      const ids = new Set<string>();
      const collect = (years: any) => { for (const y of Object.values<any>(years)) for (const h of y.holidays) ids.add(h.id); };
      collect(data.years);
      for (const s of Object.values<any>(data.subdivisions ?? {})) collect(s.years);
      for (const id of ids) expect(id.length, `${file} ${id}`).toBeLessThan(48);
    }
  });

  it("no speculative one-off entries from the baseline source", () => {
    // e.g. python-holidays carries a contingent GB-SCT bank holiday for a World Cup final Scotland
    // has not qualified for. Excluded in tools/gen_holidays_baseline.py; asserted here so a
    // regeneration cannot quietly bring it back.
    for (const file of files) {
      const raw = readFileSync(new URL(file, dir), "utf8");
      expect(raw, file).not.toMatch(/FIFA World Cup/i);
    }
  });

  it("festival ids used in data are all known", () => {
    for (const f of knownFromCode()) expect(FESTIVAL_IDS).toContain(f);
  });
});
