---
name: usmart-derivatives
version: 2.0.0
description: "uSMART 美股期权与 MA 策略账户交易：期权下单改单撤单、期权购买力与改单状态、期权今日订单与详情；MA 策略下单撤单、订单列表详情、策略购买力。当用户要交易期权、查期权订单，或使用 MA 策略账户下单时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart option --help"
---

# usmart option / usmart ma —— 期权与 MA 策略账户

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)。两个域都是高风险写操作为主。

## 美股期权（`usmart option`）

```bash
usmart option purchase-power --symbol AAPL260918C00300000 --side 1 --qty 1 --price 5.2   # 先看能不能买
usmart option place --symbol AAPL260918C00300000 --side 1 --qty 1 --order-type 2 --price 5.2 --dry-run
usmart option place --symbol AAPL260918C00300000 --side 1 --qty 1 --order-type 2 --price 5.2 --yes
usmart option list                       # 今日订单（--market 51=美股期权）
usmart option detail --order-id <id>
usmart option replace-power --order-id <id> --price 5.5      # 改单前先查
usmart option replace --order-id <id> --qty 1 --price 5.5 --yes
usmart option replace-status --order-id <id>                 # 改单是异步的，要查状态
usmart option cancel --order-id <id> --yes
```

| 参数 | 说明 |
|---|---|
| `--side` | `1`=买 `2`=卖 |
| `--order-type` | `1`=市价单 `2`=限价单（限价必须给 `--price`） |
| `--business-type` | `O`=期权（默认） `OS`=期权沽空 |
| `--qty` / `--price` | 最多两位小数，需 > 0 |

`requestId`（10~36 位）由 CLI 自动生成。**期权改单是异步的**：`replace` 返回成功只代表受理，
必须再用 `replace-status` 确认最终结果。

## MA 策略账户（`usmart ma`）

```bash
usmart ma purchase-power --strategy-id 123 --stock-id AAPL --op-type 0 --price 150 --amount 10
usmart ma place --strategy-id 123 --stock-id AAPL --trade-type 1 --op-type 0 \
  --order-type 1 --quantity 10 --price 150 --dry-run
usmart ma list --strategy-id 123 --today 1
usmart ma detail --ma-order-id <id>
usmart ma cancel --ma-order-id <id> --yes
```

| 参数 | 说明 |
|---|---|
| `--trade-type` | `1`=买 `2`=卖 |
| `--op-type` | `0`=买 `1`=卖 |
| `--order-type` | `1`=限价 `2`=增强限价 `3`=市价 `4`=竞价 `5`=竞价现价 `6`=条件单 |
| `--pre-post` | `1`=不允许盘前盘后（默认） `2`=允许 |

> **价格单位**：MA 原始接口要求「每股价格 × 10000」。CLI 的 `--price` 收**真实价格**并自动换算，
> 不要自己先乘 10000。用 `--dry-run` 可以看到实际发出的 `sellPrice`。

MA 与期权都需要账户开通对应权限，未开通时会返回权限类错误码而不是参数错。
