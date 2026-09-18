# 发布手册

从"代码在本地"到"别人能 `npm i @icyn/date`"的全过程。第一次发布走第 1–6 节；之后每次发版只看第 7 节。

**当前状态**（2026-09-18）：代码、测试（514 条）、CI、LICENSE、两个包的 README 都齐了。
缺的只有账号和仓库这类外部动作——下面每一步都标了是你手动做还是命令能做。

---

## 1. npm 账号与命名

### 1.1 注册 / 登录

```bash
npm whoami            # 有输出 = 已登录，跳到 1.2
npm login             # 浏览器里完成，个人账号即可
```

**务必开 2FA**（npmjs.com → Account → Two-Factor Authentication，选 `Authorization and Publishing`）。
包一旦有人用，账号被盗等于供应链事故。开了 2FA 之后 publish 需要一次性验证码，见 4.2。

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
#    scoped 包默认是 private，--access public 不能省
#    开了 2FA 会提示输入一次性验证码；也可以 --otp=123456
#    prepublishOnly 会自动重新 build 一次

# 2) 确认 core 真的上去了，再发 mcp
npm view @icyn/date version

# 3) MCP server
npm publish -w @icyn/date-mcp --access public
```

### 4.3 打 tag

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

接到 MCP 客户端里真调一次。Claude Desktop 的配置：

```json
{
  "mcpServers": {
    "icyn-date": { "command": "npx", "args": ["-y", "@icyn/date-mcp"] }
  }
}
```

重启客户端，问一句"2026 年国庆放几天、10 月 10 日要不要上班"，确认它调的是 `is_workday` / `holidays`
并且答案带 source。

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

- [ ] `npm whoami` 有输出，2FA 已开
- [x] `@icyn` scope 到手（组织已建：npmjs.com/org/icyn），账号在组织里有发布权限
- [ ] `git init` 后设 `git config user.email "icyn12@gmail.com"`
- [ ] GitHub 仓库已推，CI 绿
- [ ] `npm run check` 全绿，且打印 `1096 days checked`
- [ ] `npm pack --dry-run` 两个包内容都对，没有 src/ test/ fixtures/
- [ ] **core 先，mcp 后**
- [ ] 空目录里装回来跑通，MCP 在真客户端里调通
