---
name: usmart-cli-dev
version: 1.0.0
description: "usmart-cli 项目自身的开发规范：新增/修改 CLI 命令、命令设计、配置、输出格式与测试。当在本仓库开发 CLI 时使用。"
metadata:
  requires:
    bins: ["node"]
  cliHelp: "usmart --help"
---

# Skill: usmart-cli-dev

## 触发场景

- 在 `usmart-cli` 项目中新增、修改 CLI 命令。
- 调整 CLI 框架、命令解析、配置文件、输出格式。
- 编写 CLI 测试或文档。

## 技术栈

- **Node.js 18+**
- 命令解析：[Commander.js](https://github.com/tj/commander.js)
- HTTP 客户端：[axios](https://axios-http.com/) 或内置 `fetch`
- 配置存储：[conf](https://github.com/sindresorhus/conf) 或自研（OS 目录 + keychain）
- 输出格式化：内置 `console.table` / `json` / `csv`
- 测试：[Vitest](https://vitest.dev/) 或 Node 内置 test runner

## 项目结构

```
usmart-cli/
├── bin/usmart              # CLI 入口
├── package.json
├── src/
│   ├── cli.js              # 注册所有命令
│   ├── lib/
│   │   ├── config.js       # 配置读写
│   │   ├── auth.js         # token 管理
│   │   ├── client.js       # HTTP client（自动加 token、baseURL）
│   │   ├── output.js       # 格式化输出
│   │   └── confirm.js      # 高风险确认门禁
│   └── commands/
│       ├── config.js
│       ├── auth.js
│       ├── doctor.js
│       ├── api.js          # 通用 API
│       └── trade.js        # 示例领域命令
└── skills/...
```

## 命令设计规范

1. **参考 lark-cli**：
   - 领域命令：`usmart <domain> <resource> <method>`
   - 快捷命令：`usmart <domain> +<shortcut>`
   - 通用 API：`usmart api <method> <path>`
2. **全局 flag**：`--profile`、`--format`、`--jq` / `-q`、`--dry-run`、`--yes`
3. **输出**：正常结果 stdout，日志/错误 stderr。
4. **错误码**：
   - `0` 成功
   - `1` 一般错误
   - `10` 高风险操作需要 `--yes` 确认
   - `401` 未登录 / token 过期
   - `403` 权限不足

## 新增命令流程

1. 确定属于哪个 domain，在 `src/commands/<domain>.js` 中注册。
2. 在 `src/cli.js` 中导入并挂载该 domain。
3. 用 `--dry-run` 测试请求构造是否正确。
4. 补充 `skills/usmart-<domain>/SKILL.md`。
5. 更新 `CLAUDE.md` 中的 skill 列表。

## 安全约定

- 敏感配置（AppSecret、token）**绝不**写入普通配置文件。
- token 优先使用系统 keychain / Secret Service。
- 写操作默认需要用户确认，通过 `confirm.js` 实现 exit 10 门禁。
- `--dry-run` 必须支持，且不能真正发送请求。

## 测试

```bash
npm test
```

至少覆盖：
- 命令解析（argv → options）
- HTTP client 请求构造
- 配置读写
- 高风险确认门禁
