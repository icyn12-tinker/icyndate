# 工作日志

## 2026-09-17 · 第 1 周

- 建立仓库骨架（pnpm/npm workspace，vitest，strict tsc），MIT。
- 农历核心：1900–2100 公历⇄农历、年/日干支、生肖、中文月日名。73,384 天双向对拍通过。
- 参考实现分歧仅 1 处（2057 九月初一，30 天），已记录 NOTES.md，暂随 sxtwl。
- 二十四节气：4,824 个精确时刻（秒级），两参考最大差 55 s。提供 solarTerms / solarTermAt / solarTermOnDay。
- 文档：产品与技术方案 v0.1 收入 docs/。

- 节假日层：schema（official/predicted、地区周末规则、调休上班日）；CN 2024–2026 官方数据录入，逐日与 chinesecalendar 对拍 0 差异；未公布年份按法定假日规则（农历 + 清明节气）推算并标 predicted。
- 15 条测试全绿。

- 其他地区：HK/MO/TW/JP/KR/VN/SG/US/GB/DE/FR 2024–2028 以 python-holidays 生成 `baseline` 层，多语言名称（en + 本地语 + zh），春节日期与自家农历表一致。19 条测试全绿。

- 可用性评审后完成 1–7：`dateContext()` 单入口；`DateInput` 统一输入（ISO / 元组 / 对象 / Date）；`confidence` 三级，predicted 年份节假日前后 10 天内标 uncertain；名称键统一 BCP-47 并保证 en + zh-Hans；跨地区规范节日 id（`lunar-new-year` 等）与 `regionsObserving()`；地区数据带 `data_version / generated_at / verified_until`；超出覆盖返回 `available:false`。30 条测试全绿。8–13 写入 BACKLOG。

- 8–13 完成：Intl 时区（DST 正确，无需 tz 数据）、地区层级（US 州 / DE 州 / GB 四地区，存差量）、节假日 kind、六个日期算术函数、月/时干支与 `nextLunarDate`、`describe()`。40 条测试全绿。

- 第二轮可用性 1–4：核心包只带 CN（按地区入口 `@icyn/date/regions/X`），砍掉位置参数重载，数据 lint 进测试（每个地区/年份/子区域一条，共 497 条测试；顺手支持了同一天两个节日），失败行为写进 README。
- 打包：esbuild ESM + code splitting + d.ts；`@icyn/date-mcp` 11 个工具，stdio 端到端冒烟通过（含 US-CA 感恩节周、JP 2026 银周 5 连休）。CI 与发布清单就绪。

### 复审修复（2026-09-18）

- **预测器改为只向前**：`schedule()` 只在 `verified_until` 之后的年份调用预测器。之前对 1900–2023 任何未收录年份都返回
  predicted 的 13 天法定假——1949 年前没有 PRC 假日、清明/端午/中秋 2008 年才入法定、春节四天是 2024 修订才有，
  而那些年份的真实安排本来就是公开的，等于编造历史。现在返回 `available: false` 并说明"该年早于已录数据，不做预测"。
  `coverage()` 增加 `predictedFrom` 字段。回归测试覆盖 1900/1949/1990/2005/2008/2023。
- **CI 顺序**：`npm run build` 提到 `tsc -p .` 之前。@icyn/date-mcp 依赖 @icyn/date 的 .d.ts，全新 clone 上
  原顺序必红（实测 4 个 TS 错误）。`npm run check` 同步为 build → tsc → test → CN 对拍。
- **两个包补 README / LICENSE / THIRD-PARTY-LICENSES**：core 包原先 `files` 里写了 README.md 但文件不存在，
  发到 npm 会是空白页；LICENSE 也因为只在根目录而进不了 tarball。python-holidays 的 MIT 全文一并附上。
- **README 修 2 处会抛错的示例**：`solarToLunar(2026, 2, 17)` / `solarTermOnDay(2026, 2, 4)` 三参写法早已改成
  单参 DateInput。两份 README 里的每一个调用都用脚本实跑校验过（29 条全过）。

### 第二批修复（2026-09-18）

