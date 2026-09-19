# 发布手册

从"代码在本地"到"别人能 `npm i @icyn/date`"的全过程。第一次发布走第 1–6 节；之后每次发版只看第 7 节。

**当前状态**（2026-09-18）：代码、测试（514 条）、CI、LICENSE、两个包的 README 都齐了。
缺的只有账号和仓库这类外部动作——下面每一步都标了是你手动做还是命令能做。

---

## 1. npm 账号与命名

### 1.1 注册 / 登录

```bash
npm whoami            # 有输出 = 命令行已登录，跳到 1.2
npm login             # 打印一个 URL 并打开浏览器，在浏览器里用 passkey 完成
```

**在 npmjs.com 网站上登录 ≠ 命令行已登录。** 这两套凭据是分开的：网站登录只作用于浏览器，
`npm publish` 读的是 `~/.npmrc` 里的 token。只在网站登录过就发布，会在打包完成后的最后一步报：

```
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in to https://registry.npmjs.org/
```

这时什么都没发出去，`npm login` 之后重发即可。发布前用 `npm whoami` 确认一眼最省事。
另外该账号必须在 `icyn` 组织里有发布权限（组织页 → Members，owner 或 developer），
否则报的是 403 而不是 ENEEDAUTH。

**务必开 2FA**（npmjs.com → 头像 → Account → Two-Factor Authentication → Enable 2FA）。
包一旦有人用，账号被盗等于供应链事故。

注意 npm 的 2FA **已经不是验证器 App 的 6 位码了**，现在只支持 passkey / 安全密钥（WebAuthn）：
Mac 的 Touch ID、Windows Hello、iPhone 的 Face ID，或者 YubiKey 这类实体密钥。
所以老教程里的 `npm publish --otp=123456` 已经不适用。

**在你日常发布的那台机器上注册一个 passkey**，否则每次 publish 浏览器都会弹一个
"Scan QR Code"——那是浏览器发现本机没有 npmjs.com 的 passkey，退而求其次让你用另一台设备扫码。
在 Mac 上注册 Touch ID 之后，publish 就变成按一下指纹：

> Account → Two-Factor Authentication → 添加 security key → 起个名字（如 `MacBook Touch ID`）
> → 按浏览器提示用 Touch ID 完成 → **把恢复码存好**（passkey 丢了只能靠它）

手机上的 passkey 也能用：用 iPhone 相机扫那个二维码、Face ID 确认即可，
但走的是蓝牙，手机要在旁边且蓝牙开着——每次发布都这么来一遍并不划算。

### 1.2 scope：`@icyn` ✅

组织已创建：https://www.npmjs.com/org/icyn 。项目里用的就是 `@icyn/date` / `@icyn/date-mcp`，
无需任何改动。确认你的账号在该组织里有发布权限（组织页 → Members，角色 owner 或 developer）即可。

两个包都加了 `publishConfig: { "access": "public" }`——scoped 包默认是 private，
有了这个字段，即使忘了敲 `--access public` 也会正确地发成公开包。

> 万一以后要换 scope：`grep -rn "@icyn/" --include=*.json --include=*.ts --include=*.md . | grep -v node_modules`
> 找全，依次改两个 `package.json` 的 `name`、`packages/mcp/package.json` 的 `dependencies["@icyn/date"]`、
> `packages/mcp/src/server.ts` 的两处 import、两份 README 的安装说明，然后 `npm install` 重建 workspace 链接。

### 1.3 公开身份

`author` 是 `Icyn <icyn12@gmail.com>`，**这个邮箱会公开显示在两个 npm 包页面上**。这是有意的：
开源包需要一个能被联系到的地址。

另一个会公开的地方是 **git commit 里的邮箱**，它会出现在 GitHub 的每条提交记录里。
`git init` 之后在本仓库单独设一次，避免带上你的日常邮箱：

```bash
git config user.name  "Icyn"
git config user.email "icyn12@gmail.com"
git config user.email      # 确认一下
```

---

## 2. GitHub 仓库

仓库还没 `git init`。

```bash
cd /Users/chenhuan/Workspace/icyn_1/IcynCom/icyndate
git init
git add -A
git status              # 确认 node_modules/ dist/ .venv/ 都没进来
git commit -m "icyndate 0.1.0: lunar calendar, 24 solar terms, holidays for 12 regions"
git branch -M main
```

建远端仓库（二选一）：

