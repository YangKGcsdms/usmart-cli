# usmart-cli

uSMART 盈立证券命令行工具。

参考 [lark-cli](https://github.com/larksuite/cli) 设计，让 AI Agent（Claude Code、Cursor、Codex 等）和人类开发者都能通过命令行操作 uSMART 的交易、行情、资产与委托接口。

[![npm version](https://img.shields.io/npm/v/usmart-cli.svg)](https://www.npmjs.com/package/usmart-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 特性

- **自动鉴权**：登录与交易解锁根据配置无感触发，token 过期自动重登。
- **AOP 式过期处理**：参考 Java 后端 `UsmartAspect`，只读接口自动重试，交易接口安全抛错避免重复下单。
- **完整 API 覆盖**：持仓、资产、委托、成交、行情、K 线、下单、撤单、碎股等。
- **AI Agent 友好**：统一 `SKILL.md` 格式，可通过 `npx skills add` 分发到 Claude / Cursor / Codex。
- **安全默认**：交易写操作需 `--yes` 确认，RSA 私钥与密码只保存在本地配置文件。

## 安装

```bash
npm install -g usmart-cli
```

安装完成后，终端会打印下一步指引。

## 快速开始

### 1. 初始化配置

```bash
usmart usmart config-init
```

编辑生成的配置文件 `~/.config/usmart-cli/usmart.json`：

```json
{
  "account": {
    "lang": "1",
    "channel": "YOUR_CHANNEL",
    "areaCode": "86",
    "phoneNumber": "YOUR_PHONE",
    "loginPassword": "YOUR_LOGIN_PASSWORD",
    "tradePassword": "YOUR_TRADE_PASSWORD",
    "publicKey": "BASE64_X509_PUBLIC_KEY",
    "privateKey": "BASE64_PKCS8_PRIVATE_KEY"
  },
  "env": {
    "tradeHost": "https://...",
    "quoteHost": "https://...",
    "type": 0
  }
}
```

> ⚠️ 该文件包含敏感信息，已自动设置 `600` 权限，请勿提交到 git。

### 2. 测试登录

```bash
usmart usmart login
```

### 3. 查看持仓

```bash
usmart usmart holding --exchange-type 100
```

### 4. 查看行情

```bash
usmart usmart realtime --secu-ids usAAPL,hk00700
usmart usmart kline --secu-id usAAPL --type 7 --count 100
```

## 常用命令

### 资产 / 账户

```bash
usmart usmart asset
usmart usmart holding --exchange-type 100
usmart usmart account-type --market-type 5
usmart usmart trade-quantity --stock-code AAPL --exchange-type 5 --entrust-prop LO --entrust-price 150
```

### 委托 / 成交 / 流水

```bash
usmart usmart trade-status
usmart usmart today-entrust --exchange-type 100
usmart usmart his-entrust --exchange-type 5 --date-flag 7
usmart usmart order-detail --entrust-id 123456
usmart usmart stock-record --exchange-type 5 --begin-time 2026-01-01 --end-time 2026-06-30
usmart usmart business-flow --begin-time 2026-01-01 --end-time 2026-06-30
```

### 行情

```bash
usmart usmart realtime --secu-ids usAAPL,hk00700
usmart usmart market-state --market us
usmart usmart kline --secu-id usAAPL --type 7 --start 0 --count 100
usmart usmart order-book --secu-id usAAPL
```

### 交易（高风险，需要 `--yes`）

```bash
usmart usmart place-order --data @order.json --yes
usmart usmart cancel-order --entrust-id 123456 --yes
usmart usmart odd-entrust --data @odd.json --yes
usmart usmart odd-modify --data @odd.json --yes
```

### 通用 API

```bash
usmart usmart api POST /stock-order-server/open-api/today-entrust --data '{"exchangeType":100}'
usmart usmart api POST /quotes-openservice/api/v1/realtime --data '{"secuIds":["usAAPL"]}' --quote
```

## AI Agent 使用

### 安装 Skills

```bash
npx skills add YangKGcsdms/usmart-cli -y -g
```

安装后，Claude Code / Cursor / Codex 等 Agent 即可调用 `usmart` 命令。

### 对 Agent 的提示

- 操作 uSMART 资源时，优先使用 `usmart usmart <command>`。
- 执行写操作前，先用 `--dry-run` 预览（待实现），并询问用户确认。
- 遇到 `300101` 错误，CLI 会自动重登；交易类命令会提示重新发起。

## 开发

```bash
git clone https://github.com/YangKGcsdms/usmart-cli.git
cd usmart-cli
npm install
npm test
```

## 测试

```bash
npm test
```

包含 RSA 加签、配置读写、会话管理、HTTP 请求构造等单元测试，全部使用 mock，不调用真实 API。

## 架构

```
usmart-cli/
├── bin/usmart              # CLI 入口
├── src/
│   ├── cli.js              # 命令注册
│   ├── commands/
│   │   └── usmart.js       # uSMART API 命令
│   └── lib/
│       ├── rsa.js          # RSA 加密/签名
│       ├── usmart-client.js # HTTP 客户端
│       ├── session.js      # 会话管理 + AOP 过期处理
│       └── usmart-config.js # 配置读写
├── skills/                 # AI Agent Skills
├── test/                   # 单元测试
└── docs/                   # 文档
```

## 安全

- 配置文件 `~/.config/usmart-cli/usmart.json` 权限为 `600`。
- RSA 私钥、登录密码、交易密码只保存在本地，不进入 git。
- 交易写操作必须带 `--yes` 才会执行。

## 许可证

[MIT](LICENSE)
