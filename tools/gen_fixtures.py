"""Generate lunar test vectors 1900-2100 from two independent references (sxtwl, lunar_python).
Any disagreement is written to fixtures/lunar-disagreements.json for manual adjudication."""
import json, datetime, sxtwl
from importlib.metadata import version as _v


def _versions():
    """Record what generated this fixture — otherwise a pin in tools/requirements.txt is a guess."""
    out = {}
    for pkg in ("sxtwl", "lunar_python"):
        try: out[pkg] = _v(pkg)
        except Exception: out[pkg] = "unknown"
    return out

from lunar_python import Solar

GAN="甲乙丙丁戊己庚辛壬癸"; ZHI="子丑寅卯辰巳午未申酉戌亥"
start, end = datetime.date(1900,1,31), datetime.date(2100,12,31)
rows, disagreements = [], []
d = start
while d <= end:
    a = sxtwl.fromSolar(d.year, d.month, d.day)
    ly, lm, ld, leap = a.getLunarYear(True), a.getLunarMonth(), a.getLunarDay(), a.isLunarLeap()
    yg = a.getYearGZ(True); gz = GAN[yg.tg]+ZHI[yg.dz]
    dg = a.getDayGZ(); dgz = GAN[dg.tg]+ZHI[dg.dz]
    b = Solar.fromYmd(d.year, d.month, d.day).getLunar()
    bm = b.getMonth(); bleap = bm < 0
    ref2 = (b.getYear(), abs(bm), b.getDay(), bleap, b.getYearInGanZhi())
    ref1 = (ly, lm, ld, leap, gz)
    if ref1 != ref2:
        disagreements.append({"solar": d.isoformat(), "sxtwl": ref1, "lunar_python": ref2})
    rows.append([d.isoformat(), ly, lm, ld, 1 if leap else 0, gz, dgz])
    d += datetime.timedelta(days=1)

json.dump({"source": ["sxtwl", "lunar_python"], "source_versions": _versions(), "columns": ["solar","lunarYear","lunarMonth","lunarDay","leap","yearGanZhi","dayGanZhi"], "rows": rows},
          open("fixtures/lunar-1900-2100.json","w"), ensure_ascii=False, separators=(",",":"))
json.dump(disagreements, open("fixtures/lunar-disagreements.json","w"), ensure_ascii=False, indent=1)

# Derive per-year compact table: [newYearSolarDate, leapMonth(0=none), monthLengths[] in order incl. leap month]
years = {}
for solar, ly, lm, ld, leap, gz, dgz in rows:
    y = years.setdefault(ly, {})
    key = (lm, leap)
    y[key] = y.get(key, 0) + 1
    if lm == 1 and not leap and ld == 1: y["newYear"] = solar
table = {}
for ly in sorted(k for k in years if 1900 <= k <= 2100):
    y = years[ly]
    if "newYear" not in y: continue
    leapm = next((k[0] for k in y if isinstance(k, tuple) and k[1]), 0)
    order = []
    for m in range(1, 13):
        order.append(y[(m, 0)])
        if m == leapm: order.append(y[(m, 1)])
    if ly == 2100: order = order  # last year truncated at 2100-12-31; documented
    table[ly] = [y["newYear"], leapm, order]
json.dump(table, open("fixtures/lunar-year-table.json","w"), ensure_ascii=False, separators=(",",":"))
print("rows", len(rows), "disagreements", len(disagreements), "years", len(table))