- **地区码大小写不敏感**：新增 `canonicalRegion()`，`resolve` / `getRegion` / `registerRegion` 全部走它；
  `"us-ca"` / `" Us-Ca "` 都等于 `US-CA`，返回里 `region` 与 `resolvedRegion` 一律是规范形式。MCP 侧 `Region`
  schema 也加了 transform，回给模型的句子引用规范码。不存在的地区仍然抛错。
- **2100 表尾截断不再报假数字**：`LunarInfo.monthLength` 变为 `number | null`，lunar 2100 腊月返回 `null`
  （表停在 `MAX_DATE` = 2100-12-31，月中，真实长度未知）；`lunarMonthLength(2100,12)` 抛"长度未知"，
  `lunarToSolar({2100,12,day>1})` 抛"超出表尾"而不是"该月只有 1 天"；`nextLunarDate` 跳过截断月。
  新导出 `MAX_DATE`。日期换算本身不变，fixtures 73,384 行照旧全过。
- **GB-SCT 那条世界杯假删掉**：python-holidays 里一条"苏格兰进世界杯决赛才放"的条件性假日，不该作为
  法定假发布。生成器加了 `EXCLUDE` 列表（每条附理由），数据文件同步删除，data-lint 加断言防止再生成时回归。
- **id 截断修正**：生成器的 slug 原先在 48 字符处硬切，产出 `…fifa-world-cup-f` 这类半个词的 id，且理论上会
  把两个不同节日切成同一个 key。改为在词边界截断 + 冲突时加序号；4 个受影响的 id 同步更新
  （DE 2、KR 1、TW 1），data-lint 加"没有 ≥48 字符 id"断言。
- **MCP `holidays` 工具**：无数据年份不再静默回 "0 holiday days"，改为明说该年无数据并附 coverage。
- 测试 506 → 514 条全绿；`npm run check`（build → tsc → test → CN 对拍）通过。

### 环境与工具链（2026-09-18）

- `tools/requirements.txt`：sxtwl / lunar_python / chinesecalendar / holidays 四个开发期依赖固定版本，
  CI 与 `tools/README.md`、`docs/RELEASE.md` 统一引用它。
- `check_cn_holidays.py`：缺 `chinesecalendar` 时给一句可执行的提示并以 1 退出（不是 traceback，也不是静默跳过——
  这是发布门槛）；打印实际核对的天数（当前 1096 天），这样"一天都没核到"不会伪装成通过；
  chinesecalendar 覆盖不到的年份（我们领先于它时）单独跳过而不中断。
- 删除根目录作废的 `data/`（上一轮 schema 草案，已被 `packages/core/src/data/holidays/` +
  `data-lint.test.ts` 取代）。
- Python 依赖按成本拆两份：`tools/requirements.txt` 只含 `chinesecalendar`（纯 Python，`npm run check`
  要用）；`tools/requirements-generators.txt` 放 sxtwl / lunar_python / holidays，只在重算数据时装。
  原先合成一份的后果是：跑一次测试就要编译 sxtwl 这个 C++ 扩展——在 macOS 上 Homebrew 的 LLVM 盖掉苹果
  链接器时会直接链接失败。构建、测试、发布都不该需要编译器。

### 发布前收尾（2026-09-18）

- LICENSE 主体定为 `Copyright (c) 2026 Icyn`（个人名义），三处一致；两个包的 `package.json` 加了
  `author: "Icyn"`。仓库内已无 `<your name / company>` 占位符。
- `.gitignore` 补 `.venv/` `.DS_Store` `*.tgz`。
- 清掉上一轮遗留的 `tools/validate_holidays.py` 与 `docs/holidays-schema.md`（校验的数据目录已删除，
  且草案形状与最终实现不一致）。
- 待办：GitHub 仓库建好后补两个包的 `repository` / `homepage` / `bugs`。
- npm 组织 `icyn` 已创建，项目里现有的 `@icyn/date` / `@icyn/date-mcp` 正好对上，scope 无需改动。
  两个包的 `author` 定为 `Icyn <icyn12@gmail.com>`（该邮箱会公开在 npm 包页面上），
  并加了 `publishConfig: { access: "public" }`——scoped 包默认 private，这样忘敲 `--access public` 也不会发错。

### 真实客户端验证后的修复（2026-09-18，date-mcp 0.1.1）

接进 Claude Desktop 实测，发现**模型不复述来源**——查原始返回后确认问题不在模型，在工具输出：

