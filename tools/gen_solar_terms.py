"""Solar-term instants 1900-2100 (Beijing time, +08:00) from sxtwl, cross-checked against lunar_python.
Writes fixtures/solar-terms-1900-2100.json and the compact runtime table packages/core/src/data/solar-terms.json
(seconds since Jan 1 00:00 UTC of the year, one UTC instant per term)."""
import json, datetime, sxtwl
from importlib.metadata import version as _v


def _versions():
    """Record what generated this fixture — otherwise a pin in tools/requirements.txt is a guess."""
    out = {}
    for pkg in ("sxtwl", "lunar_python"):
        try: out[pkg] = _v(pkg)
        except Exception: out[pkg] = "unknown"
    return out

from lunar_python import Lunar

NAMES = ["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至",
         "小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"]
SX_ORDER = ["冬至","小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种",
            "夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪"]
LP_KEY = {"小寒":"XIAO_HAN","大寒":"DA_HAN","冬至":"DONG_ZHI"}  # lunar_python keys for this year's Jan/Dec terms

BJ = datetime.timezone(datetime.timedelta(hours=8))
fixtures, table, maxdiff, worst = {}, {}, 0, None
for year in range(1900, 2101):
    got = {}
    for j in list(sxtwl.getJieQiByYear(year-1)) + list(sxtwl.getJieQiByYear(year)):
        t = sxtwl.JD2DD(j.jd)
        if int(t.Y) != year: continue
        name = SX_ORDER[j.jqIndex]
        got[name] = datetime.datetime(int(t.Y), int(t.M), int(t.D), int(t.h), int(t.m), 0, tzinfo=BJ) + datetime.timedelta(seconds=round(t.s))
    assert len(got) == 24, (year, len(got))
    # lunar_python: gather every instant from neighbouring lunar years, match by nearest instant.
    lp_all = []
    for yy in (year - 1, year, year + 1):
        for k, v in Lunar.fromYmd(yy, 6, 1).getJieQiTable().items():
            lp_all.append(datetime.datetime.strptime(v.toYmdHms(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=BJ))
    row, secs = [], []
    y0 = datetime.datetime(year, 1, 1, tzinfo=datetime.timezone.utc)
    for name in NAMES:
        dt = got[name]
        other = min(lp_all, key=lambda o: abs((o - dt).total_seconds())); s = other.isoformat()
        diff = abs((dt - other).total_seconds())
        if diff > maxdiff: maxdiff, worst = diff, (year, name, dt.isoformat(), s)
        row.append([name, dt.isoformat(), int(diff)])
        secs.append(int((dt - y0).total_seconds()))
    fixtures[year] = row
    table[year] = secs

json.dump({"source": "sxtwl", "source_versions": _versions(), "cross_check": "lunar_python", "tz": "+08:00", "max_diff_seconds": maxdiff,
           "columns": ["name", "instant", "diff_seconds_vs_lunar_python"], "years": fixtures},
          open("fixtures/solar-terms-1900-2100.json", "w"), ensure_ascii=False, indent=0)
json.dump(table, open("packages/core/src/data/solar-terms.json", "w"), separators=(",", ":"))
print("years", len(table), "max diff vs lunar_python (s):", maxdiff, worst)
