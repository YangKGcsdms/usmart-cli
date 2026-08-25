---
name: usmart-order
version: 2.0.0
description: "uSMART 股票交易与委托：下单、改单、撤单、港股碎股、最大可买可卖数量、融资可买股数、今日订单、历史订单、订单明细、成交流水。当用户要买入卖出股票、撤改订单、查订单成交记录、问能买多少股时触发。所有写操作需要 --yes 且建议先 --dry-run。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart order --help"
---

# usmart order —— 股票交易与委托

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)（高风险门禁、退出码、`session_expired` 重发规则）。

## 下单前的必经步骤

1. 查行情确认价格：`usmart quote realtime --secu-ids usAAPL`
2. 查能买多少：`usmart order max-quantity --stock-code AAPL --exchange-type 5 --price 150`
3. `--dry-run` 打出请求给用户看
4. 用户明确确认后才加 `--yes`

```bash
usmart order max-quantity --stock-code AAPL --exchange-type 5 --price 150
# → buyEnableAmount 可买 / saleEnableAmount 可卖 / maxPurchasingPower 最大购买力 / handAmount 每手股数
usmart order margin-quantity --stock-code AAPL --exchange-type 5 --amount 10 --price 150   # 融资可买
```

## 下单

```bash
usmart order place \
  --stock-code AAPL --exchange-type 5 \
  --side buy --entrust-prop 0 --price 150 --amount 10 --dry-run

usmart order place --stock-code 00700 --exchange-type 0 \
  --side buy --entrust-prop e --price 330.4 --amount 100 --yes
```

| 参数 | 说明 |
|---|---|
| `--exchange-type` | `0`=港股 `5`=美股 `6`=沪港通 `7`=深港通 |
| `--side` | `buy` / `sell`（也接受 `0`/`1`） |
| `--entrust-prop` | `0`=限价单 `d`=竞价单 `e`=增强限价单 `g`=竞价限价单 `w`=市价单。见 `usmart dict get entrust-prop` |
| `--price` | 竞价单/市价单传 `0` |
| `--session-type` | `1`=盘前 `2`=盘后 `3`=暗盘 `12`=盘前盘后，缺省=正常时段 |
| `--force` | 超 9 倍 24 档时强制委托，**可能变废单** |
| `--with-password` | 随单附带加密的交易密码（部分账户逐单校验而非会话解锁），`place`/`modify`/`cancel` 均支持 |

`serialNo`（19 位幂等流水号）由 CLI 自动生成，需要自己控制时用 `--serial-no`。
成功返回 `data.entrustId` —— **后续改单/撤单/查明细都靠它，务必留存**。

## 改单 / 撤单

```bash
usmart order modified-range --entrust-id 123456 --new-price 152    # 先查允许的改单范围
usmart order modify --entrust-id 123456 --price 152 --amount 10 --yes
usmart order cancel --entrust-id 123456 --yes
```

## 港股碎股

```bash
usmart order odd-place --stock-code 00700 --price 330 --amount 30 --yes   # 碎股只支持卖出
usmart order odd-cancel --odd-id 999 --yes
```

## 查询

```bash
usmart order today                                    # 今日订单（默认全市场）
usmart order today --exchange-type 5 --stock-code AAPL
usmart order history --exchange-type 5 --date-flag 7  # 1=近1周 2=近1月 3=近3月 4=近1年 5=今年 6=自选 7=全部
usmart order history --exchange-type 5 --date-flag 6 --begin-date 2026-01-01 --end-date 2026-08-25
usmart order detail --entrust-id 123456               # 或 --serial-no
usmart order fills --exchange-type 5 --begin-time 2026-01-01 --end-time 2026-08-25
```

要点：

- **`entrustId` 是 int64，CLI 会把超过 2^53 的整数保留成字符串**，别再转成 Number，会丢精度导致撤错单
- 订单状态见 `usmart dict get order-status`：`0`=全部成交 `2`=待成交 `3`=部分成交 `6`=已撤单 `8`=废单
- `order detail` 对较早的历史订单会返回 `409933 未查询到记录`，这是明细库的保留期限制，不是参数错

## 交易类命令的过期重试

交易命令遇到 `300101`，CLI 会先完成重登，然后抛 `session_expired`（`retryable: true`）**而不是自动重发**——
这是为了避免重复下单。看到它就原样重跑一次同一条命令即可。
