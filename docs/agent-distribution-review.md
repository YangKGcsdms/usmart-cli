# usmart-cli 智能体分发评审（基于 lark-cli 调研）

## 结论

**能做到，且 lark-cli 已经跑通了整条链路。核心模式是：**

1. **CLI 本身是一个 npm 包**：`npm install -g usmart-cli` 后全局可用 `usmart`。
2. **Skill 单独通过一个 GitHub 仓库分发**：使用 Vercel 的 `npx skills add <repo>` 工具，把仓库里的 `skills/` 目录安装到各个 agent 的 skill 目录。
3. **CLI 内置 `usmart skills` 命令**：让 agent 在运行时读取与当前 CLI 版本一致的 skill 内容，并提示本地 skill 是否过期。
4. **不同 agent 的 skill 格式是统一的 `SKILL.md`**（YAML frontmatter + Markdown），但安装路径不同；`npx skills` 会自动处理。

所以用户的设想完全可行：**`npm install -g usmart-cli` + `npx skills add yingli/usmart-cli -g -y`** 之后，Claude Code / Cursor / Codex / Kimi Code CLI 等都能操作盈立。

---

## lark-cli 是怎么做的

### 1. 仓库结构（larksuite/cli）

```
larksuite/cli
├── cmd/                    # Go 写的 CLI 命令
│   ├── skill/              # lark-cli skills list / read 命令
│   ├── update/             # lark-cli update（同步 skill）
│   ├── auth/
│   ├── config/
│   └── ...
├── shortcuts/              # 各 domain 的 shortcut 实现
├── skills/                 # ✅ AI Agent Skills（SKILL.md）
│   ├── lark-shared/
│   ├── lark-calendar/
│   ├── lark-im/
│   └── ...
├── scripts/                # npm 包装脚本
│   ├── install.js          # postinstall：下载对应平台的 Go binary
│   └── run.js              # npm bin 入口，调用下载的 binary
├── package.json            # @larksuite/cli npm 包
└── AGENTS.md               # 给 AI agent 的协作规范
```

**注意**：npm 包里并不含 skill 文件，只含 CLI binary。skill 从 GitHub 仓库分发。

### 2. 两条安装命令

```bash
# 1. 安装 CLI（推荐，会顺带装 skill）
npx @larksuite/cli@latest install

# 2. 或只安装 CLI
npm install -g @larksuite/cli

# 3. 单独安装 Skills 到所有支持的 agent
npx skills add larksuite/cli -y -g
```

**关键发现：如果你只执行了第一条 `npx @larksuite/cli@latest install`，其实 skills 已经被自动装好了。**

lark-cli 的 `install` 子命令会启动 `scripts/install-wizard.js`，其中第二步就是：

```javascript
async function stepInstallSkills(msg) {
  // 先检查是否已有 lark- 开头的 skill
  if (await skillsAlreadyInstalled()) return;
  // 没有则自动执行
  await runSilentAsync("npx", ["-y", "skills", "add", "https://open.feishu.cn", "-y", "-g"]);
  // 失败则回退到 GitHub
  await runSilentAsync("npx", ["-y", "skills", "add", "larksuite/cli", "-y", "-g"]);
}
```

所以用户感觉「只装了 lark-cli 就能用」是因为安装向导把 `npx skills add larksuite/cli -g -y` 这一步自动做了。 skill 实际上被装到了 `~/.agents/skills/lark-*`，然后软链到 `~/.claude/skills/` 等目录。

`npx skills add larksuite/cli` 会：
- 克隆 `https://github.com/larksuite/cli.git`
- 扫描 `skills/` 目录下的 `SKILL.md`
- 把 skill 复制/软链到：
  - `~/.claude/skills/lark-*`（Claude Code）
  - `~/.cursor/skills/lark-*`（Cursor）
  - `~/.codex/skills/lark-*`（Codex）
  - `~/.agents/skills/lark-*`（Kimi Code CLI / Cline / Continue 等）
  - 以及其他 70+ agent 的对应目录

