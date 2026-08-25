# Changelog

## 2.0.0

对照官方文档（https://api-doc.usmart8.com/zh-cn/）逐条核对后的大版本重构：补齐全部接口，修复多处会导致错误结果的缺陷，重写全部 skill。

### 破坏性变更

- 命令改为 `usmart <domain> <command>`（domain：`auth` `account` `order` `quote` `ipo` `ma` `option` `dict`）。
  旧的 `usmart usmart <cmd>` 仍可用，但会在 stderr 打弃用提示。
- **退出码语义变化**：业务失败不再返回 0。`0` 成功 / `1` 一般错误 / `2` API 错误 / `3` 参数错误 / `10` 需 `--yes`。
  依赖旧行为（永远 exit 0）的脚本需要调整。
- 失败时 stdout 统一为 `{ok:false,error:{type,message,code,hint}}` 信封。
- `--money-type` 等参数会做枚举校验，非法值直接退出码 3。

### 修复

- **`rate-info` 完全不可用**：路径 `/stock-broker-server/...` 不存在（实测 `107004`），
  正确路径是 `/user-server/open-api/get-rate-info-by-fund-account/v1`，且入参是 `fundAccount` 而非 `exchangeType`。
  重命名为 `usmart account margin-rate`，不传资金账号时自动从资产接口取。
- **`mortgage-list` 完全不可用**：同样是错误的 `stock-broker-server` 前缀，
  正确路径为 `/stock-order-server/open-api/mortgage-list`；补齐 `stockCode`/`status`/分页/`pageSizeZero` 参数。
- **HTTP 状态被吞**：`postJson` 从不检查 `res.status`，404/5xx 的错误体被当成正常结果打印且退出码 0。
- **业务错误退出码为 0**：`code != 0` 现在退出码 2 并附错误码与 hint。
- **缺参不校验**：`cancel-order` 不传 `--entrust-id` 会发出 `entrustId: 0`。现在所有必填参数在本地拦截（退出码 3）。
- **`USMART_CONFIG_DIR` 只对会话缓存生效**，配置文件路径仍硬编码在 home 下，导致两者分家。现在统一。
- **`--profile` / `--format` / `--jq` 是空壳**：声明了却从未被读取。现在全部实现。
- **异常直接抛 Node 堆栈**（含文件路径）给用户。现在统一为结构化错误。
- **`X-Request-Id` 长度不合规**：官方要求 19 位唯一数字（幂等防重键），此前为 15 位。
- **交易接口缺少 `X-Time` 头**：官方文档列为必填。
- **int64 精度丢失**：`entrustId` / `serialNo` 等超过 2^53 的 ID 经 `JSON.parse` 会被改写，
  拿错 ID 去撤单后果严重。新增 int64 安全解析，这类字段保留为字符串。
- 配置与会话文件改为以 `mode: 0o600` 创建，消除先 644 再 chmod 的窗口期。
- 修正 `account type` 的描述：该接口出参只有 `assetProp`，其余为 null 属正常。
- 修正持仓盈亏字段名说明：是 `holdProfit` / `holdProfitPercent`。
- 删除死代码 `HIGH_RISK_COMMANDS`；修正 README 中「`--dry-run` 待实现」的过期文案。
- `skills read` 的路径穿越校验改为解析真实路径后比较，避免前缀误判。

### 新增接口

- **IPO 打新**（7 个）：`ipo list/info/apply/modify/cancel/records/record/confirm-qty`
- **美股期权**（8 个）：`option place/replace/cancel/purchase-power/replace-power/replace-status/list/detail`
- **MA 策略账户**（5 个）：`ma place/cancel/list/detail/purchase-power`（`--price` 收真实价格，自动 ×10000）
- **行情**：`quote basicinfo` / `quote timeline` / `quote tick`
- **WebSocket 推送**：`quote subscribe`，支持 `rt`/`tk`/`ob` topic、心跳、NDJSON 流式输出、`--duration`/`--count`
- **真正的改单**：`order modify`（此前只有 `actionType:0` 撤单）与 `order modified-range`
- **融资股数**：`order margin-quantity`
- **密码管理**（6 个）：设置/修改/重置交易密码、修改/重置登录密码、校验交易密码
- **验证码登录**：`auth send-captcha` / `auth login-captcha`
- **出金撤销**：`account cashout-revoke`

### 新增能力

- `usmart dict` —— 30 张官方数据字典（市场、币种、订单状态、委托属性、K 线类型、市场状态、错误码限流等）
- `--format table|csv|pretty`（表格按中文宽度对齐）、`--jq`（有 jq 用完整语法，否则内置路径选择器；多值输出 NDJSON）
- `--profile` 多账号/多环境，`auth profiles` 列出全部
- 客户端限流：行情高频 120/min、`basicinfo` 20/min，超限自动等待
- HTTP 超时（`USMART_TIMEOUT_MS`，默认 20s）与行情请求的网络错误重试
- `doctor` 增强：Node 版本、目录与文件权限、模板占位符检测、`--online` 真实登录探测
- 官方错误码表内置到 CLI，错误信封自动带 `hint`
- skill 重写为 8 个：新增 `usmart-shared`（公共约定）、`usmart-account`、`usmart-order`、`usmart-quote`、
  `usmart-ipo`、`usmart-derivatives`；`usmart-cli-dev` 改为描述真实的仓库结构
- 新增只读集成测试套件（`npm run test:integration`），交易类命令只验证 `--yes` 门禁与 `--dry-run`

## 1.1.0

- 打通「一次安装全 agent 可用」分发链路并清理 stub 双轨

## 1.0.0

- 首个版本
