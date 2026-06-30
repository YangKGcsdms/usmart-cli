# Claude Code · usmart-cli 开发智能体

> 此文件 git 跟踪，随项目走，所有 Claude Code session 启动时自动加载到 context。
> 本机个人 memory 在 `~/.claude/projects/-Users-carter-projects-usmart-cli/memory/` — 本地缓存，**不跟随项目**，仅个人偏好。

## 项目定位

`usmart-cli` 是盈立（yingli）项目下、面向 uSMART 盈立证券开放 API 的命令行工具，参考 `lark-cli` 的设计：

- **技术栈**：Node.js（TypeScript / JavaScript）。
- **目标**：把 uSMART 交易、行情、资产等 API 封装成 CLI 命令，再沉淀为 Claude Code Skills，让智能体可以通过 CLI 直接操作 uSMART。
- **工作模式**：
  1. `usmart usmart config-init` — 初始化 uSMART 账号/环境配置。
  2. `usmart usmart login` / `usmart usmart unlock` — 测试登录与交易解锁。
  3. `usmart usmart <api-command>` — 调用具体 uSMART API（自动完成登录/解锁鉴权）。
  4. `usmart usmart api <method> <path>` — 通用原始 uSMART API 调用。

## CLI 约定（参考 lark-cli）

| 命令 | 作用 |
|---|---|
| `usmart usmart config-init` | 初始化 uSMART 配置文件 |
| `usmart usmart login` | 测试 uSMART 登录 |
| `usmart usmart unlock` | 测试 uSMART 交易解锁 |
| `usmart usmart status` | 查看 uSMART 会话状态 |
| `usmart usmart holding` | 查询持仓 |
| `usmart usmart asset` | 查询综合资产 |
| `usmart usmart today-entrust` | 今日委托 |
| `usmart usmart place-order` | 下单（高风险，需 `--yes`） |
| `usmart usmart cancel-order` | 撤单（高风险，需 `--yes`） |
| `usmart usmart api POST /...` | 通用 uSMART API 调用 |

### 全局参数

- `--profile <name>`：使用指定 profile（多环境/多账号）。
- `--format json|table|csv|pretty`：输出格式，默认 `json`。
- `--jq <expr>` / `-q <expr>`：用 jq 过滤 JSON 输出。
- `--dry-run`：只打印请求，不执行。
- `--yes`：高风险写操作自动确认。

## 本地开发约定

| 项 | 值 |
|---|---|
| 工作目录 | `/Users/carter/projects/yingli/usmart-cli` |
| 入口 | `bin/usmart` |
| 包管理 | npm / pnpm |
| 后端项目 | `../yingli_java` |
| 后端本地地址 | `http://localhost:9999` |
| uSMART 配置 | `~/.config/usmart-cli/usmart.json` |

## 项目级 Skills（本仓库 `skills/` 提供，所有人共享）

| skill | 触发场景 | 入口 |
|---|---|---|
| **usmart-auth** | 初始化配置、登录、登出、查看状态、doctor | [SKILL](skills/usmart-auth/SKILL.md) |
| **usmart-api-to-skill** | 把新的 uSMART API 封装成 CLI 命令或 Skill | [SKILL](skills/usmart-api-to-skill/SKILL.md) |
| **usmart** | uSMART 盈立证券 API：持仓、资产、行情、下单、撤单 | [SKILL](skills/usmart/SKILL.md) |
| usmart-cli-dev | CLI 项目本身的开发规范、命令设计、测试 | [SKILL](skills/usmart-cli-dev/SKILL.md) |

> 这些 skill 同时会被 `npx skills add YangKGcsdms/usmart-cli`（或 `usmart install`）分发到 Claude Code / Cursor / Codex 等 agent。

## 协作 / 流程约定

- **写 main 走 PR**：hook 拦 `push origin main` / `commit on main`，必须开 `fix/*` / `feat/*` 分支 + `gh pr create`。
- **commit 关联飞书任务**：commit message footer 写 `Refs: base/<rec_xxx>`，便于回填飞书任务状态。
- **发版**：待补充（建议 `npm version` + GitHub Release）。

## 安全规则

- **禁止在代码或终端明文输出密钥、token、RSA 私钥**。
- uSMART 配置保存在 `~/.config/usmart-cli/usmart.json`，文件权限 600，不进入 git。
- 交易写操作默认需要 `--yes` 确认；先 `--dry-run` 预览。

## 关联文档

- 主项目记忆：`../yingli_java/CLAUDE.md`
- 主项目设计：`../yingli_java/docs/DESIGN.md`、`../yingli_java/docs/WORKFLOW.md`
- API 文档：`../yingli_java/docs/usmart-api.md`
- 智能体分发评审：`docs/agent-distribution-review.md`
