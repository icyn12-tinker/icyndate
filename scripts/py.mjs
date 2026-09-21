#!/usr/bin/env node
/**
 * Run a Python tool with the right interpreter, so `npm run check` works without activating anything.
 *
 *   node scripts/py.mjs tools/check_cn_holidays.py
 *
 * Order: the repo's .venv (macOS/Linux or Windows layout) → python3 → python.
 * The dev dependencies (tools/requirements.txt) usually live in .venv, and a shell where it was never
 * activated would otherwise pick the system Python and fail the release gate for no real reason.
 * Also covers Windows, where `python3` is often only a Microsoft Store stub.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const candidates = [".venv/bin/python3", ".venv/bin/python", ".venv/Scripts/python.exe", "python3", "python"];
const works = (py) => (py.includes("/") ? existsSync(py) : true) &&
  spawnSync(py, ["-c", "import sys; sys.exit(0)"], { stdio: "ignore" }).status === 0;

const py = candidates.find(works);
if (!py) { console.error("py.mjs: no working Python found (.venv, python3, python)"); process.exit(1); }
if (py.startsWith(".venv")) console.log(`(python: ${py})`);

const r = spawnSync(py, process.argv.slice(2), { stdio: "inherit" });
process.exit(r.status ?? 1);
