"""Baseline holiday data for regions without hand-entered official schedules.
Source: python-holidays (MIT). Written as source="baseline" — to be upgraded to "official" per year
once checked against the government gazette. Regenerate: python3 tools/gen_holidays_baseline.py"""
import json, re, datetime, sys, holidays
sys.path.insert(0, "tools"); from festivals import classify, BCP47
DATA_VERSION = datetime.date.today().strftime("%Y.%m.%d")

YEARS = range(2024, 2029)
REGIONS = {  # code: (display names, native language code, weekend JS weekdays, IANA tz, default kind, subdivisions)
    "HK": ({"zh": "香港", "en": "Hong Kong"}, "zh_HK", [6, 0], "Asia/Hong_Kong", "public", []),
    "MO": ({"zh": "澳门", "en": "Macao"}, "zh_MO", [6, 0], "Asia/Macau", "public", []),
    "TW": ({"zh": "台湾", "en": "Taiwan"}, "zh_TW", [6, 0], "Asia/Taipei", "public", []),
    "JP": ({"zh": "日本", "en": "Japan"}, "ja", [6, 0], "Asia/Tokyo", "public", []),
    "KR": ({"zh": "韩国", "en": "South Korea"}, "ko", [6, 0], "Asia/Seoul", "public", []),
    "VN": ({"zh": "越南", "en": "Vietnam"}, "vi", [6, 0], "Asia/Ho_Chi_Minh", "public", []),
    "SG": ({"zh": "新加坡", "en": "Singapore"}, "en_SG", [6, 0], "Asia/Singapore", "public", []),
    "US": ({"zh": "美国", "en": "United States"}, "en_US", [6, 0], "America/New_York", "federal", "ALL"),
    "GB": ({"zh": "英国", "en": "United Kingdom"}, "en_GB", [6, 0], "Europe/London", "bank", ["ENG", "WLS", "SCT", "NIR"]),
    "DE": ({"zh": "德国", "en": "Germany"}, "de", [6, 0], "Europe/Berlin", "public", "ALL"),
    "FR": ({"zh": "法国", "en": "France"}, "fr", [6, 0], "Europe/Paris", "public", []),
}
SUBSTITUTE = re.compile(r"observed|substitute|振替|in lieu|alternative holiday|day off for", re.I)

# One-off / speculative entries the upstream library carries that are not statutory holidays we are
# willing to publish. Matched against the English name. Keep this list short and justify each line —
# it is a hand override of the baseline source, so it belongs in review, not in a silent filter.
EXCLUDE = [
    # A contingent bank holiday that only exists if Scotland reaches a final it has not qualified for.
    re.compile(r"participation in the FIFA World Cup", re.I),
]

def build_year(code, y, native, default_kind, subdiv=None):
    en = holidays.country_holidays(code, years=y, language="en_US", subdiv=subdiv)
    nat = holidays.country_holidays(code, years=y, language=native, subdiv=subdiv)
    zh = holidays.country_holidays(code, years=y, language="zh_CN", subdiv=subdiv) if "zh_CN" in en.supported_languages else None
    by_name, untranslated, excluded, slugs = {}, set(), set(), {}
    for d in sorted(en):
        for en_name, nat_name in zip(en.get_list(d), nat.get_list(d)):
            name = {"en": en_name, BCP47[native]: nat_name}
            if zh is not None:
                zl = zh.get_list(d)
                if zl: name["zh-Hans"] = zl[min(len(zl) - 1, en.get_list(d).index(en_name))]
            if any(x.search(en_name) for x in EXCLUDE):
                excluded.add(en_name); continue
            fid, zh_guess = classify(en_name)
            fallback = False
            if "zh-Hans" not in name:
                if zh_guess: name["zh-Hans"] = zh_guess
                else: name["zh-Hans"] = en_name; fallback = True; untranslated.add(en_name)
            kind = "substitute" if SUBSTITUTE.search(en_name) else default_kind
            key = slug(en_name, slugs)
            entry = by_name.setdefault(key, {"id": key, "festival": fid, "kind": kind, "name": name, **({"name_fallback": True} if fallback else {}), "days": []})
            entry["days"].append(d.isoformat())
    if excluded: print(f"  {code} {y}{'/' + subdiv if subdiv else ''}: excluded {sorted(excluded)}")
    return {"source": "baseline", "source_ref": f"python-holidays {holidays.__version__}", "holidays": list(by_name.values()), "workdays": []}, untranslated
def slug(s, taken=None):
    """Stable kebab-case id, cut at a word boundary (never mid-word) and de-duplicated."""
    full = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "holiday"
    out = full
    if len(out) > 48:
        out = full[:48].rsplit("-", 1)[0] if "-" in full[:48] else full[:48]
    out = out.strip("-") or "holiday"
    if taken is not None and out in taken and taken[out] != s:
        n = 2
        while f"{out}-{n}" in taken: n += 1
        out = f"{out}-{n}"
    if taken is not None: taken[out] = s
    return out

for code, (names, native, weekend, tz, default_kind, subdivs) in REGIONS.items():
    out = {"region": code, "name": {"zh-Hans": names["zh"], "en": names["en"]}, "weekend": weekend, "tz": tz,
           "data_version": DATA_VERSION, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
           "verified_until": None,
           "baseline_note": f"Generated from python-holidays {holidays.__version__}; not yet verified against the official gazette.",
           "years": {}}
    untranslated = set()
    for y in YEARS:
        sched, u = build_year(code, y, native, default_kind); untranslated |= u
        out["years"][str(y)] = sched
    # subdivisions: store only holidays that are NOT in the national list (as a diff)
    if subdivs:
        codes_sub = list(holidays.country_holidays(code).subdivisions) if subdivs == "ALL" else subdivs
        codes_sub = [c for c in codes_sub if re.fullmatch(r"[A-Z]{2,3}", c)]
        out["subdivisions"] = {}
        for sc in codes_sub:
            years = {}
            for y in YEARS:
                sched, u = build_year(code, y, native, default_kind, subdiv=sc); untranslated |= u
                national = {d for h in out["years"][str(y)]["holidays"] for d in h["days"]}
                extra = []
                for h in sched["holidays"]:
                    days = [d for d in h["days"] if d not in national]
                    if days: extra.append({**h, "days": days})
                years[str(y)] = {"source": "baseline", "source_ref": sched["source_ref"], "holidays": extra, "workdays": []}
            out["subdivisions"][sc] = {"years": years}
    json.dump(out, open(f"packages/core/src/data/holidays/{code}.json", "w"), ensure_ascii=False, indent=1)
    print(code, {y: len(v["holidays"]) for y, v in out["years"].items()}, "untranslated:", sorted(untranslated))

# TS side: core bundles CN only; every other region is an opt-in side-effect import.
with open("packages/core/src/data/holidays/index.ts", "w") as f:
    f.write('import CN from "./CN.json";\nexport const HOLIDAY_DATA = { CN } as const;\n')
for c in REGIONS:
    with open(f"packages/core/src/regions/{c}.ts", "w") as f:
        f.write(f'import data from "../data/holidays/{c}.json";\nimport {{ registerRegion, type RegionData }} from "../holidays";\nregisterRegion(data as unknown as RegionData);\nexport default data;\n')
with open("packages/core/src/regions/all.ts", "w") as f:
    for c in REGIONS: f.write(f'import "./{c}";\n')
    f.write("export {};\n")