```bash
gh repo create icyndate --public --source=. --remote=origin --push    # 装了 gh CLI
# 或者：网页上建空仓库，然后
git remote add origin https://github.com/icyn12-tinker/icyndate.git   # 已存在则用 git remote set-url
git push -u origin main
```

### 2.1 认证（第一次 push 必踩）

GitHub 自 2021-08 起**不支持密码推送**，HTTPS 的 Password 框里输 GitHub 密码或邮箱一律被拒
（`remote: Invalid username or token. Password authentication is not supported for Git operations.`）。
二选一：

**Personal Access Token**（不用装东西，token 当密码用）

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access: Only select repositories → `icyndate`
   - Permissions → Repository permissions，两条都要给：
     - **Contents: Read and write** —— 推代码（Metadata: Read 自动带上）
     - **Workflows: Read and write** —— 推 `.github/workflows/` 下的文件。
       少了这条，push 会在传完对象之后才被拒：
       `refusing to allow a Personal Access Token to create or update workflow ... without workflow scope`
       （报错里说的 `workflow scope` 是经典 token 的叫法，fine-grained token 对应上面这条 Workflows 权限）
   - 生成后立刻复制，页面关掉不再显示

   已经建好的 token 可以直接编辑权限：点进 token → Permissions → 补上 → Update。
   **token 字符串不变**，所以钥匙串里存的那份仍然有效，改完直接重推即可。
2. `git config --global credential.helper osxkeychain`（存进钥匙串，只问一次）
3. `git push -u origin main` → Username 填 **GitHub 用户名**（`icyn12-tinker`，不是邮箱），Password 粘 **token**

**SSH**（无过期，长期更省事）

```bash
ssh-keygen -t ed25519 -C "icyn12@gmail.com"
pbcopy < ~/.ssh/id_ed25519.pub     # GitHub → Settings → SSH and GPG keys → New SSH key
git remote set-url origin git@github.com:icyn12-tinker/icyndate.git
ssh -T git@github.com              # "Hi icyn12-tinker!" = 通了
```

SSH 密钥没有 scope 的概念，推 workflow 文件不受限，也不会 90 天过期——如果长期维护这个仓库，
SSH 比轮换 token 省事。

token 不要提交进仓库、不要贴到任何对话里——它等于该仓库的写权限。
`git remote add` 报 `remote origin already exists` 时用 `git remote set-url origin <新地址>` 改，不要重复 add。

### 2.2 CI

推上去之后 `.github/workflows/ci.yml` 会自动跑一遍（build → tsc → 514 条测试 → CN 对拍）。
**先确认 CI 是绿的再发布**——本地过了但 CI 红过一次（Node 版本差异之类），发出去就来不及了。

### 2.3 补 repository 字段

仓库地址有了之后补上，npm 页面右侧的 Repository / Homepage / Issues 链接靠它们：

```bash
node -e '
const fs=require("fs"), URL="https://github.com/icyn12-tinker/icyndate";
for (const [p,dir] of [["packages/core","packages/core"],["packages/mcp","packages/mcp"]]) {
  const f=p+"/package.json", d=JSON.parse(fs.readFileSync(f,"utf8"));
  d.repository={type:"git",url:"git+"+URL+".git",directory:dir};
  d.homepage=URL+"#readme"; d.bugs={url:URL+"/issues"};
  fs.writeFileSync(f, JSON.stringify(d,null,2)+"\n");
}'
git commit -am "add repository metadata"
```

---

## 3. 发布前自检

```bash
python3 -m pip install -r tools/requirements.txt   # 只有 chinesecalendar，纯 Python
npm ci                                             # 干净安装，和 CI 一致
npm run check                                      # build → tsc → 514 tests → CN 逐日对拍
```

必须全绿。`npm run check` 最后一步会打印 `1096 days checked · mismatches: []`——
**如果它说 0 days checked，不要发布**，那意味着一天都没核对上。

再看一眼两个包到底会打进去什么：

```bash
npm pack --dry-run -w @icyn/date      # 应含 dist/ README.md LICENSE THIRD-PARTY-LICENSES，约 150 kB
npm pack --dry-run -w @icyn/date-mcp  # 5 个文件，约 5 kB
```

确认**没有**：`src/`、`test/`、`fixtures/`、`tools/`、`.venv/`、任何 `.DS_Store`。

---

## 4. 发布

### 4.1 顺序不能反

`@icyn/date-mcp` 的 `dependencies` 里有 `"@icyn/date": "^0.1.0"`。
**必须先发 core**，否则 mcp 包发出去的瞬间是坏的——用户 `npx -y @icyn/date-mcp` 会因为装不到依赖而失败。