### 3. CLI 内置 skill 读取与版本同步

lark-cli 把 skill 内容 **嵌入二进制**（Go embed），提供：

```bash
lark-cli skills list
lark-cli skills read lark-calendar
lark-cli skills read lark-calendar references/lark-calendar-schedule-meeting.md
```

这样 agent 可以直接通过 CLI 读取skill，保证skill版本和CLI版本一致。

同时 `lark-cli update` 会调用 `npx skills add larksuite/cli -y -g` 同步 skill，并在 JSON 输出里通过 `_notice.skills` 提示 agent skill 已过期。

### 4. Skill 格式

```markdown
---
name: lark-calendar
version: 1.0.0
description: "飞书日历：管理日历日程和会议室..."
metadata:
  requires:
    bins: ["lark-cli"]
  cliHelp: "lark-cli calendar --help"
---

# calendar (v4)

## Shortcuts
```

关键字段：
- `name`：skill 唯一标识
- `description`：触发场景（agent 靠这个判断什么时候用）
- `metadata.requires.bins`：声明依赖的 CLI 工具
- `metadata.cliHelp`：帮助 agent 查看该 domain 的命令

### 5. lark-cli 为 AI 设计的细节

从 `AGENTS.md` 里看到：

- **主要用户就是 AI agent**（Claude Code, Cursor, Gemini CLI）
- **错误消息必须结构化**：`type/subtype/param/hint`，agent 靠这些字段决定下一步
- **stdout 是数据，stderr 是提示**：保证管道不被污染
- **`_notice.update` 和 `_notice.skills`**：主动提醒 agent 升级 CLI / 同步 skill
- **高风险写操作**：不带 `--yes` 退出码 10，返回 `confirmation_required`

---

## 对 usmart-cli 的启示

### 推荐架构

```
yingli/usmart-cli（GitHub 仓库）
├── bin/usmart              # Node CLI 入口
├── package.json            # npm 包：usmart-cli
├── dist/                   # 打包产物
├── README.md
├── AGENTS.md               # 通用 agent 协作规范
├── skills/                 # ✅ AI Agent Skills
│   ├── usmart-shared/
│   │   └── SKILL.md
│   ├── usmart-auth/
│   │   └── SKILL.md
│   ├── usmart-trade/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── usmart-account/
│   ├── usmart-position/
│   └── usmart-api-to-skill/
└── scripts/
    └── install-skills.js   # 可选：在 npm postinstall 时自动装 skill
```

### 推荐用户安装流程

**方案 A：一键安装（推荐，对标 lark-cli）**

```bash
npx usmart-cli@latest install
```

这个命令会做四件事：
1. 全局安装 `usmart-cli`
2. 自动调用 `npx skills add yingli/usmart-cli -y -g` 安装 skills
3. 引导 `usmart config init`
4. 引导 `usmart auth login`

**方案 B：分步安装**

```bash
npm install -g usmart-cli
npx skills add yingli/usmart-cli -y -g
usmart config init
usmart auth login
```

**方案 C：npm postinstall 自动装 skill**

在 `package.json` 里加 `postinstall`：

```json
"scripts": {
  "postinstall": "node scripts/install-wizard.js"
}
```

这样 `npm install -g usmart-cli` 完成后会自动执行 skill 安装。但 postinstall 在非 TTY 环境可能比较吵，建议像 lark-cli 一样只在 `usmart install` 命令里做。

### 推荐 CLI 内置能力

参考 lark-cli，usmart-cli 应提供：

```bash
usmart config init
usmart auth login
usmart auth status
usmart doctor

# 通用 API
usmart api GET /api/account/me

# domain 命令
usmart trade order list
usmart account profile get

# shortcut
usmart trade +orders
usmart account +me

# skill 读取（嵌入 npm 包）
usmart skills list
usmart skills read usmart-trade
usmart skills read usmart-trade references/place-order.md

# 升级并同步 skill
usmart update
```

### 推荐 usmart-cli 的 `skills` 命令实现

