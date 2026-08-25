# 接口覆盖对照表

对照 uSMART 官方文档 https://api-doc.usmart8.com/zh-cn/ ，逐条列出 CLI 命令与后端 path。

## 账户交易 API（`env.tradeHost`，默认 `https://open-jy.yxzq.com`）

### 1 登录、密码及用户信息

| 官方 | path | CLI |
|---|---|---|
| 1.1 渠道密码登录 | `/user-server/open-api/login` | 自动（`usmart auth login` 可主动触发） |
| 1.2 获取验证码 | `/user-server/open-api/send-phone-captcha` | `auth send-captcha --type` |
| 1.3 验证码登录 | `/user-server/open-api/loginCaptcha` | `auth login-captcha --captcha` |
| 1.4 设置交易密码 | `/user-server/open-api/set-trade-password` | `account set-trade-password` |
| 1.5 校验交易密码 | `/user-server/open-api/check-trade-password` | `account check-trade-password` |
| 1.6 重置登录密码 | `/user-server/open-api/reset-login-password` | `account reset-login-password` |
| 1.7 解锁交易 | `/user-server/open-api/trade-login` | 自动（`auth unlock` 可主动触发） |
| 1.8 交易解锁状态 | `/user-server/open-api/get-trade-status` | `auth trade-status` |
| 1.9 修改交易密码 | `/user-server/open-api/update-trade-password` | `account update-trade-password` |
| 1.10 重置交易密码 | `/user-server/open-api/reset-trade-password` | `account reset-trade-password` |
| 1.11 修改登录密码 | `/user-server/open-api/update-login-password` | `account update-login-password` |
| 1.12 按市场查账户类型 | `/user-server/open-api/get-user-info-with-market-for-stock/v1` | `account type` |
| 1.13 按资金账号查融资利率 | `/user-server/open-api/get-rate-info-by-fund-account/v1` | `account margin-rate` |

### 2 交易及查询

| 官方 | path | CLI |
|---|---|---|
| 2.1 下单 | `/stock-order-server/open-api/entrust-order` | `order place` |
| 2.2 改单/撤单 | `/stock-order-server/open-api/modify-order` | `order modify` / `order cancel` |
| 2.3 改单范围 | `/stock-order-server/open-api/modified-range` | `order modified-range` |
| 2.4 碎股下单 | `/stock-order-server/open-api/odd-entrust` | `order odd-place` |
| 2.5 碎股撤单 | `/stock-order-server/open-api/odd-modify` | `order odd-cancel` |
| 2.6 最大可买可卖 | `/stock-order-server/open-api/trade-quantity` | `order max-quantity` |
| 2.7 今日订单 | `/stock-order-server/open-api/today-entrust` | `order today` |
| 2.8 全部订单 | `/stock-order-server/open-api/his-entrust` | `order history` |
| 2.9 订单明细 | `/stock-order-server/open-api/order-detail` | `order detail` |
| 2.10 成交流水 | `/stock-order-server/open-api/stock-record` | `order fills` |
| 2.11 查询资产 | `/asset-center-server/open-api/open-assetQuery/v1` | `account asset` |
| 2.12 融资股数 | `/stock-order-server/open-api/trade-margin-quantity` | `order margin-quantity` |
| 2.13 融资账户详情 | `/asset-center-server/open-api/open-margin-detail/v1` | `account margin-detail` |
| （文档外）持仓 | `/stock-order-server/open-api/stock-holding` | `account holding` |

### 3 IPO 认购

| 官方 | path | CLI |
|---|---|---|
| 3.1 IPO 列表 | `/stock-order-server/open-api/ipo-list` | `ipo list` |
| 3.2 新股详情 | `/stock-order-server/open-api/ipo-info` | `ipo info` |
| 3.3 新股认购 | `/stock-order-server/open-api/apply-ipo` | `ipo apply` |
| 3.4 IPO 改单/撤单 | `/stock-order-server/open-api/modify-ipo` | `ipo modify` / `ipo cancel` |
| 3.5 申购列表 | `/stock-order-server/open-api/ipo-record-list` | `ipo records` |
| 3.6 申购明细 | `/stock-order-server/open-api/ipo-record` | `ipo record` |
| 3.7 确认现金认购数量 | `/stock-order-server/open-api/ipo-comfirm-qyt/v1` | `ipo confirm-qty` |

