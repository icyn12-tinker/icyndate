Reference generators and data cross-checks. Not part of the shipped package.

Two separate dependency sets, because they cost very differently.

**To build, test and release** you need exactly one package, pure Python, no compiler:

    python3 -m pip install -r tools/requirements.txt
    python3 tools/check_cn_holidays.py      # verifies CN.json against chinesecalendar (release gate)

This is the last step of `npm run check`; everything else in that command (build, tsc, vitest) is
Node-only.

**To regenerate data** — which you only do when a reference version or a source changes, and whose
output is committed — you additionally need the generators:

    python3 -m pip install -r tools/requirements-generators.txt

    python3 tools/gen_fixtures.py           # rewrites fixtures/lunar-*.json
    python3 tools/gen_solar_terms.py        # rewrites fixtures/solar-terms-*.json
    python3 tools/gen_holidays_baseline.py  # rewrites the 11 baseline region files + regions/*.ts

`sxtwl` is a C++ extension built from source when no wheel matches your Python, so this set needs a
working compiler *and* linker. On macOS the link step fails when Homebrew's LLVM shadows Apple's
linker (`ld: error: unknown argument '-dynamic'`); force Apple's toolchain:

    CC=/usr/bin/clang CXX=/usr/bin/clang++ python3 -m pip install -r tools/requirements-generators.txt
