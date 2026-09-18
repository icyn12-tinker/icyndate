/** One human sentence about a day — what an MCP tool should hand back to a model. */
import { dateContext, type ContextOptions } from "./context";
import { type DateInput } from "./input";

const WD_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CONF_ZH = { certain: "", likely: "（依据规则推算，未经官方核对）", uncertain: "（调休安排未公布，可能变动）" };
const CONF_EN = { certain: "", likely: " (rule-based, not yet gazette-checked)", uncertain: " (adjustment days not yet published; may change)" };

export function describe(input: DateInput, opts: ContextOptions & { lang?: "zh" | "en" } = {}): string {
  const lang = opts.lang ?? "zh";
  const c = dateContext(input, opts);
  const parts: string[] = [];
  const w = c.workday, l = c.lunar, t = c.solarTerm;

  if (lang === "zh") {
    parts.push(`${c.date} 星期${WD_ZH[c.civil.weekday]}`);
    if (l && "year" in l) parts.push(`农历${l.yearGanZhi}${l.zodiac}年${l.monthName}${l.dayName}`);
    if (t?.onThisDay) parts.push(`节气「${t.onThisDay.name.zh}」`);
    if (w && w.available) {
      const region = w.resolvedRegion;
      if (w.kind === "public_holiday" && w.holiday) parts.push(`${region} 放假：${w.holiday.name["zh-Hans"] ?? w.holiday.name.en}${w.holiday.span > 1 ? `（第 ${w.holiday.dayIndex}/${w.holiday.span} 天）` : ""}${CONF_ZH[w.confidence]}`);
      else if (w.kind === "adjusted_workday") parts.push(`${region} 调休上班日${CONF_ZH[w.confidence]}`);
      else if (w.kind === "weekend") parts.push(`${region} 周末${CONF_ZH[w.confidence]}`);
      else parts.push(`${region} 工作日${CONF_ZH[w.confidence]}`);
    } else if (w) parts.push(`${w.region} 节假日数据未覆盖该年`);
    return parts.join("，") + "。";
  }
  parts.push(`${c.date} is a ${WD_EN[c.civil.weekday]}`);
  if (l && "year" in l) parts.push(`lunar ${l.monthName}${l.dayName} (${l.yearGanZhi}, year of the ${l.zodiac})`);
  if (t?.onThisDay) parts.push(`solar term ${t.onThisDay.name.en}`);
  if (w && w.available) {
    const region = w.resolvedRegion;
    if (w.kind === "public_holiday" && w.holiday) parts.push(`public holiday in ${region}: ${w.holiday.name.en}${w.holiday.span > 1 ? ` (day ${w.holiday.dayIndex} of ${w.holiday.span})` : ""}${CONF_EN[w.confidence]}`);
    else if (w.kind === "adjusted_workday") parts.push(`adjusted working day in ${region}${CONF_EN[w.confidence]}`);
    else if (w.kind === "weekend") parts.push(`weekend in ${region}${CONF_EN[w.confidence]}`);
    else parts.push(`working day in ${region}${CONF_EN[w.confidence]}`);
  } else if (w) parts.push(`no holiday data for ${w.region} that year`);
  return parts.join("; ") + ".";
}
