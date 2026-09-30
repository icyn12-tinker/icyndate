// 生成 .ics 订阅源，并与交易所官方休市区间逐天对拍。用法：node feeds/gen-ics.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dayInfo } from "../packages/core/dist/index.js";

const here = new URL(".", import.meta.url);
mkdirSync(new URL("dist/", here), { recursive: true }); // dist/ 被 .gitignore 忽略，CI 的干净检出里没有
const sse = JSON.parse(readFileSync(new URL("sources/sse-closures.json", here)));
const YEARS = [2025, 2026, 2027];
const A_SHARE_YEARS = Object.keys(sse).filter((k) => /^\d{4}$/.test(k)).map(Number);

const next = (d) => new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
const days = (y) => { const out = []; let d = `${y}-01-01`; while (d.startsWith(String(y))) { out.push(d); d = next(d); } return out; };
const compact = (d) => d.replaceAll("-", "");
const esc = (s) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

// 连续的 public_holiday 日合并为一段
function holidayRanges(years) {
  const out = [];
  for (const y of years) for (const d of days(y)) {
    const i = dayInfo(d, "CN");
    if (!i.available || i.kind !== "public_holiday") continue;
    const last = out.at(-1);
    const name = i.holiday?.name?.["zh-Hans"] ?? "假日";
    if (last && next(last.end) === d) { last.end = d; if (!last.names.includes(name)) last.names.push(name); }
    else out.push({ start: d, end: d, names: [name], source: i.source, ref: i.source_ref });
  }
  return out;
}
function adjustedWorkdays(years) {
  return years.flatMap((y) => days(y)).map((d) => ({ d, i: dayInfo(d, "CN") }))
    .filter(({ i }) => i.available && i.kind === "adjusted_workday");
}

function vcal(name, desc, events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//icyn//icyndate feeds//ZH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, `X-WR-CALDESC:${esc(desc)}`, "X-WR-TIMEZONE:Asia/Shanghai", "REFRESH-INTERVAL;VALUE=DURATION:P1D", "X-PUBLISHED-TTL:P1D"];
  for (const e of events) L.push("BEGIN:VEVENT", `UID:${e.uid}@icyndate`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(e.start)}`, `DTEND;VALUE=DATE:${compact(next(e.end))}`,
    `SUMMARY:${esc(e.summary)}`, `DESCRIPTION:${esc(e.description)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  L.push("END:VCALENDAR");
  // RFC 5545 折行：每行 ≤75 字节
  return L.map((line) => { const b = Buffer.from(line); if (b.length <= 75) return line;
    const parts = []; let cur = ""; for (const ch of line) { if (Buffer.byteLength(cur + ch) > (parts.length ? 74 : 75)) { parts.push(cur); cur = ""; } cur += ch; }
    parts.push(cur); return parts.join("\r\n "); }).join("\r\n") + "\r\n";
}
const tag = (s) => (s === "official" ? "" : "（预测）");
const srcLine = (r) => `出处：${r.ref}\n档位：${r.source}\n数据：icyndate`;

// 1) 中国大陆节假日与调休
const hol = holidayRanges(YEARS);
const adj = adjustedWorkdays(YEARS);
const cnEvents = [
  ...hol.map((r) => ({ uid: `cn-hol-${r.start}`, start: r.start, end: r.end, summary: `🏮 ${r.names.join("·")}放假${tag(r.source)}`, description: srcLine(r) })),
  ...adj.map(({ d, i }) => ({ uid: `cn-adj-${d}`, start: d, end: d, summary: `💼 调休上班${tag(i.source)}`, description: srcLine({ ref: i.source_ref, source: i.source }) })),
].sort((a, b) => a.start.localeCompare(b.start));
writeFileSync(new URL("dist/cn-holidays.ics", here), vcal("中国节假日与调休 · icyndate", "中国大陆法定节假日与调休上班日，每条附国务院通知出处；未公布年份标注（预测）。", cnEvents));

// 2) A 股休市（仅含交易所已公告年份）
const aHol = hol.filter((r) => A_SHARE_YEARS.includes(Number(r.start.slice(0, 4))));
const closedSet = new Set(aHol.flatMap((r) => { const o = []; for (let d = r.start; d <= r.end; d = next(d)) o.push(d); return o; }));
const reopen = (d) => { let x = next(d); for (;;) { const w = new Date(x + "T00:00:00Z").getUTCDay(); if (w >= 1 && w <= 5 && !closedSet.has(x)) return x; x = next(x); } };
const aEvents = aHol.map((r) => {
  const y = r.start.slice(0, 4);
  return { uid: `cn-a-closed-${r.start}`, start: r.start, end: r.end, summary: `📉 A股休市：${r.names.join("·")}`,
    description: `沪深北交易所休市，${reopen(r.end)} 起照常开市。\n出处：${sse[y].source}\n${sse[y].url}\n数据：icyndate` };
});
writeFileSync(new URL("dist/cn-a-share-closures.ics", here), vcal("A股休市日历 · icyndate", "沪深北交易所节假日休市安排，与交易所公告逐天核对。周末不单列。", aEvents));

// 3) 对拍：交易所公告区间 vs icyndate 推导区间，逐天
let fail = 0;
for (const y of A_SHARE_YEARS) {
  const official = new Set(sse[y].ranges.flatMap(([s, e]) => { const o = []; for (let d = s; d <= e; d = next(d)) o.push(d); return o; }));
  const ours = new Set(aHol.filter((r) => r.start.startsWith(String(y))).flatMap((r) => { const o = []; for (let d = r.start; d <= r.end; d = next(d)) o.push(d); return o; }));
  const miss = [...official].filter((d) => !ours.has(d)), extra = [...ours].filter((d) => !official.has(d));
  // 交易日对拍：工作日（周一~五）且不在官方休市区间 = 交易日
  let tradeDays = 0; for (const d of days(y)) { const w = new Date(d + "T00:00:00Z").getUTCDay(); if (w >= 1 && w <= 5 && !official.has(d)) tradeDays++; }
  console.log(`${y}: 官方休市 ${official.size} 天, icyndate ${ours.size} 天, 缺 ${miss.length} 多 ${extra.length}; 全年交易日 ${tradeDays}`);
  if (miss.length || extra.length) { fail++; console.log("  缺:", miss, "多:", extra); }
}
console.log(`cn-holidays.ics: ${cnEvents.length} 条; cn-a-share-closures.ics: ${aEvents.length} 条`);
process.exit(fail ? 1 : 0);