### 4.2 执行

```bash
# 1) 核心库
npm publish -w @icyn/date --access public
#    scoped 包默认 private；两个 package.json 里已有 publishConfig.access=public，这个参数是双保险
#    2FA 会让浏览器弹出 passkey 验证（Touch ID / Face ID）——见 1.1，不是 6 位验证码
#    prepublishOnly 会自动重新 build 一次

# 2) 确认 core 真的上去了，再发 mcp
npm view @icyn/date version

# 3) MCP server
npm publish -w @icyn/date-mcp --access public
```

### 4.3 以后改用 Trusted Publishing（OIDC，无 token）

npm 正在收紧"绕过 2FA 的 token"：**2026-08** 起这类 token 不能做账号相关操作，
**2027-01** 起不能直接发布。也就是说，靠 token 在 CI 里发包这条路快走到头了。

替代方案是 **trusted publishing**——GitHub Actions 通过 OIDC 直接向 npm 证明身份，仓库里不存任何 token，
并且自动带上 provenance（npm 页面会显示"这个包由哪个仓库的哪次 commit 构建"）。

顺序上要先有包才能配：**0.1.0 先按 4.2 手动发出去**，然后
npm 包页面 → Settings → Trusted publisher → 填 GitHub 仓库 `icyn12-tinker/icyndate` 与 workflow 文件名，
再加一个 release workflow（`permissions: id-token: write` + `npm publish`）。下一次发版就不用碰 passkey 了。

### 4.4 打 tag

```bash
git tag -a v0.1.0 -m "0.1.0"
git push origin v0.1.0
```

---

## 5. 发布后验证

在**仓库之外**的空目录验，避免 workspace 链接造成假阳性：

```bash
mkdir -p /tmp/icyn-verify && cd /tmp/icyn-verify && npm init -y >/dev/null
npm i @icyn/date

node -e '
import("@icyn/date").then(async m => {
  await import("@icyn/date/regions/all");
  console.log(m.describe("2026-02-17", { region: "CN" }));
  console.log(m.dayInfo("2026-10-10", "CN").kind, m.dayInfo("2026-10-10","CN").source);
  console.log(m.regions().length, "regions");
});'
# 期望：2026-02-17 星期二，农历丙午马年正月初一，CN 放假：春节（第 3/9 天）。
#       adjusted_workday official
#       12 regions
```

MCP server：

```bash
npx -y @icyn/date-mcp    # 应该静默挂住（stdio 在等输入），Ctrl-C 退出即为正常
```

接到 MCP 客户端里真调一次。以 Claude Desktop（macOS）为例：

**1) 打开配置** —— 设置（`Cmd+,`）→ 开发者 → 编辑配置，对应文件是
`~/Library/Application Support/Claude/claude_desktop_config.json`

**2) 加一个键，不要整份覆盖** —— 文件里通常已经有别的 MCP server。安全合并（自动备份）：

```bash
CFG=~/Library/Application\ Support/Claude/claude_desktop_config.json
cp "$CFG" "$CFG.bak" 2>/dev/null
python3 -c '
import json, os
p = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")
d = json.load(open(p)) if os.path.exists(p) and os.path.getsize(p) else {}
d.setdefault("mcpServers", {})["icyn-date"] = {"command": "npx", "args": ["-y", "@icyn/date-mcp"]}
json.dump(d, open(p, "w"), indent=2, ensure_ascii=False)
print("现有 server：", list(d["mcpServers"]))
'
```

**3) `Cmd+Q` 完全退出再启动** —— 关窗口进程还在，配置不会重新加载。"改了没反应"基本都是这个。

**4) 验证** —— 设置 → 开发者里 `icyn-date` 显示 running，工具列表里有 11 个工具。然后问：

| 问题 | 期望走的工具 | 重点看 |
|---|---|---|
| 2026 年国庆放几天？10 月 10 日要不要上班？ | `holidays` / `is_workday` | 答案带 `source: official` |
| 2027 年春节是哪天？ | `lunar` / `holidays` | 标出 `predicted`（调休未公布） |
| 下一个中秋是哪天 | `next_lunar_date` | —— |
| 日本 2026 年有哪些假期 | `holidays` | `source: baseline` |

**关键是看模型有没有把 source / confidence 说出来。** 那是这个包的卖点；拿到了却不说，
说明 `describe()` 的措辞要调——这种问题只有真实调用才暴露得出来。

