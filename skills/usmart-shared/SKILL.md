---
name: usmart-shared
version: 2.0.0
description: "usmart-cli 的公共约定：配置与 profile、自动鉴权、输出信封、退出码、错误码表、高风险写操作门禁、数据字典、限流。任何 usmart-* skill 开工前先读这一篇；遇到 usmart 命令报错、退出码非 0、需要判断成败时也读这里。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart --help"
---

# usmart-cli 公共约定

所有 `usmart` 命令共享本篇的约定。领域用法见 `usmart-auth` / `usmart-account` / `usmart-order` / `usmart-quote` / `usmart-ipo` / `usmart-derivatives`。

## 命令形状

```
usmart <domain> <command> [options]
usmart api POST <path> [--data '{}'] [--quote]     # 兜底：调用未封装的接口
```

domain：`auth` `account` `order` `quote` `ipo` `ma` `option` `dict`，外加 `doctor` / `skills` / `api`。

> 1.x 的 `usmart usmart <cmd>` 仍可用，但会在 stderr 打弃用提示。新代码一律用 `usmart <domain> <cmd>`。

## 全局参数

| 参数 | 说明 |
|---|---|
| `--profile <name>` | 多账号/多环境。`default` → `<配置目录>/usmart.json`，其他 → `<name>.json` |
| `--format json\|table\|csv\|pretty` | 默认 `json` |
| `--jq <expr>` | 过滤输出。本机装了 `jq` 就是完整 jq 语法；否则支持 `.a.b[0].c` / `.a[]`。多值结果按 NDJSON 逐行输出 |
| `--dry-run` | 只打印将发起的请求（method/url/body/脱敏 header），不发送 |
| `--yes` | 确认执行高风险写操作 |
| `--config <path>` | 直接指定配置文件，优先于 `--profile` |
| `--data <json\|@file>` | 追加/覆盖请求体字段，用于命令没暴露的参数。**给了 `--data` 时必填校验降级为 stderr 提示**，方便整体手搓请求体 |

## 判断成败：先看退出码

**stdout 是数据，stderr 是提示。永远用退出码判断成败，不要去猜 JSON 形状。**

| 退出码 | 含义 |
|---|---|
| `0` | 成功（HTTP 2xx 且 `code == 0`） |
| `1` | 一般错误：配置缺失/损坏、网络错误、超时 |
| `2` | API 错误：HTTP 非 2xx，或响应 `code != 0` |
| `3` | 参数错误：缺必填、类型/枚举不合法、`--data` 不是合法 JSON |
| `10` | 高风险写操作未确认（需要 `--yes`） |

失败时 stdout 一定是这个信封：

```json
{
  "ok": false,
  "error": {
    "type": "api_error",
    "message": "未查询到记录",
    "code": "409933",
    "http_status": 200,
    "hint": "检查 entrustId / serialNo 是否正确",
    "retryable": false
  },
  "raw": { }
}
```

`error.type` 是稳定可匹配的：`config_missing` `config_invalid` `invalid_args` `invalid_json` `api_error`
`login_failed` `trade_unlock_failed` `session_expired` `network_error` `timeout` `confirmation_required`
`push_auth_failed` `push_sub_failed` `internal_error`。

成功时 stdout 是接口原样响应 `{code:0, msg, data}`（`auth` 域的状态类命令是 `{ok:true, ...}`）。

## 自动鉴权

登录、交易解锁都是自动的，**不需要手动先跑 login**：

- 首次调用自动 `/user-server/open-api/login`，token 缓存到 `<配置目录>/session.json`（600 权限，按 profile + 账号指纹隔离）
- 写操作前自动 `trade-login` 解锁
- `300101` token 过期：只读命令自动重登重试；**交易命令重登后抛 `session_expired`（retryable:true），需要你原样重发**，这样不会重复下单
- `409984` 交易锁过期：自动重新解锁并重试

## 高风险写操作

下单、改单、撤单、IPO 认购、MA/期权交易、密码修改、出金撤销都是高风险：

```bash
usmart order place ... --dry-run     # 预览，不需要 --yes，不发送
usmart order place ... --yes         # 真正执行
usmart order place ...               # 退出码 10，返回 confirmation_required
```

**给智能体的规则：执行任何写操作前，先 `--dry-run` 把请求打出来给用户看，得到明确确认后再加 `--yes`。**

## 数据字典

不要把魔法数字硬编码进代码，用字典查：

```bash
usmart dict list                      # 所有字典
usmart dict get exchange-type         # 整张表
usmart dict get exchange-type 5       # → {"code":"5","name":"美股"}
usmart dict get order-status 3        # → 部分成交
```

高频记忆项：市场 `0=港股 5=美股 67=A股`；币种 `0=CNY 1=USD 2=HKD`；委托 `entrustType 0=买 1=卖`。

## 常见错误码

| 码 | 含义 | 处理 |
|---|---|---|
| `300101` | token 过期 | CLI 自动处理；交易命令原样重发 |
| `409984` | 交易未解锁 | CLI 自动重新解锁 |
| `409933` | 未查询到记录 | 检查 entrustId/serialNo；订单明细库只保留较近的订单 |
| `409985` | 参数不合法 | 对照 `--help` 与字典检查 |
| `310104` | 交易密码错误 | **不要重试**，连续错误会锁定 |
| `301002` | 交易密码已锁定 | 停止，等待或找回 |
| `107004` | 服务不可用 | 接口路径不存在 |
| `806111` | 非法证券代码或市场 | `secuId` = 市场+代码，如 `usAAPL` / `hk00700` |
| `HTTP_403`（行情 host） | 被网关限流 | 降低频率，等待后重试 |

完整表见 `usmart dict get rate-limit` 与 CLI 内置的错误码表。

## 限流

官方限制：行情高频接口 120 次/分钟，`basicinfo` 20 次/分钟，推送最多 10 个 topic。
CLI 自带客户端滑动窗口限流，超限会自动等待并在 stderr 提示。**即便如此也别写紧密轮询循环**——行情网关会在 HTTP 层直接 403 封一段时间。轮询行情请用 `usmart quote subscribe`（WebSocket 推送）而不是循环调 `realtime`。

## 安全

- 配置文件含登录密码、交易密码、RSA 私钥，权限 600，**绝不提交 git、绝不打印到终端**
- `--dry-run` 输出里的 `Authorization` 与 `X-Sign` 已脱敏
- 不要把 `usmart account asset` 的完整输出贴到公开渠道（含资金账号与持仓）
