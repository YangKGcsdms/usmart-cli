---
name: usmart-cli-dev
version: 2.0.0
description: "usmart-cli 这个仓库自身的开发规范：如何新增一个 uSMART 接口对应的 CLI 命令、命令注册框架、参数校验、错误与退出码、数据字典、单元测试与只读集成测试、发版流程。当在 usmart-cli 仓库里改代码时使用。"
metadata:
  requires:
    bins: ["node"]
  cliHelp: "usmart --help"
---

# usmart-cli 开发规范

面向**在本仓库里改代码**的场景。只是想用 CLI 请看 `usmart-shared` 及各领域 skill。

## 技术栈

- Node.js ≥ 18（`quote subscribe` 的内置 WebSocket 需要 22+，否则回退到可选依赖 `ws`）
- ESM（`"type": "module"`），唯一运行时依赖 **commander**
- 测试：Node 内置 `node:test`，无第三方框架
- 无构建步骤，`bin/usmart` 直接跑 `src/`

## 真实目录结构

```
usmart-cli/
├── bin/usmart                 # 入口
├── src/
│   ├── cli.js                 # 组装 program、注册各 domain、全局 flag
│   ├── lib/
│   │   ├── registry.js        # 命令注册框架：defineDomain / add / makeHandler / guard
│   │   ├── usmart-client.js   # HTTP + 签名（postTrade / postQuote）
│   │   ├── session.js         # 登录、交易解锁、300101/409984 自动重试
│   │   ├── session-cache.js   # token 落盘（按 profile + 账号指纹隔离）
│   │   ├── usmart-config.js   # 配置目录/profile 解析、校验
│   │   ├── rsa.js             # encryptField / signBody / signWithHeaders
│   │   ├── request-id.js      # 19 位唯一 requestId / serialNo
│   │   ├── json-safe.js       # int64 不丢精度的 JSON 解析
│   │   ├── errors.js          # CliError、EXIT、官方错误码表
│   │   ├── validate.js        # 参数声明 opt() 与校验
│   │   ├── output.js          # json/table/csv/pretty + jq
│   │   ├── rate-limit.js      # 客户端滑动窗口限流
│   │   ├── dict.js            # 官方数据字典
│   │   ├── push.js            # WebSocket 推送客户端
│   │   └── meta.js            # 包路径常量
│   └── commands/              # auth account order quote ipo ma option dict api doctor skills
├── skills/                    # 分发给 AI Agent 的 SKILL.md
├── test/*.test.js             # 单元测试（全 mock，不联网）
└── test/integration/          # 只读集成测试（USMART_INTEGRATION=1，用真实账号）
```

## 新增一个接口命令

1. 去 https://api-doc.usmart8.com/zh-cn/ 找到接口，抄准 **path、必填字段、枚举**。
   路径前缀区分服务：`user-server` / `stock-order-server` / `asset-center-server` /
   `stock-capital-server` / `ams-center` / `option-order-server` / `quotes-openservice`。
   **抄错 service 前缀会得到 `107004 服务不可用`。**
2. 在对应 `src/commands/<domain>.js` 里 `domain.add({...})`：

```javascript
domain.add({
  name: 'margin-detail',
  legacy: 'margin-detail',            // 可选：注册到隐藏的 1.x 兼容入口
  description: '融资账户详情（购买力、欠款、预计利息等）',
  options: [
    opt('--exchange-type <n>', '市场：0=港股 5=美股', { type: 'int', default: '5', choices: [0, 5] }),
    opt('--stock-code <code>', '证券代码', { required: true }),
  ],
  requireTrade: false,                // 写操作设 true，会自动 trade-login
  highRisk: false,                    // 写操作设 true：无 --yes 退出 10
  action: (s, o, ctx) => s.call(
    (c) => c.postTrade('/asset-center-server/open-api/open-margin-detail/v1',
                       ctx.merge(compact({ exchangeType: o.exchangeType }))),
    { requireTrade: false }
  ),
});
```

框架已经替你做掉：`--config` / `--data` 选项、参数校验、配置加载、会话、dry-run、
`--format`/`--jq` 输出、错误信封与退出码。**`action` 里只管返回接口响应，不要自己 print、不要自己 catch。**

3. `ctx.merge(body)` 把用户的 `--data` 合并进请求体；`compact()` 去掉空字段。
4. 新枚举加进 `src/lib/dict.js`，并在 option 描述里指向 `usmart dict get <name>`。
5. 新错误码加进 `src/lib/errors.js` 的 `ERROR_CODES`，带上 `hint`（写给智能体看的下一步动作）。
6. 补测试（见下），更新对应 `skills/usmart-<domain>/SKILL.md` 和 README 的接口覆盖表。

## 约定

- **stdout 只放数据，stderr 放提示**（弃用警告、限流等待、推送事件都走 stderr）
- 退出码：`0` 成功 / `1` 一般错误 / `2` API 错误 / `3` 参数错误 / `10` 需 `--yes`
- 任何抛出的错误都用 `CliError(type, message, {exitCode, hint, code})`；`hint` 必须写「下一步该做什么」
- **绝不把原始 Node 堆栈打给用户**（`USMART_DEBUG=1` 时才在 `details` 里带 stack）
- 敏感值只出现在配置文件里；日志、dry-run、错误信封中的 token/签名一律脱敏
- int64 字段（`entrustId`/`serialNo`/`applyId`/`orderId`）在 `json-safe.js` 里已转字符串，**下游不要再 `Number()`**
- 新增高风险命令必须同时支持 `--dry-run` 且 dry-run 不发任何网络请求

## 测试

```bash
npm test                  # 单元测试，全 mock，不联网，CI 跑这个
npm run test:integration  # 只读集成测试，需要真实配置
npm run test:all
```

集成测试规则（`test/integration/cli.integration.test.js`）：

- **只跑只读命令**。所有写操作（下单/撤单/认购/密码/出金）只测两件事：不带 `--yes` 退出码是 10、
  `--dry-run` 能打出正确的 URL 和 body。**绝不真实发送交易请求。**
- 需要外部 ID 的接口用 `expectReachable()`：只断言「接口可达」（不是 `107004`/`404`），
  允许业务码非 0，因为拿不到有效 ID。
- 行情接口有网关限流，密集重跑会收到 `HTTP_403`，等一段时间再跑。

## 发版

1. 改 `package.json` 版本 + 写 `CHANGELOG.md`
2. `npm test` 通过 + `npm run test:integration` 通过
3. `npm pack --dry-run` 确认打包内容
4. 走 PR 合 main（hook 拦直接 push main），然后 `npm publish` + `gh release create`
