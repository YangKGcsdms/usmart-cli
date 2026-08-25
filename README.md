# usmart-cli

uSMART 盈立证券命令行工具。**完整覆盖官方 Open API**：交易、行情、资产、IPO 打新、美股期权、MA 策略账户，以及 WebSocket 实时行情推送。

参考 [lark-cli](https://github.com/larksuite/cli) 设计，让 AI Agent（Claude Code、Cursor、Codex 等）和人类开发者都能通过命令行操作 uSMART。

[![npm version](https://img.shields.io/npm/v/usmart-cli.svg)](https://www.npmjs.com/package/usmart-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 特性

- **完整 API 覆盖** —— 官方文档 57 个交易接口 + 7 个行情接口 + WebSocket 推送协议，全部封装
- **自动鉴权** —— 登录与交易解锁无感触发，token 过期自动重登；交易接口安全抛错避免重复下单
- **对智能体友好** —— 稳定的退出码、结构化错误信封（`type`/`code`/`hint`）、stdout 只放数据
- **安全默认** —— 写操作需 `--yes`，`--dry-run` 可预览真实请求；配置与会话文件 600 权限
- **内置数据字典** —— `usmart dict` 查市场/币种/订单状态/委托属性等 30 张官方字典，不用硬编码魔法数字
- **多账号** —— `--profile` 切换环境与账号
- **客户端限流** —— 按官方 120/min、20/min 限制自动节流

## 安装

```bash
npm install -g usmart-cli
usmart install          # 把 skills 装到 Claude Code / Cursor / Codex 等
```

## 快速开始

```bash
usmart auth config-init                   # 生成 ~/.config/usmart-cli/usmart.json
# 编辑配置填入账号、RSA 密钥、环境地址
usmart doctor --online                    # 检查配置并联网登录一次

usmart account asset                      # 我的资产与持仓
usmart quote realtime --secu-ids usAAPL,hk00700
usmart order today                        # 今日订单
```

配置文件：

```json
{
  "account": {
    "lang": "1", "channel": "渠道号", "areaCode": "86", "phoneNumber": "手机号",
    "loginPassword": "登录密码", "tradePassword": "6位交易密码",
    "publicKey": "Base64 X509/SPKI 公钥", "privateKey": "Base64 PKCS8 私钥",
    "deviceType": "t5"
  },
  "env": {
    "tradeHost": "https://open-jy.yxzq.com",
    "quoteHost": "https://open-hz.yxzq.com:8443",
    "pushHost": "wss://open-hz.yxzq.com:8443/wss/v1"
  }
}
```

> ⚠️ 含登录密码、交易密码、RSA 私钥，已自动设为 `600` 权限，**不要提交到 git**。

## 命令总览

```
usmart <domain> <command> [options]
```

| Domain | 说明 |
|---|---|
| `auth` | 配置、profile、登录、交易解锁、会话状态、验证码登录 |
| `account` | 资产、持仓、账户类型、融资利率/详情、抵押比率、资金流水、汇率、密码管理 |
| `order` | 下单、改单、撤单、碎股、可买卖数量、今日/历史订单、订单明细、成交流水 |
| `quote` | 实时、市场状态、K 线、分时、逐笔、买卖盘、基础信息、WebSocket 推送 |
| `ipo` | 新股列表/详情、认购、改单、撤单、申购记录 |
| `option` | 美股期权下单/改单/撤单、购买力、改单状态、订单列表与详情 |
| `ma` | MA 策略账户下单/撤单、订单列表与详情、策略购买力 |
| `dict` | 官方数据字典查询 |
| `api` | 通用兜底调用 |
| `doctor` | 健康检查（`--online` 做真实登录探测） |

### 全局参数

| 参数 | 说明 |
|---|---|
| `--profile <name>` | 多账号/多环境 |
| `--format json\|table\|csv\|pretty` | 输出格式 |
| `--jq <expr>` | 过滤输出，多值按 NDJSON 逐行输出 |
| `--dry-run` | 只打印请求，不发送 |
| `--yes` | 确认高风险写操作 |
| `--data <json\|@file>` | 追加/覆盖请求体字段 |

## 常用示例

```bash
# 资产与盈亏
usmart account asset
usmart --format table --jq '.data.assetSingleInfoRespVOS[].holdInfos[]' account asset
usmart account margin-rate                     # 融资利率
usmart account flow --type 0                   # 入金记录

# 行情
usmart quote realtime --secu-ids usAAPL,hk00700
usmart quote kline --secu-id usAAPL --type 7 --count 100
usmart quote subscribe --topics rt.hk.00700,ob.us.AAPL --duration 30s   # 实时推送

# 交易（先 dry-run，再 --yes）
usmart order max-quantity --stock-code AAPL --exchange-type 5 --price 150
usmart order place --stock-code AAPL --exchange-type 5 --side buy \
  --entrust-prop 0 --price 150 --amount 10 --dry-run
usmart order cancel --entrust-id 123456 --yes

# 打新
usmart ipo list --status 0
usmart ipo apply --ipo-id <id> --apply-type 1 --quantity 100 --yes

# 字典与兜底
usmart dict get exchange-type 5                # → 美股
usmart api POST /stock-order-server/open-api/today-entrust --data '{"exchangeType":100}'
```

## 退出码

**用退出码判断成败，不要猜 JSON 形状。**

| 码 | 含义 |
|---|---|
| `0` | 成功 |
| `1` | 一般错误（配置缺失/损坏、网络、超时） |
| `2` | API 错误（HTTP 非 2xx 或 `code != 0`） |
| `3` | 参数错误 |
| `10` | 高风险写操作未确认 |

失败时 stdout：

```json
{"ok":false,"error":{"type":"api_error","message":"未查询到记录","code":"409933","hint":"检查 entrustId / serialNo 是否正确"}}
```

## AI Agent 使用

```bash
usmart install                                   # 或 npx skills add YangKGcsdms/usmart-cli -y -g
```

安装 8 个 skill：`usmart-shared`（公共约定，先读这篇）、`usmart-auth`、`usmart-account`、
`usmart-order`、`usmart-quote`、`usmart-ipo`、`usmart-derivatives`、`usmart-cli-dev`。

```bash
usmart skills list
usmart skills read usmart-order
```

## 接口覆盖

对照 [官方文档](https://api-doc.usmart8.com/zh-cn/)：

| 模块 | 官方接口数 | 覆盖 |
|---|---|---|
| 登录/密码/用户信息 | 13 | 13 |
| 交易及查询 | 13 | 13 |
| IPO 认购 | 7 | 7 |
| 资金记录 | 3 | 3 |
| 孖展 | 1 | 1 |
| MA 账户 | 5 | 5 |
| 期权 | 8 | 8 |
| 基础行情 | 7 | 7 |
| 行情推送（WebSocket） | 1 套协议 | ✅ |

未封装的接口可用 `usmart api POST <path> --data '{}'` 直接调用。

## 环境变量

| 变量 | 作用 |
|---|---|
| `USMART_CONFIG_DIR` | 覆盖配置目录（配置与会话缓存一起） |
| `USMART_PROFILE` | 默认 profile |
| `USMART_TIMEOUT_MS` | HTTP 超时，默认 20000 |
| `USMART_NO_RATE_LIMIT` | 关闭客户端限流 |
| `USMART_QUOTE_MIN_INTERVAL_MS` | 行情请求最小间隔，默认 400 |
| `USMART_DEBUG` | 错误信封里带堆栈 |
| `USMART_SKIP_QUOTE` | 集成测试专用：跳过行情用例（行情网关被 403 封禁时用） |

## 开发

```bash
git clone https://github.com/YangKGcsdms/usmart-cli.git
cd usmart-cli && npm install
npm test                   # 单元测试（全 mock，不联网）
npm run test:integration   # 只读集成测试（需真实配置；不发送任何交易）

# 行情网关被限流封禁（HTTP 403）时，可临时跳过行情用例
USMART_SKIP_QUOTE=1 npm run test:integration
```

集成测试**只跑只读命令**；20 条写操作（下单/改单/撤单/IPO 认购/期权/MA/密码/出金）
只验证「不带 `--yes` 退出码 10」与「`--dry-run` 请求 URL 和 body 正确」，绝不真实发送。

## 架构

```
src/
├── cli.js                 # 组装 program、全局 flag
├── lib/
│   ├── registry.js        # 命令注册框架
│   ├── usmart-client.js   # HTTP + RSA 签名
│   ├── session.js         # 登录/解锁/过期重试
│   ├── session-cache.js   # token 落盘（profile + 指纹隔离）
│   ├── usmart-config.js   # 配置与 profile 解析
│   ├── rsa.js             # 加密与签名
│   ├── request-id.js      # 19 位唯一 requestId
│   ├── json-safe.js       # int64 不丢精度
│   ├── errors.js          # CliError + 退出码 + 官方错误码表
│   ├── validate.js        # 参数校验
│   ├── output.js          # json/table/csv/pretty + jq
│   ├── rate-limit.js      # 客户端限流
│   ├── dict.js            # 数据字典
│   └── push.js            # WebSocket 推送
└── commands/              # auth account order quote ipo ma option dict api doctor skills
```

## 许可证

[MIT](LICENSE)
