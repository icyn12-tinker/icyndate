<!-- mcp-name: io.github.icyn12-tinker/icyn-date -->
# @icyn/date-mcp

MCP server that gives AI agents date context — Chinese lunar calendar, 24 solar terms, holidays and workdays for
12 regions (+ US states, German Länder, UK nations). Offline. No API key. Every answer says where it came from
(`official` / `baseline` / `predicted`) and how sure it is.

## Use

Claude Desktop / Cursor / any MCP client:

```json
{ "mcpServers": { "icyn-date": { "command": "npx", "args": ["-y", "@icyn/date-mcp"] } } }
```

Tools: `date_context`, `is_workday`, `holidays`, `workdays`, `next_long_weekend`, `holiday_eve`, `lunar`,
`next_lunar_date`, `solar_terms`, `regions_observing`, `regions`.

Example — "下周三是中国的工作日吗？" → `is_workday {date:"2026-09-23", region:"CN"}` →
`2026-09-23 in CN: workday (official, certain)`.

Library behind it: [`@icyn/date`](https://www.npmjs.com/package/@icyn/date).