因为 usmart-cli 是 Node 包，skill 文件可以直接打包进 npm（不像 lark-cli 需要 embed 到 Go binary）。实现更简单：

```javascript
// src/commands/skills.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

export function registerSkills(program) {
  const skills = program.command('skills').description('读取内置 skill 内容');

  skills
    .command('list')
    .description('列出所有内置 skill')
    .action(() => {
      const list = scanSkills();
      console.log(JSON.stringify({ ok: true, skills: list, count: list.length }, null, 2));
    });

  skills
    .command('read <name>')
    .description('读取指定 skill 的 SKILL.md')
    .action((name) => {
      const content = readSkill(name);
      process.stdout.write(content);
    });
}
```

### 推荐 Skill 示例

```markdown
---
name: usmart-trade
version: 1.0.0
description: "盈立交易：查询订单、持仓、下单、撤单。当用户需要查看当前订单、持仓、执行交易操作时使用。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart trade --help"
---

# usmart trade

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)（认证、权限、高风险写操作）。

## Shortcuts

| shortcut | 用途 |
|---|---|
| `usmart trade +orders` | 查询当前订单 |
| `usmart trade +positions` | 查询持仓 |
| `usmart trade +place` | 下单 |
| `usmart trade +cancel` | 撤单 |

## 身份

交易操作默认使用 `--as user`。`--as bot` 用于应用级操作。

## 高风险写操作

`usmart trade +place` 和 `usmart trade +cancel` 是高风险写操作，必须先 `--dry-run` 预览，不带 `--yes` 会退出码 10。
```

---

## 当前 usmart-cli 的 gaps

| 项 | 状态 | 优先级 |
|---|---|---|
| npm 包基础结构 | ✅ 已有 | - |
| config / auth / doctor / api 骨架 | ✅ 已有 | - |
| 真实登录实现 | ❌ TODO | P0 |
| 真实业务 domain 命令 | ❌ 无 | P0 |
| `skills/` 目录下的 SKILL.md | ✅ 已有 `.claude/skills/`，需移到 `skills/` | P1 |
| `usmart skills list/read` 命令 | ❌ 无 | P1 |
| `usmart update` 同步 skill | ❌ 无 | P2 |
| 结构化错误输出（JSON envelope） | ⚠️ 未统一 | P1 |
| 高风险写操作 exit 10 门禁 | ❌ 未实现 | P1 |
| `_notice.update` / `_notice.skills` | ❌ 未实现 | P2 |
| AGENTS.md | ❌ 未创建 | P2 |

---

## 最终判断

| 问题 | 答案 |
|---|---|
| 能不能打包成 npm CLI？ | ✅ 能，且比 lark-cli 更简单（纯 Node） |
| npm install 后智能体能不能操作盈立？ | ✅ 能，但需要配套 `npx skills add yingli/usmart-cli` 安装 skills |
| Claude/Cursor/Codex 都能支持吗？ | ✅ 都能，`npx skills` 支持 70+ agent |
| 一个包搞定所有 agent？ | ✅ 可以，`npx usmart-cli@latest install` 一键安装 CLI + skills |
| 是否需要自己为每个 agent 写不同格式？ | ❌ 不需要，统一 `SKILL.md` 格式即可 |

---

## 建议的 MVP

1. **把现有 `.claude/skills/` 移到 `skills/` 目录**，让 `npx skills add yingli/usmart-cli` 能扫描到。
2. **实现一个真实 domain**（如 `usmart account +me`），打通登录 → 调用 → 输出。
3. **添加 `usmart skills list` / `usmart skills read`**，让 agent 能读取内置 skill。
4. **添加 `usmart install` 安装向导**，自动调用 `npx skills add yingli/usmart-cli -y -g`。
5. **发布 0.1.0 到 npm**，仓库公开后可被 `npx skills add` 使用。
6. **验证完整流程**：
   ```bash
   npx usmart-cli@latest install
   usmart account +me
   ```
7. **再补 Cursor / Codex 特有规则**（如果需要比 SKILL.md 更深度集成）。