**起不来** —— 九成是 PATH：客户端用极简环境启动子进程，node 来自 nvm / Homebrew 时找不到 `npx`，
日志里是 `spawn npx ENOENT`。用 `which npx` 拿绝对路径填进 `command` 即可。
日志：`tail -f ~/Library/Logs/Claude/mcp-server-icyn-date.log`

`npx -y` 每次启动可能重新拉包，慢。稳定之后可以 `npm i -g @icyn/date-mcp`，
把 `which icyn-date-mcp` 的绝对路径填进 `command`，`args` 留 `[]`。

最后看一眼两个 npm 页面：README 渲染正常、LICENSE 显示 MIT、作者 Icyn。

---

## 6. 出错了怎么办

| 情况 | 处理 |
|---|---|
| 发现内容有问题，刚发出去不到 72 小时 | `npm unpublish @icyn/date@0.1.0`。**72 小时后就不允许了**，且 unpublish 过的版本号永久不可复用 |
| 超过 72 小时 | 不能删。发一个修好的新版本，然后 `npm deprecate @icyn/date@0.1.0 "有 bug，请升级到 0.1.1"` |
| 想"重新发一次同一个版本" | 做不到。npm 的版本号是一次性的，改了内容就得升版本号 |
| 发错了包名 / scope | 同上，unpublish（72h 内）或者放弃那个名字重新发 |

所以第 3 节的 `npm pack --dry-run` 那一步别跳。

---

## 7. 之后每次发版

```bash
# 1. 改代码，更新数据
npm run check                                  # 必须全绿

# 2. 数据有变动才需要重算（要编译器，见 tools/README.md）
#    python3 -m pip install -r tools/requirements-generators.txt
#    npm run fixtures

# 3. 升版本号（改了数据或修了 bug → patch；加了 API → minor）
npm version patch -w @icyn/date
npm version patch -w @icyn/date-mcp
#    注意：core 升到 0.2.x 时，要手动把 mcp 的 dependencies["@icyn/date"] 范围一起改，
#    ^0.1.0 不会匹配 0.2.0

# 4. 记一行
#    docs/WORKLOG.md

# 5. 发布（顺序同 4.1：core 先）
npm publish -w @icyn/date --access public
npm publish -w @icyn/date-mcp --access public

# 6. tag + push
git commit -am "release 0.1.1" && git tag v0.1.1 && git push --follow-tags
```

录进新一年的官方节假日之后，记得同步改 `packages/core/src/data/holidays/CN.json` 的 `verified_until`
——预测下限跟着它走，不改的话新录的那年会被当成"已录数据"但预测仍从旧年份开始。

---

## 8. 首次公开当天

发布是技术动作，被看见是另一回事。按精力排序：

1. **Show HN**。标题建议：
   `Show HN: Date context for AI agents – lunar calendar, 24 solar terms, holidays, offline MCP server`
   正文两段：解决什么问题（Agent 要知道"今天是什么日子"，现在要自己拼五个数据源）、
   和现成方案的区别（每个答案带 source 与 confidence，不知道就说不知道）。
2. **提交到 MCP 目录**：modelcontextprotocol 官方 servers 列表、Cursor / Claude 的 MCP 目录。
   这是最精准的流量，成本几乎为零。
3. **V2EX / 掘金 / 少数派**。中文侧主打两点：农历节气的验证方式（两套参考实现逐日对拍 73,384 天），
   以及 2057 年九月那个天文边界案例——技术读者吃这个。
4. **回应 issue 比发帖重要**。第一周的 issue 决定别人会不会用第二次。

不要做的事：不要在标题里写"最好""最全"。这个库的说服力在"可验证"和"标注了不确定"，
吹大了反而会被人拿 baseline 那 11 个地区的未核对数据打脸——那些数据本来就明确标着 `baseline`。

---

## 附：发布前最后一眼

- [ ] `npm whoami` 有输出（命令行登录，不是网站登录），2FA 已开，本机已注册 passkey
- [x] `@icyn` scope 到手（组织已建：npmjs.com/org/icyn），账号在组织里有发布权限
- [ ] `git init` 后设 `git config user.email "icyn12@gmail.com"`
- [ ] GitHub 仓库已推，CI 绿
- [ ] `npm run check` 全绿，且打印 `1096 days checked`
- [ ] `npm pack --dry-run` 两个包内容都对，没有 src/ test/ fixtures/
- [ ] **core 先，mcp 后**
- [ ] 空目录里装回来跑通，MCP 在真客户端里调通