### 4 资金记录

| 官方 | path | CLI |
|---|---|---|
| 4.1 查询汇率 | `/stock-capital-server/open-api/currency-exchange-info` | `account exchange-rate` |
| 4.2 历史记录 | `/stock-capital-server/open-api/business-flow` | `account flow` |
| 4.3 出金撤销 | `/stock-capital-server/open-api/app-cashOut-revoke` | `account cashout-revoke` |

### 6 孖展

| 官方 | path | CLI |
|---|---|---|
| 6.1 股票抵押比率 | `/stock-order-server/open-api/mortgage-list` | `account mortgage-list` |

### 7 MA 账户

| 官方 | path | CLI |
|---|---|---|
| 7.1 下单 | `/ams-center/open-api/ma-order-submit/v1` | `ma place` |
| 7.2 撤单 | `/ams-center/open-api/ma-order-cancel/v1` | `ma cancel` |
| 7.3 订单列表 | `/ams-center/open-api/ma-order-list/v1` | `ma list` |
| 7.4 订单详情 | `/ams-center/open-api/ma-order-detail/v1` | `ma detail` |
| 7.5 策略购买力 | `/ams-center/open-api/get-ma-trade-account-info/v1` | `ma purchase-power` |

### 8 期权

| 官方 | path | CLI |
|---|---|---|
| 8.1 下单 | `/option-order-server/open-api/option-trade/v1` | `option place` |
| 8.2 改单 | `/option-order-server/open-api/option-replace-order/v1` | `option replace` |
| 8.3 撤单 | `/option-order-server/open-api/option-cancel-order/v1` | `option cancel` |
| 8.4 下单购买力 | `/option-order-server/open-api/option-customer-range/v2` | `option purchase-power` |
| 8.5 改单购买力 | `/option-order-server/open-api/option-customer-replace-range/v1` | `option replace-power` |
| 8.6 改单状态 | `/option-order-server/open-api/query-option-order-replace-status/v1` | `option replace-status` |
| 8.7 今日订单 | `/option-order-server/open-api/user-option-order-list/v1` | `option list` |
| 8.8 订单详情 | `/option-order-server/open-api/user-option-order-detail/v1` | `option detail` |

## 基础行情 API（`env.quoteHost`，默认 `https://open-hz.yxzq.com:8443`）

| 官方 | path | CLI | 限流 |
|---|---|---|---|
| 二、市场状态 | `/quotes-openservice/api/v1/marketstate` | `quote market-state` | 120/min |
| 三、基础信息 | `/quotes-openservice/api/v1/basicinfo` | `quote basicinfo` | **20/min** |
| 四、实时行情 | `/quotes-openservice/api/v1/realtime` | `quote realtime` | 120/min |
| 五、分时 | `/quotes-openservice/api/v1/timeline` | `quote timeline` | 120/min |
| 六、K 线 | `/quotes-openservice/api/v1/kline` | `quote kline` | 120/min |
| 七、逐笔 | `/quotes-openservice/api/v1/tick` | `quote tick` | 120/min |
| 八、买卖盘 | `/quotes-openservice/api/v1/orderbook` | `quote order-book` | 120/min |

## 行情推送（`env.pushHost`，默认 `wss://open-hz.yxzq.com:8443/wss/v1`）

`quote subscribe --topics <type>.<market>.<code>`，type ∈ `rt`/`tk`/`ob`，最多 10 个 topic。
CLI 负责 `auth` → `sub` → `ping/pong` 心跳 → `update` 解码（含 base64）→ `unsub` 收尾，stdout 输出 NDJSON。

## 签名规则

| 侧 | X-Sign |
|---|---|
| 交易 | `safeBase64(MD5withRSA(body))` |
| 行情 | `safeBase64(MD5withRSA(Authorization + X-Channel + X-Lang + X-Request-Id + X-Time + body))` |

两侧都要求 `X-Request-Id` 为 19 位唯一数字、`X-Time` 为 unix 秒。
敏感字段（手机号、密码）用**渠道公钥**做 `RSA/ECB/PKCS1Padding` 加密后 URL-safe Base64，与签名私钥不是一对。
