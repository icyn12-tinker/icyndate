# BACKLOG — ideas go here, not into code, until the first paying user exists

## 可用性评审 8–13：已完成（2026-09-18），遗留项
- 月干支目前是历法约定（正月建寅、五虎遁）；命理约定（以节气为界）待做。
- 子时 23:00 归属：现按 23:00–00:59 = 子；"晚子时归次日"作为选项待做。
- 美国各州节日约 50 个尚无中文名（`name_fallback: true` 标记），需人工翻译。
- 英国 baseline 含库里的一次性条目（如 2026 苏格兰世界杯决赛假），升级 official 时核对。
- `describe()` 目前只有 zh/en，第三语言随 i18n 键扩展。

## 其他
- 立春 year-boundary option for 命理 use cases
- 黄历宜忌（建除十二神、二十八宿）— folklore only, no predictions
- Astronomy module: moon phases, sunrise/sunset; new-moon instant to settle 2057 九月
- Wikipedia "on this day" importer + importance scoring
- Holiday data: upgrade baseline → official (TW 補班, KR 代替公休日, HK 宪报); state/Land layers
- .ics export
- Python port sharing the same fixtures
- MCP server; hosted API, API keys, metering, Paddle/LemonSqueezy
