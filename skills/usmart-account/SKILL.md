---
name: usmart-account
version: 2.0.0
description: "uSMART 账户与资产：查询综合资产与持仓盈亏、持仓列表、账户类型（现金/融资）、融资利率与融资账户详情、股票抵押比率、资金流水、汇率、交易密码与登录密码管理。当用户问「我有多少钱/持仓/盈亏/购买力/融资利率/入金出金记录/汇率」时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart account --help"
---

# usmart account —— 账户与资产

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)。

## 资产与持仓

```bash
usmart account asset                      # 综合资产（按资金账户 × 币种拆分，含持仓）
usmart account asset --money-type 1       # 只看美元（0=CNY 1=USD 2=HKD）
usmart account holding                    # 持仓列表（默认全市场）
usmart account holding --exchange-type 5  # 只看美股
```

`asset` 的结构要点：

- `data.assetSingleInfoRespVOS[]` —— **一个资金账号会按币种出现多条**，`moneyType` 区分
- 每条里 `asset` 总资产、`cashBalance` 现金（可为负 = 欠款）、`marketValue` 市值、`purchasePower` 购买力
- `holdInfos[]` 是该账户下的持仓：
  - **持仓盈亏字段是 `holdProfit` / `holdProfitPercent`**（不是 `holdingProfit`）
  - `todayProfit` 今日盈亏，`curHoldNum` 数量（可为小数=碎股），`costPrice` 成本价，`lastPrice` 现价
- `data.totalAssetValue` / `totalMarketValue` 是**按 `data.moneyType` 那一种币计**的汇总，跨币种不要直接相加

看盈亏最快的方式：

```bash
usmart --format table --jq '.data.assetSingleInfoRespVOS[].holdInfos[]' account asset
```

## 账户属性

```bash
usmart account type --market-type 5       # data.assetProp：0=现金账户 M=融资账户
usmart account margin-rate                # 融资利率（cny/hkd/usdRateValue，%）
usmart account margin-detail --exchange-type 5   # 融资账户详情：购买力、欠款、预计利息、维持率
usmart account mortgage-list --exchange-type 0 --stock-code 00700   # 某只股票的抵押比率
usmart account mortgage-list --exchange-type 0 --all                # 全量（不分页）
```

> `account type` 的返回体只有 `assetProp` 一个有效字段，其余为 `null` 是**接口设计如此**，不是错误。
> `margin-rate` 不传 `--fund-account` 时，CLI 会先查资产、取第一个资金账号。

## 资金流水与汇率

```bash
usmart account flow                                        # 全部流水
usmart account flow --type 0 --page-size 20                # 只看入金（0=入金 1=出金 2=货币兑换）
usmart account flow --date-type 9 --start-time 2026-01-01 --end-time 2026-08-25
usmart account exchange-rate                               # 盈立/中银 买入卖出汇率
```

`--date-type`：`-1=全部 0=近1月 1=近3月 2=近1年 3=今年 9=自定义`（9 时必须给 start/end）。

## 密码管理（全部是高风险写操作）

```bash
usmart account check-trade-password                 # 只读校验，用配置里的密码
usmart account set-trade-password --password 123456 --yes
usmart account update-trade-password --old-password 111111 --password 222222 --yes
usmart account reset-trade-password --password 222222 --captcha 1234 --yes   # 先 auth send-captcha --type 102
usmart account update-login-password --old-password old --password new --yes
usmart account reset-login-password --password new --captcha 1234 --yes
```

**改完密码要同步更新配置文件里的 `loginPassword` / `tradePassword`，否则后续命令会登录失败。**
交易密码必须 6 位纯数字；登录密码 8~24 位、不能纯数字/纯字母/纯符号。
`310104` 密码错误不要重试——`301002` 会直接锁定账号。

## 出金撤销

```bash
usmart account cashout-revoke --id <出金记录id> --dry-run
usmart account cashout-revoke --id <出金记录id> --yes
```
