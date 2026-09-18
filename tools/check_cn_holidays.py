"""Cross-check data/holidays/CN.json day status against the `chinesecalendar` package. Exit 1 on any mismatch.

Part of the release gate (`npm run check`). Needs a dev dependency:
    python3 -m pip install -r tools/requirements.txt
"""
import json, datetime, sys

try:
    import chinese_calendar as cc
except ModuleNotFoundError:
    sys.exit("check_cn_holidays: `chinesecalendar` is not installed, so the CN holiday data was NOT verified.\n"
             "  python3 -m pip install -r tools/requirements.txt\n"
             "  (externally-managed environment? add --break-system-packages, or use a venv)\n"
             "This check is part of the release gate — do not publish on an unverified table.")

data = json.load(open("packages/core/src/data/holidays/CN.json"))
bad, checked = [], 0
for y, s in data["years"].items():
    hol = {d for h in s["holidays"] for d in h["days"]}; wk = set(s["workdays"])
    d = datetime.date(int(y), 1, 1)
    while d.year == int(y):
        iso = d.isoformat()
        ours = "off" if iso in hol else ("work" if iso in wk else ("off" if d.weekday() >= 5 else "work"))
        try:
            theirs = "work" if cc.is_workday(d) else "off"
        except NotImplementedError:
            # chinesecalendar only covers years it has notices for; ours may run ahead of it.
            d += datetime.timedelta(days=1); continue
        checked += 1
        if ours != theirs: bad.append((iso, ours, theirs))
        d += datetime.timedelta(days=1)

print("years", list(data["years"]), f"· {checked} days checked · mismatches:", bad)
if not checked:
    sys.exit("check_cn_holidays: chinesecalendar covered none of our years — nothing was verified.")
sys.exit(1 if bad else 0)
