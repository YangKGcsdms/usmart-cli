---
name: usmart
version: 1.0.0
description: "盈立 uSMART 证券 API CLI 操作。当用户需要查询持仓、资产、行情、委托、成交、下单、撤单或测试登录/交易解锁时使用。所有命令会自动完成登录鉴权和交易解锁。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart usmart --help"
---

# usmart usmart

## 前置准备

1. 初始化配置文件：
   ```bash
   usmart usmart config-init
   ```
   这会生成 `~/.config/usmart-cli/usmart.json` 模板。

2. 编辑该文件，填入账号、RSA 密钥、环境地址。

3. 设置文件权限为仅本人可读（自动已设置 600）。

## 自动鉴权机制（参考 Java AOP）

所有命令会自动处理：

- **登录**：token 不存在或失效时自动调用 `/user-server/open-api/login`
- **交易解锁**：交易写操作前自动调用 `/user-server/open-api/trade-login`
- **token 过期（300101）**：只读命令自动重试；交易命令提示重新发起
- **交易锁过期（409984）**：自动重新解锁并重试

## 命令清单

### 鉴权测试

```bash
usmart usmart login
usmart usmart unlock
usmart usmart status
```

### 资产 / 账户

```bash
usmart usmart asset [--money-type 0|1|2]
usmart usmart holding [--exchange-type 0|5|100]
usmart usmart account-type [--market-type 0|5]
usmart usmart trade-quantity --stock-code AAPL --exchange-type 5 --entrust-prop LO --entrust-price 150.0
usmart usmart margin-detail [--exchange-type 0|5]
usmart usmart rate-info [--exchange-type 0|5]
usmart usmart mortgage-list [--exchange-type 0|5]
```

### 委托 / 成交 / 流水

```bash
usmart usmart trade-status
usmart usmart today-entrust [--exchange-type 100] [--page-num 1] [--page-size 20]
usmart usmart his-entrust --exchange-type 5 --date-flag 7
usmart usmart order-detail --entrust-id 123456
usmart usmart stock-record --exchange-type 5 --begin-time 2026-01-01 --end-time 2026-06-30
usmart usmart business-flow --begin-time 2026-01-01 --end-time 2026-06-30 [--biz-type DIV]
usmart usmart currency-exchange --begin-date 2026-01-01 --end-date 2026-06-30
```

### 行情

```bash
usmart usmart realtime --secu-ids usAAPL,hk00700
usmart usmart market-state --market hk|us|sh|sz
usmart usmart kline --secu-id usAAPL --type 7 --start 0 --count 100
usmart usmart order-book --secu-id usAAPL
```

### 交易（高风险，需要 `--yes`）

```bash
# 下单
usmart usmart place-order --data @order.json --yes

# 撤单
usmart usmart cancel-order --entrust-id 123456 --yes

# 港股碎股
usmart usmart odd-entrust --data @odd.json --yes
usmart usmart odd-modify --data @odd.json --yes
```

### 通用 API

```bash
usmart usmart api POST /stock-order-server/open-api/today-entrust --data '{"exchangeType":100}'
usmart usmart api POST /quotes-openservice/api/v1/realtime --data '{"secuIds":["usAAPL"]}' --quote
```

## 安全规则

- **不要**把 `usmart.json` 提交到 git。
- 交易写操作必须先 `--dry-run` 预览（待实现）。
- 写操作不带 `--yes` 会退出码 10，返回 `confirmation_required`。

## 错误处理

| 错误 | 处理 |
|---|---|
| `300101` token 过期 | 只读命令自动重登重试；交易命令提示重新发起 |
| `409984` 交易锁过期 | 自动重新解锁并重试 |
| 配置文件缺失 | 提示运行 `usmart usmart config-init` |
| RSA 签名失败 | 检查 `publicKey` / `privateKey` 格式是否为 Base64 编码 |
