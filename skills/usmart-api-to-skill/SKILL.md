---
name: usmart-api-to-skill
version: 1.0.0
description: "把盈立后端 API 封装成 usmart-cli 命令，再沉淀为 Claude Code Skill。当需要新增领域命令、把现有 API 暴露给智能体、或为某个业务模块生成 skill 时触发。"
---

# API → CLI 命令 → Skill

## 整体流程

1. **确定领域（domain）**：例如 `trade`（交易）、`account`（账户）、`position`（持仓）、`order`（订单）、`kline`（行情）。
2. **找到 API**：从 `../yingli_java/docs/usmart-api.md` 或后端 controller 提取接口信息。
3. **实现 CLI 命令**：在 `src/commands/<domain>.js` 中注册子命令/快捷方式。
4. **测试命令**：先用 `--dry-run` 预览，再用真实环境验证。
5. **生成 Skill**：在 `skills/usmart-<domain>/SKILL.md` 中写入调用示例和最佳实践。

## CLI 命令设计规范

### 领域命令结构

```bash
usmart <domain> <resource> <method> [options]
usmart <domain> +<shortcut> [options]
```

示例：

```bash
usmart trade order list --status open --limit 20
usmart trade +orders --status open
usmart account profile get
usmart account +me
```

### 快捷命令（shortcut）

快捷命令以 `+` 开头，面向智能体高频场景：

| shortcut | 对应命令 | 用途 |
|---|---|---|
| `usmart trade +orders` | `usmart trade order list` | 查看当前订单 |
| `usmart account +me` | `usmart account profile get` | 查看当前用户信息 |
| `usmart position +list` | `usmart position list` | 查看持仓 |

### 参数命名

- 查询参数：`--params '{"key":"value"}'` 或拆成独立 flag。
- 请求体：`--data @path.json`（优先从文件读取）或 `--data '{"key":"value"}'`。
- 分页：`--page-all`、`--page-size`、`--page-limit`。
- 输出过滤：`--jq '.data.items'` / `-q '.data.items'`。

## 实现步骤

### 1. 在 CLI 中注册命令

在 `src/commands/<domain>.js` 中：

```javascript
import { createCommand } from '../lib/command.js';

export default function tradeCommand(program) {
  const trade = program.command('trade').description('交易相关');

  trade
    .command('order list')
    .description('查询订单列表')
    .option('--status <status>', '订单状态')
    .option('--limit <n>', '返回条数', '20')
    .action(async (options) => {
      const client = await getClient();
      const res = await client.get('/api/trade/orders', {
        status: options.status,
        limit: options.limit,
      });
      printJson(res.data);
    });

  // shortcut
  trade
    .command('+orders')
    .description('快捷：查询订单列表')
    .option('--status <status>', '订单状态')
    .action(async (options) => {
      // 复用上面的逻辑或调用内部函数
    });
}
```

### 2. 通用 API 命令兜底

```bash
usmart api GET /api/trade/orders --params '{"status":"open"}'
usmart api POST /api/trade/orders --data @order.json
```

### 3. 生成 Skill

为每个领域创建 `skills/usmart-<domain>/SKILL.md`，包含：

- 触发场景
- 常用命令示例
- 注意事项（权限、必填参数、高风险操作）
- 错误处理

## Skill 模板

```markdown
---
name: usmart-<domain>
version: 1.0.0
description: "盈立 <domain> 领域 CLI 操作。当用户需要 <场景> 时触发。"
---

# usmart <domain>

## 常用命令

```bash
usmart <domain> +<shortcut>
```

## 注意事项

- 需要 scope: `<scope_name>`
- 高风险操作：`usmart <domain> <action>` 需要 `--yes`

## 错误处理

- `401`：执行 `usmart auth login --scope "<scope_name>"`
- `403`：检查 bot/user 身份，确认 scope 已开通
```

## 测试 checklist

- [ ] `--dry-run` 打印的请求 URL / method / params / body 正确。
- [ ] 正常参数返回预期 JSON。
- [ ] 缺参时 CLI 给出清晰错误。
- [ ] 401/403 时错误提示包含推荐的 `auth login` 命令。
- [ ] 高风险操作不带 `--yes` 时退出码 10，并返回 `confirmation_required`。
