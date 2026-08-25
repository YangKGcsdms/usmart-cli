# Changelog

## 2.1.0

### 新增：行情 REST 被拒时自动降级到 WebSocket

行情 REST 与交易是**分开授权**的。渠道没有 REST 行情权限时，网关直接返回 HTTP 403
（token 有效），但**同一 token 的 WebSocket 推送不受影响**。

`quote realtime` 与 `quote order-book` 现在会在收到 403 时自动改用推送取快照，
返回**与 REST 完全相同的响应形状**，下游代码无需改动：

```bash
usmart quote realtime --secu-ids hk00700,hk09988
# [usmart] 行情 REST 返回 403，降级到 WebSocket 推送取快照…
# {"code":0,"msg":"success","data":{"list":[...]},"_via":"websocket","_note":"..."}
```

- `_via: "websocket"` 与 `_note` 标明数据来源，便于区分
- `--ws-timeout <t>` 调整等待时长（默认 12s）
- `--no-ws-fallback` 关闭降级，保持原样返回 403
- **只对「取当前快照」语义的接口降级**：K 线、分时、逐笔、市场状态、基础信息
  在推送协议里没有对应能力，无法降级，仍按原样返回错误
- **推送只在行情变动时才推**：非交易时段、停牌或冷门标的可能收不到数据，
  此时返回 `push_no_data` 并说明原因，而不是假装无数据

### 修复

- `--no-ws-fallback` 曾不生效：commander 对 `--no-<name>` 生成的属性名是 `<name>`
  （缺省 true），不是 `no<Name>`。已修正并补单测锁住该语义。

## 2.0.5

### 改进

- **集成测试加前置体检**。配置或登录不通时，此前会让上百条用例各自失败/超时，
  真正的根因被埋在噪音里。现在先跑 `doctor` + 一次登录，不通就立刻停下并一次说清：
  错误码、原因、修复建议；`107012`（签名验证失败）时还会直接打印当前私钥对应的
  验签公钥，方便与 uSMART 登记的那份比对。
- 依据三机实测订正行情网关状态码语义的文档：**400=缺鉴权头，401=token 无效，
  403=token 有效但该渠道无 REST 行情权限**（此前误述为「按渠道号判定 403」）。

## 2.0.4

### 修复

- **`doctor --online` 可能长时间挂住**。2.0.2 给它加了行情 REST 权限探测后，
  该探测沿用了默认的 20s 超时 + 一次重试，网关异常时单条 `doctor` 实测跑了 124 秒。
  诊断命令必须有界：现在 doctor 的联网探测走 8s 超时（`USMART_DOCTOR_TIMEOUT_MS` 可调）
  且不重试。

### 新增

- `UsmartClient` / `UsmartSessionManager` 支持 `timeoutMs` 与 `quoteRetry` 选项，
  让调用方能按场景决定超时与重试策略。

## 2.0.3

### 新增

- **`test/trade-contract.test.js`：交易类命令的契约测试**。交易功能按约定不做集成测试，
  此前只有 `--dry-run` 的形状校验，没有对着官方文档逐字段核对过——这是代码里风险最高的一块。
  现在用《账户交易开放API》的请求示例逐字段断言 `--dry-run` 构造出的请求体，重点锁住
  搞反就会造成真实损失的语义：

  - **`actionType` 在两个接口里含义相反**：委托改撤单（文档 2.2）`0=撤单 1=改单`，
    IPO 改撤单（文档 3.4）`0=改单 1=撤单`。发反了就是「想改单结果撤了」。
  - 撤单必须把 `entrustAmount` / `entrustPrice` 传 0；碎股撤单用 `oddId` 而非 `entrustId`。
  - MA 接口的价格按官方要求 ×10000（`--price 0.1` → `sellPrice 1000`），期权价格保留小数。
  - `serialNo` 19 位、期权 `requestId` 10~36 位。
  - 所有写操作的 URL 必须指向交易 host，绝不会误发到行情 host。
  - `--dry-run` 输出不得出现明文交易密码或手机号，签名必须脱敏。

## 2.0.2

