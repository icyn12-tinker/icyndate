#!/usr/bin/env node
/**
 * One-command release for @icyn/date and @icyn/date-mcp.
 *
 *   npm run release -- mcp  patch          # the usual case
 *   npm run release -- core patch
 *   npm run release -- both minor
 *   npm run release -- mcp  patch --dry-run   # show the plan, change nothing
 *
 * Every step here exists because we got it wrong once by hand (see docs/RELEASE.md):
 *  - checks `npm whoami` first: an expired CLI login makes publish fail with a misleading 404
 *  - a failed publish does NOT use up a version number, so re-running after a failure reuses the
 *    unpublished version instead of bumping again
 *  - always core before mcp (mcp depends on core), and waits until core is visible on npm
 *  - core alone may only take a patch bump; minor/major must ship with mcp (its ^range would break)
 *  - keeps server.json in step with the mcp version (the MCP Registry rejects a mismatch)
 *  - the git tag name becomes the MCP Registry version, so only mcp releases get a `v*` tag
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const PKGS = {
  core: { name: "@icyn/date", file: "packages/core/package.json" },
  mcp:  { name: "@icyn/date-mcp", file: "packages/mcp/package.json" },
};
const SERVER_JSON = "server.json";

// ---------- helpers ----------
const sh = (cmd, { capture = false, allowFail = false } = {}) => {
  try {
    const out = execSync(cmd, { stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf8" });
    return capture ? out.replace(/\s+$/, "") : "";   // trimEnd only: leading spaces are meaningful in git porcelain
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
};
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const writeJSON = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2) + "\n");
const die = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };
const inc = (v, type) => {
  if (!/^\d+\.\d+\.\d+$/.test(v)) die(`不支持的版本号格式 ${v}（只支持 x.y.z）`);
  const [a, b, c] = v.split(".").map(Number);
  return type === "major" ? `${a + 1}.0.0` : type === "minor" ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
};
const published = (name) => {
  const out = sh(`npm view ${name} versions --json`, { capture: true, allowFail: true });
  if (!out) return [];                      // never published (E404) or offline
  const v = JSON.parse(out);
  return Array.isArray(v) ? v : [v];        // npm returns a bare string when there is one version
};

// ---------- args ----------
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith("--")));
const [target, bump] = args.filter(a => !a.startsWith("--"));
const DRY = flags.has("--dry-run"), YES = flags.has("--yes");
if (!["mcp", "core", "both"].includes(target) || !["patch", "minor", "major"].includes(bump))
  die("用法：npm run release -- <mcp|core|both> <patch|minor|major> [--dry-run] [--yes]");
if (target === "core" && bump !== "patch")
  die(`单独发 core 只允许 patch。${bump} 会让 @icyn/date-mcp 的 "^" 依赖范围失配，请用：npm run release -- both ${bump}`);

// ---------- preflight ----------
console.log(DRY ? "\n[dry-run] 只展示计划，不改任何东西\n" : "\n发布前检查\n");
const problems = [];

const branch = sh("git --no-optional-locks rev-parse --abbrev-ref HEAD", { capture: true, allowFail: true });
if (branch !== "main") problems.push(`当前分支是 ${branch}，需要在 main 上发布`);

const dirty = sh("git --no-optional-locks status --porcelain", { capture: true, allowFail: true });
if (dirty) problems.push(`工作区有未提交的改动，先提交：\n${dirty.split("\n").map(l => "      " + l).join("\n")}`);

if (sh("git fetch --quiet origin main", { capture: true, allowFail: true }) !== null) {
  const behind = sh("git --no-optional-locks rev-list --count HEAD..origin/main", { capture: true, allowFail: true });
  if (behind && behind !== "0") problems.push(`本地落后 origin/main ${behind} 个提交，先 git pull（否则 npm 发完了才发现推不上去）`);
} else console.log("  ⚠ git fetch 失败，跳过「是否落后远端」的检查");

const who = sh("npm whoami", { capture: true, allowFail: true });
if (!who) problems.push("npm 命令行未登录（网站登录不算）。先跑 npm login —— 不登录的话 publish 会报一个误导性的 404");
else console.log(`  npm 身份：${who}`);

if (problems.length) {
  problems.forEach(p => console.log(`  ✗ ${p}`));
  if (!DRY) die("以上问题解决后重跑同一条命令");
  console.log("  （dry-run：继续展示计划）");
}

// ---------- plan ----------
const selected = target === "both" ? ["core", "mcp"] : [target];
const plan = {};
for (const key of selected) {
  const { name, file } = PKGS[key];
  const local = readJSON(file).version;
  const onNpm = published(name);
  const resuming = !onNpm.includes(local);
  plan[key] = { name, file, from: local, to: resuming ? local : inc(local, bump), resuming };
}
const mcpDep = plan.core && plan.mcp ? `^${plan.core.to}` : null;
const tag = plan.mcp ? `v${plan.mcp.to}` : `core-v${plan.core.to}`;

console.log("\n发布计划");
for (const p of Object.values(plan))
  console.log(`  ${p.name.padEnd(16)} ${p.resuming ? `${p.to}（尚未发布，沿用——上次发布没成功，不再递增）` : `${p.from} → ${p.to}`}`);
if (mcpDep) console.log(`  @icyn/date-mcp 对 @icyn/date 的依赖 → ${mcpDep}`);
if (plan.mcp) console.log(`  server.json      version / packages[0].version → ${plan.mcp.to}`);
console.log(`  git tag          ${tag}${plan.mcp ? "  → 触发 publish-mcp-registry，同步到官方 MCP Registry" : "  （不以 v 开头，不触发 Registry）"}`);
console.log(`  顺序             ${selected.map(k => PKGS[k].name).join(" → ")}`);

const lastTag = sh("git --no-optional-locks describe --tags --abbrev=0 --match \"v*\"", { capture: true, allowFail: true });
if (lastTag) {
  const log = sh(`git --no-optional-locks log ${lastTag}..HEAD --oneline`, { capture: true, allowFail: true });
  if (log) console.log(`\n自 ${lastTag} 以来的提交（可作为 GitHub Release 说明的底稿）\n${log.split("\n").map(l => "  " + l).join("\n")}`);
}

if (DRY) { console.log("\n[dry-run] 结束。去掉 --dry-run 正式执行。\n"); process.exit(0); }

if (!YES) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("\n确认发布？每个包发布时浏览器会弹 passkey 验证。[y/N] ")).trim().toLowerCase();
  rl.close();
  if (ans !== "y") die("已取消，什么都没改");
}

// ---------- gate ----------
console.log("\n▶ npm run check（build → tsc → 测试 → CN 对拍）");
try { sh("npm run check"); } catch { die("npm run check 未通过，什么都没发布"); }

// ---------- write versions ----------
if (mcpDep) {
  const m = readJSON(PKGS.mcp.file);
  m.dependencies["@icyn/date"] = mcpDep;
  writeJSON(PKGS.mcp.file, m);
}
for (const p of Object.values(plan))
  if (!p.resuming) sh(`npm version ${p.to} -w ${p.name} --no-git-tag-version`, { capture: true });
if (plan.mcp) {
  const s = readJSON(SERVER_JSON);
  s.version = plan.mcp.to;
  if (s.packages?.[0]) s.packages[0].version = plan.mcp.to;
  writeJSON(SERVER_JSON, s);
}
if (mcpDep) sh("npm install --package-lock-only --no-audit --no-fund", { capture: true });

// ---------- publish (core first) ----------
for (const key of selected) {
  const p = plan[key];
  console.log(`\n▶ npm publish ${p.name}@${p.to}`);
  try { sh(`npm publish -w ${p.name} --access public`); }
  catch {
    die(`${p.name}@${p.to} 发布失败。版本号没有被消耗——修好问题后直接重跑同一条命令，脚本会沿用 ${p.to}。\n` +
        `  常见原因：npm 登录过期（npm login）、passkey 验证超时。`);
  }
  if (key === "core" && plan.mcp) {
    process.stdout.write("  等 @icyn/date 在 npm 上可见");
    let ok = false;
    for (let i = 0; i < 24 && !ok; i++) {
      ok = sh(`npm view @icyn/date@${p.to} version`, { capture: true, allowFail: true }) === p.to;
      if (!ok) { process.stdout.write("."); execSync(process.platform === "win32" ? "ping -n 6 127.0.0.1 >NUL" : "sleep 5"); }
    }
    console.log(ok ? " ok" : " 超时（继续，但 mcp 刚发布的几分钟内安装可能失败）");
  }
}

// ---------- git ----------
const files = [...Object.values(plan).map(p => p.file), "package-lock.json", ...(plan.mcp ? [SERVER_JSON] : [])];
const msg = `release: ${Object.values(plan).map(p => `${p.name}@${p.to}`).join(", ")}`;
console.log(`\n▶ git commit + tag ${tag} + push`);
try {
  sh(`git add ${files.join(" ")}`);
  sh(`git commit -m "${msg}"`);
  sh(`git tag -a ${tag} -m "${msg}"`);
  sh("git push");
  sh(`git push origin ${tag}`);
} catch {
  die(`npm 已发布成功，但 git 步骤失败。手动补完：\n` +
      `  git add ${files.join(" ")}\n  git commit -m "${msg}"\n  git tag -a ${tag} -m "${msg}"\n  git push && git push origin ${tag}`);
}

// ---------- done ----------
console.log("\n✓ 完成");
for (const p of Object.values(plan)) console.log(`  ${p.name}@${p.to}  https://www.npmjs.com/package/${p.name}`);
if (plan.mcp) {
  console.log("  MCP Registry 由 tag 触发的 workflow 同步，一两分钟后验证：");
  console.log('    curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=icyn-date"');
}
console.log(`  最后去 GitHub 把 ${tag} 转成 Release：https://github.com/icyn12-tinker/icyndate/releases/new?tag=${tag}\n`);
