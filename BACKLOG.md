# BACKLOG — ideas go here, not into code, until the first paying user exists

## 可用性评审 8–13：已完成（2026-09-18），遗留项
- 月干支目前是历法约定（正月建寅、五虎遁）；命理约定（以节气为界）待做。
- 子时 23:00 归属：现按 23:00–00:59 = 子；"晚子时归次日"作为选项待做。
- 美国各州节日约 50 个尚无中文名（`name_fallback: true` 标记），需人工翻译。
- 英国 baseline 含库里的一次性条目（如 2026 苏格兰世界杯决赛假），升级 official 时核对。
- `describe()` 目前只有 zh/en，第三语言随 i18n 键扩展。

## 真实客户端验证的发现（2026-09-18，date-mcp 0.1.2 之后）

- **假期的"净增工作日"没有工具能直接回答。** 排期类用户真正关心的不是"放几天"，而是"实际多空出几个
  工作日"。2027 春节法定 4 天（2/5–2/8）里，2/6 周六、2/7 周日本来就休——只多放 2 个工作日，这正是
  为什么最终往往调休成 8~9 天。数据算得出来（`workdaysBetween` 一减就有），但没有工具直接给这个数，
  模型也就不会说。考虑加 `holidayImpact(region, holidayId | date)` → `{ statutoryDays, netWorkdaysOff,
  weekendOverlap, adjustedWorkdays }`，MCP 侧对应一个工具。这是排期场景的核心指标。
- **模型会在 predicted 数据之上再叠一层自己的经验**（实测："近几年春节实际连休一般是 8~9 天，所以
  真实假期很可能会延长到 2 月 12 日左右"）。标注克制、对用户有用，暂不禁止；但如果要把边界划死，
  instructions 里加一句"区分哪些来自工具、哪些是你的经验判断"。等有了上面那个净增工作日的工具，
  模型就不必靠经验去猜这段了。
- 验证方法本身：**每次都要新开对话**。同一对话里重复问，模型会进入"简略重复"模式，把来源一并省掉，
  看到的现象与服务器返回无关。这个坑踩过一次，写进 docs/RELEASE.md §5 了。

## 其他
- 立春 year-boundary option for 命理 use cases
- 黄历宜忌（建除十二神、二十八宿）— folklore only, no predictions
- Astronomy module: moon phases, sunrise/sunset; new-moon instant to settle 2057 九月
- Wikipedia "on this day" importer + importance scoring
- Holiday data: upgrade baseline → official (TW 補班, KR 代替公休日, HK 宪报); state/Land layers
- .ics export
- Python port sharing the same fixtures
- Hosted API, API keys, metering, Paddle/LemonSqueezy（MCP server 已发布，见 packages/mcp）