- `next_lunar_date` / `lunar` / `solar_terms` 的返回里**完全没有来源信息**。根因是建模缺口：
  source 只定义在节假日层，农历/节气/干支没有——而它们恰恰是可信度最高的部分（73,384 天双参考对拍），
  这份底气一个字都没传达出去。新增 `computed` 一档来表述它。
- `holidays` 的 JSON 每行都有 source，但首句"13 holiday days in CN 2027"只字未提。
  模型最可能复述的就是首句，改为汇总该次查询的来源档位。
- 没有任何地方"要求"模型说出来。MCP 的 server-level `instructions` 原先是空的，现在写明四档来源的
  含义与复述要求，并明确禁止用自身记忆填补 available:false 的空档。

实测各工具首句（tsc 临时构建 + stdio 调用验证）：
CN 2026 → `[source: official — from the government notice]`；
CN 2027 → `[source: predicted — no official notice for this year yet; statutory days only, 调休 unknown]`；
JP 2026 → `[source: baseline — ... not yet verified against the government gazette]`；
农历/节气 → `[source: computed (... verified 1900–2100 against two independent references)]`。

只改 MCP 层，`@icyn/date` 的 API 与类型不变，0.1.0 不受影响；发 `@icyn/date-mcp` 0.1.1。

### 0.1.2：把 source_ref 透到首句

0.1.1 之后再测：幻觉没了（"按惯例 8 到 9 天"消失），predicted 状态也用自然语言传达了
（"放假调休安排还没公布"），但模型仍然不署名。原因是首句里只有档位（`source: official`）——
档位不是用户能去核对的东西，具体公告文号才是。

- 首句改为「档位 + 出处」：`[source: official — 国务院办公厅关于2026年部分节假日安排的通知（2025-11-04）]`；
  predicted → `《全国年节及纪念日放假办法》法定假日推算；调休安排未公布`；baseline → `python-holidays 0.104`。
- 跨年区间查询会同时列出两档并标 `(mixed — see each row)`，实测
  `CN 2026-09-01..2027-01-05` → official + predicted 两条都在。
- `date_context` / `is_workday` / `workdays` / `next_long_weekend` / `holiday_eve` 统一挂上出处。
- instructions 新增两条：**引用具体公告而不是"official"这个词**；**不要把两档来源混进一句话**
  （未来年份的节日日期是 computed 确定的，那年放不放假是 predicted 未知的——截图里模型已经在
  这条边缘上试探了）。

只改 MCP 层；`@icyn/date` 仍是 0.1.0，不需重发。

### 0.1.4 与官方 MCP Registry 上线（2026-09-20）

- `@icyn/date-mcp` 0.1.4 发到 npm。0.1.3 没被占用——**发布失败不消耗版本号**，当时误以为重试前要
  再 `npm version patch`，白跳了一个号。
- 发布报 404 的排查：对**已存在**的包 PUT 返回 `404 Not Found` 是 npm 把 403（无写权限）伪装成 404，
  真实原因是 CLI 登录态掉了（`npm whoami` 一查即知），重新 `npm login` 后即通。写进 RELEASE.md 了。
- 接入官方 MCP Registry：`packages/mcp/package.json` 加 `mcpName: io.github.icyn12-tinker/icyn-date`
  （归属校验看的是**线上**包里的这个字段），根目录加 `server.json`，
  `.github/workflows/publish-mcp-registry.yml` 用 OIDC 在 push tag 时自动同步。
- `mcp-publisher publish` 成功，`io.github.icyn12-tinker/icyn-date` 0.1.4 status active。
- 命名空间用 **GitHub 用户名** `icyn12-tinker`，与 npm 用户名 `icyn12` 不同，互不影响。
- Registry 官方声明处于 preview、可能数据重置，因此 npm 始终是主分发路径。

### 下一步（按 90 天计划）
1. **发布**：按 docs/RELEASE.md 走。这是本周五的事，不再加功能。
2. 把 baseline 逐个升级为 official：TW 補班、KR 代替公休日、HK 宪报优先。CN 2027 通知发布后（通常 11 月）第一时间录入。
2. `@icyn/date` 离线包打包与 npm 发布；`@icyn/date-mcp` 最小可用。
3. 本周五：仓库公开 + 第一次公开 commit。
