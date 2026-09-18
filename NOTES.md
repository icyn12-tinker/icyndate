# Data notes / adjudication log

## 2057 九月 boundary

`sxtwl` and `lunar_python` disagree on 30 days in 2057: whether 九月初一 is 2057-09-28 or 2057-09-29.
This is the well-known 2057 case — the new moon falls within seconds of midnight Beijing time, so the answer
depends on the ephemeris precision and ΔT model used. Our table currently follows `sxtwl` (新月 on 09-28).
Revisit when the solar-term/astronomy module lands and can compute the instant directly; until then the
API should surface this as `confidence: "disputed"` for those 30 days.

## 2100

The table ends at 2100-12-31 (`MAX_DATE`), which is mid-way through lunar 2100 腊月; the last
month-length entry is therefore truncated (1 day) and is **not** the real length of that month.
The conversion for that date is correct — it is 腊月初一 — so it stays in range and in the fixtures;
what we refuse to do is report the artefact as a length. `monthLength` is `null` there,
`lunarMonthLength(2100, 12)` throws "length unknown", and `lunarToSolar` for day ≥ 2 of that month
throws "extends past 2100-12-31". Dates after 2100-12-31 throw `RangeError` as before.
Extending the table by one lunar month would remove the special case entirely — worth doing when the
astronomy module lands.

## Year boundary convention

Lunar year and year 干支 change at Chinese New Year (正月初一), not at 立春. This is the calendar convention;
the 命理 convention (立春) can be exposed later as an option.

## Reference versions

Dependencies are split by cost: `tools/requirements.txt` is what `npm run check` needs (one pure-Python
package), `tools/requirements-generators.txt` is what regenerating data needs (`sxtwl` is a C++
extension and wants a working compiler *and* linker — on macOS it fails to link when Homebrew's LLVM
shadows Apple's `ld`). Nobody should need a compiler to run the tests or cut a release.

Two caveats on the pins worth knowing:

- The committed fixtures were generated *before* that pin existed, so we cannot prove which sxtwl /
  lunar_python versions produced them. Both generators now stamp `source_versions` into the fixture
  header, so the next regeneration settles it — until then treat the pin as "known good", not as
  "what produced these bytes".
- `chinesecalendar` is a floor (`>=1.11.0`), not a pin: it is a data package, and a newer release
  carries more years of State Council notices, i.e. verifies more of our table. `check_cn_holidays.py`
  prints how many days it actually compared (1,096 for 2024–2026) and fails if that number is zero,
  so a version that covers nothing cannot pass as a green gate.

## Solar terms

Instants come from sxtwl (寿星万年历 algorithm: VSOP87 + ΔT), cross-checked against lunar_python for all
4,824 instants 1900–2100. Maximum disagreement: 55 s (2050 大寒). Both are well inside the 1-minute release gate,
but before the first public release spot-check ~20 instants against 紫金山天文台《中国天文年历》published values,
especially years far from the present where ΔT extrapolation dominates the error.

The 2057 九月 dispute (above) should be settled the same way once a new-moon instant is available — either by adding
a lunation module or by taking the published 朔 time for 2057-09-28/29.

## CN holidays

2024–2026 entered from the State Council notices (source_ref in data). Verified day-by-day against the
`chinesecalendar` package (`tools/check_cn_holidays.py`): 0 mismatches. Predicted years contain only the 13
statutory days of the 2024-revised 《放假办法》 and an empty `workdays` list — the API must not present a
predicted year's weekends as certain, since 调休 may turn any nearby weekend into a workday.

**Prediction is forward-only** (`canPredict` in `holidays.ts`): the predictor runs only for years after
`verified_until`, i.e. 2027 and later. It must never run backwards. The rules it encodes are the *current*
ones, and applying them to a past year is wrong three ways over: 清明/端午/中秋 became statutory only in
2008, 春节 runs 除夕..初三 only from 2025, and nothing of this existed before 1949 — and for those years the
real schedule was published anyway, so a guess is not just unverified but flatly incorrect. Past uncovered
years return `{ available: false }` with a reason saying they are never predicted. Regression test:
"prediction is forward-only" in `holidays.test.ts`. When a new official year is entered, bump
`verified_until` and the prediction floor moves with it automatically.

## Baseline regions (HK MO TW JP KR VN SG US GB DE FR)

Generated from python-holidays 0.104 for 2024–2028 and labelled `baseline`. Known gaps to close before calling
any of them `official`:
- TW: 補班 (make-up workdays) are not modelled by the library — `workdays` is empty. Enter from 行政院人事行政總處 yearly notice.
- KR: substitute-holiday rules changed several times; verify against 인사혁신처 notice for each year.
- HK/MO: gazette publishes the following year's list ~mid-year; verify and flip to `official`.
- US/DE: country-level only; state/Land holidays (e.g. DE Reformationstag, US state days) are a later `US-CA`-style layer.
- GB: England & Wales only in this baseline; Scotland/NI differ. One contingent entry
  ("Scotland's participation in the FIFA World Cup final", 2026-06-15) is filtered out via `EXCLUDE`
  in the generator — a bank holiday conditional on qualification is not something we publish as fact.
- `name.en` for the en_US / en_GB / en_SG regions holds the *localised* English name, because
  `BCP47["en_SG"]` is `"en"` and the native name overwrites the en_US one in `build_year`. So e.g. SG's
  `hari-raya-puasa` has `name.en = "Hari Raya Puasa"` while its id came from the en_US name
  ("Eid al-Fitr"), and those regions carry one fewer name key than intended. Not fixed yet — fixing it
  changes `name.en` for three regions, so it wants a deliberate pass, not a drive-by.
Chinese-New-Year dates in every East-Asian baseline agree with our own lunar table (checked in tools by hand; add to CI).
