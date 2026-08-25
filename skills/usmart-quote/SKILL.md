---
name: usmart-quote
version: 2.0.0
description: "uSMART 基础行情与实时推送：实时报价、市场状态、K 线、分时、逐笔成交、买卖盘档位、全市场证券基础信息，以及 WebSocket 订阅实时行情/逐笔/买卖盘。当用户要看股价、走势、K线、盘口、市场开没开盘，或要持续盯盘/实时推送时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart quote --help"
---

# usmart quote —— 行情与推送

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)。

## secuId 的写法

行情接口用 `secuId` = **市场标识 + 证券代码**，不是纯代码：

| 例子 | 含义 |
|---|---|
| `usAAPL` | 美股 苹果 |
| `hk00700` | 港股 腾讯（**保留前导零**） |
| `sh600519` / `sz000001` | 沪 / 深 |

市场标识只有 `hk` `us` `sh` `sz`。写错会返回 `806111 非法的证券代码或者市场`。

## 快照类

```bash
usmart quote realtime --secu-ids usAAPL,hk00700       # 可多只
usmart quote order-book --secu-id hk00700             # 买卖盘档位
usmart quote market-state --market us                 # 开没开盘
usmart quote basicinfo --market hk                    # 全市场代码/名称/类型/每手股数（低频，20次/分钟）
```

`realtime` 返回 `data.list[]`：`latestPrice` 最新价、`open/high/low/preClose`、`volume/turnOver`、
`bidPrice/askPrice` 买一卖一、`upLimit/downLimit` 涨跌停、`trdStatus` 证券状态（`6`=交易中 `1`=停牌，见 `usmart dict get secu-status`）。

`market-state` 的 `status` 见 `usmart dict get market-status`（`4`=连续竞价 `7`=已收盘 `20~25`=港股竞价各阶段），
`tradingDayType` `0`=非交易日 `1`=全天 `2`=上半日 `3`=下半日。

## 历史类

```bash
usmart quote kline --secu-id usAAPL --type 7 --count 100        # 7=日K，见 dict get kline-type
usmart quote kline --secu-id hk00700 --type 2 --count 50 --right 1   # 5分钟K，前复权
usmart quote timeline --secu-id usAAPL --type 0                 # 0=一日分时 1=五日
usmart quote tick --secu-id usAAPL --count 50                   # 逐笔成交
```

翻页：`kline` 把上一页最后一条的 `latestTime` 传给 `--start`；`tick` 把 `time`/`seq` 传给 `--trade-time`/`--seq`。

## 实时推送（WebSocket）

**要持续盯盘就用推送，不要循环调 `realtime`。**

```bash
usmart quote subscribe --topics rt.hk.00700,ob.us.AAPL --duration 30s
usmart quote subscribe --topics tk.us.AAPL --count 100
usmart quote subscribe --topics rt.us.AAPL              # 直到 Ctrl-C
```

- topic 格式 `$type.$market.$code`：`rt`=实时行情 `tk`=逐笔 `ob`=买卖盘
- **最多同时 10 个 topic**，超了服务端返回 `800004`
- stdout 逐行输出 NDJSON `{"topic":...,"data":{...},"receivedAt":...}`，可直接管道消费
- 鉴权/订阅事件和结束统计走 stderr，不污染数据流
- 同一 token 只能有一条推送连接，重复连会 `800006/800008`

```bash
usmart quote subscribe --topics rt.us.AAPL --duration 1m | jq -r '.data.latestPrice'
```

## 限流与 403

官方限制：高频接口（realtime/kline/timeline/tick/marketstate/orderbook）**120 次/分钟**，`basicinfo` **20 次/分钟**。
CLI 内置客户端限流会自动等待，但**行情网关还会在 HTTP 层直接封禁**：突发过快会收到
`HTTP_403`（openresty 返回的 HTML，不是业务错误码），需要等一段时间才恢复。

CLI 除了分钟配额，还强制相邻两次行情请求的**最小间隔**（默认 400ms，`USMART_QUOTE_MIN_INTERVAL_MS` 可调），
就是为了避免突发把自己打进 403。

对策：批量查行情用 `realtime --secu-ids a,b,c` 一次拿多只；持续跟踪用 `subscribe`；
不要写 `while true; do usmart quote realtime ...; done`。

### 行情 REST 返回 HTTP 403 时怎么判断

网关是分层判定的，**先看状态码**：

| 状态码 | 含义 |
|---|---|
| **400** | 没带 `Authorization` / `X-Sign`（路径本身没问题） |
| **401** | token 无效或已过期 → `usmart auth logout && usmart auth login` |
| **403** | **token 有效，但该渠道没有 REST 行情权限** |

403 的响应是 `server: openresty` 的 HTML，**没有业务错误码、没有 `Retry-After`**，官方文档对此没有任何描述。

实测确认 403 **与下列因素无关**（换了都复现）：来源 IP（三台不同出口的机器）、token 新旧、
客户端版本、请求头组合（`X-Dt`/`Accept`/`Origin`/`User-Agent` 等 11 种变体）。
也不是签名问题：正确签名与**故意改坏的签名返回完全相同的 403**，说明请求没进到验签环节。

同一 token 的 **WebSocket 推送仍然正常**——说明行情数据权限还在，只有 REST 这一层被拒。
所以遇到持续 403，不要干等、不要反复换密钥，直接找官方确认该渠道的 REST 行情权限。

**自动降级**：`quote realtime` 与 `quote order-book` 遇到 403 会**自动改用 WebSocket 取快照**，
返回形状与 REST 一致，输出里带 `_via: "websocket"` 标明来源：

```bash
usmart quote realtime --secu-ids hk00700          # 403 时自动降级，照常拿到报价
usmart quote realtime --secu-ids hk00700 --ws-timeout 20s
usmart quote realtime --secu-ids hk00700 --no-ws-fallback   # 关闭降级，直接报 403
```

注意：**推送只在行情变动时才推**，非交易时段或停牌标的会返回 `push_no_data`。
K 线、分时、逐笔、市场状态、基础信息**无法降级**（推送协议里没有这些能力）。

## 历史 K 线的标的额度

除频率外，官方对**历史 K 线**还有按标的数的额度（「功能介绍」§6）：

| 账户类型 | 30 天内可请求的标的数 |
|---|---|
| 普通账户 | 200 |
| PRO / 智慧账户 | 500 |

每请求 1 只股票的历史 K 线占用 1 个额度，30 天内重复请求同一只**不重复累计**。
所以批量扫全市场 K 线会烧额度，`usmart dict get kline-quota` 可随时查。