把一次真实排障里最耗时的两个坑做成 CLI 自带的诊断能力。

### 新增

- **`usmart doctor` 现在做 RSA 密钥体检**，并打印**当前私钥对应的验签公钥**。
  uSMART 用的是两套密钥：配置里的 `publicKey` 是 uSMART 给的**数据加密**公钥（加密手机号/密码），
  `privateKey` 是**你自己的签名私钥**，uSMART 持有与之配对的验签公钥——**两者不是一对**。
  换签名私钥时必须让 uSMART 同步更新验签公钥，否则所有请求都被判 `107012 非法OPEN请求`。
  doctor 把该公钥打出来，可直接与提交给 uSMART 的那份比对。
- **`usmart doctor --online` 单独探测行情 REST 权限**。行情与交易是分开授权的：
  交易接口全通、行情却 403 的情况真实存在，此时会明确提示「该渠道无 REST 行情权限，
  需联系 uSMART；WebSocket 推送不受影响，可用 `usmart quote subscribe` 降级」，
  而不是笼统报「接口挂了」。

### 修复

- 登录 / 交易解锁失败时改用错误码表里的**具体** hint。此前无论什么原因都提示
  「检查手机号/密码/区号」，`107012`（签名验不过）、`310104`（交易密码错误，会锁定）
  这类关键信息被通用文案盖掉了。

## 2.0.1

### 修复

- **`quote tick` 翻页可能静默停在第一页**：官方文档的参数表写 `seq`、同一页的请求示例却写 `start`
  （返回体里也叫 `start`）。首页传 0 时两者行为无法区分，若服务端实际读 `start` 而我们只发 `seq`，
  翻页就会一直返回同一页。现在两个字段一起发、取值相同。
- **REST 与 WebSocket 对 int64 的处理不一致**：`latestTime` 这类超过 2^53 的整数，
  REST 侧走 `parseJsonSafe` 保留为字符串，WS 侧走原生 `JSON.parse` 是数字，
  同一字段两条链路类型不同。现在 WS 也走 `parseJsonSafe`。
- 补充错误码 `107012`（非法 OPEN 请求：渠道凭据与环境不匹配）、`409985`（参数不合法）。
- **密钥被截断时给出可执行的诊断**：复制粘贴丢尾巴是最常见的配置错误，但 OpenSSL 只会报
  `asn1 encoding routines::not enough data`，完全看不出问题所在。现在会比对 DER 头声明的长度
  与实际字节数，直接告诉你少了多少字节 / 多少个 Base64 字符。

### 新增

- `test/quote-contract.test.js`：用官方《基础行情开放API》文档里逐字抄下的请求/响应示例做契约测试，
  断言 7 个行情命令构造的请求体字段与官方示例一致、官方响应形状能被正确解析。
  行情网关不可用时这层仍可离线跑。

### 文档订正

- 修正对行情 REST `HTTP 403` 的判断：经双机（不同公网 IP）、双 token、双客户端版本验证，
  该 403 **与来源 IP、token、客户端版本均无关，按渠道号判定**，不是突发限流封 IP。
  并记录网关的分层语义：**400 = 缺鉴权头，401 = token 无效，403 = token 有效但无 REST 行情权限**；
  同一 token 的 WebSocket 推送不受影响，可作为降级方案。

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
- `order place/modify/cancel` 新增 `--with-password`：随单附带 RSA 加密的交易密码，
  适配逐单校验而非会话解锁的账户配置（官方 `entrust-order`/`modify-order` 的可选 `password` 字段）

### 新增能力

- `usmart dict` —— 30 张官方数据字典（市场、币种、订单状态、委托属性、K 线类型、市场状态、错误码限流等）
- `--format table|csv|pretty`（表格按中文宽度对齐）、`--jq`（有 jq 用完整语法，否则内置路径选择器；多值输出 NDJSON）
- `--profile` 多账号/多环境，`auth profiles` 列出全部
- 客户端限流：行情高频 120/min、`basicinfo` 20/min，超限自动等待；
  并强制相邻行情请求的最小间隔（默认 400ms，`USMART_QUOTE_MIN_INTERVAL_MS` 可调）
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
