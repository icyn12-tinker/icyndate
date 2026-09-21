<!-- mcp-name: io.github.icyn12-tinker/icyn-date -->
# @icyn/date-mcp

MCP server that gives AI agents date context — Chinese lunar calendar, 24 solar terms, holidays and workdays for
12 regions (+ US states, German Länder, UK nations). Offline. No API key.

Every answer says where it came from, down to the document:

| source | meaning |
|---|---|
| `official` | from the government notice, cited by name (e.g. 国务院办公厅关于2026年部分节假日安排的通知) |
| `predicted` | no notice published for that year yet — statutory days only, 调休 unknown |
| `baseline` | from a holiday library, not yet verified against the government gazette |
| `computed` | lunar dates, 干支, solar terms — from a table verified 1900–2100 against two independent references |

## Requirements

**Node.js 18 or later**, with `npx` on your PATH. The server itself has no other dependencies.

```bash
node -v    # must print v18 or higher
```

No Node yet? Install the LTS build from [nodejs.org](https://nodejs.org).

## Use

Claude Desktop / Cursor / any MCP client:

```json
{ "mcpServers": { "icyn-date": { "command": "npx", "args": ["-y", "@icyn/date-mcp"] } } }
```

In Claude Desktop: **Settings → Developer → Edit Config**. Then **fully quit** the app (not just close the window)
and reopen it — it only reads the config and your PATH at startup.

Tools: `date_context`, `is_workday`, `holidays`, `workdays`, `next_long_weekend`, `holiday_eve`, `lunar`,
`next_lunar_date`, `solar_terms`, `regions_observing`, `regions`.

Example — "2026 年 10 月 10 日要上班吗？" → `is_workday {date:"2026-10-10", region:"CN"}` →

```
2026-10-10 in CN: adjusted_workday (certain) [source: official — 国务院办公厅关于2026年部分节假日安排的通知（2025-11-04）]
```

## Troubleshooting

The log is where the answer is. Claude Desktop writes one per server, `mcp-server-icyn-date.log`, in:

| install | logs folder |
|---|---|
| macOS | `~/Library/Logs/Claude/` |
| Windows, installer from claude.ai | `%APPDATA%\Claude\logs\` |
| Windows, Microsoft Store (MSIX) | `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\` |

The Store build virtualises AppData, so its config and logs are **not** at the usual `%APPDATA%\Claude\`
path — files you put there are invisible to it. Always open the config via **Settings → Developer → Edit Config**
rather than by path. (If your install folder is `C:\Program Files\WindowsApps\Claude_…`, you have the Store build.)

**`spawn npx ENOENT` / `'npx' is not recognized as an internal or external command`** — the client cannot find
`npx`. Look at the PATH the log prints right above the error:

- **No Node.js directory in it at all** (no `nodejs`, no `npm`) → Node is not installed. Install the LTS build,
  then fully quit and reopen the client.
- **Node is installed but not in that PATH** — typical with nvm, nvm-windows, Volta, Scoop or Homebrew, because
  the client starts servers with a minimal environment. Put the absolute path in `command`:

  ```bash
  which npx          # macOS / Linux
  where.exe npx      # Windows (PowerShell)
  ```

  ```jsonc
  // macOS / Linux
  { "command": "/opt/homebrew/bin/npx", "args": ["-y", "@icyn/date-mcp"] }

  // Windows — note npx.cmd, and doubled backslashes inside JSON
  { "command": "C:\\Program Files\\nodejs\\npx.cmd", "args": ["-y", "@icyn/date-mcp"] }
  ```

**Slow first start** — `npx -y` downloads the package on first run (and again when its cache expires). For a
faster, offline start install it once and point `command` at the installed binary:

```bash
npm i -g @icyn/date-mcp
which icyn-date-mcp        # or: where.exe icyn-date-mcp
```

```json
{ "command": "<that absolute path>", "args": [] }
```

Library behind it: [`@icyn/date`](https://www.npmjs.com/package/@icyn/date).
