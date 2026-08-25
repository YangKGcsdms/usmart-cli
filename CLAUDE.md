# Claude Code · usmart-cli 开发智能体

> 此文件随 git 走，所有 Claude Code session 启动时自动加载。

## 项目定位

`usmart-cli` 是面向 uSMART 盈立证券开放 API 的命令行工具，参考 `lark-cli` 设计：把官方 Open API
封装成 CLI 命令，再沉淀为 AI Agent Skills，让智能体可以直接操作 uSMART 的交易、行情、资产、打新与衍生品。

- **技术栈**：Node.js ≥ 18（ESM），唯一运行时依赖 commander，无构建步骤
- **官方文档**：https://api-doc.usmart8.com/zh-cn/ （交易 / 基础行情 / 行情推送三份）
- **覆盖范围**：官方全部接口 + WebSocket 推送

## 命令形状

```
usmart <domain> <command> [options]
```

domain：`auth` `account` `order` `quote` `ipo` `ma` `option` `dict`，外加 `api` `doctor` `skills`。
1.x 的 `usmart usmart <cmd>` 保留为隐藏兼容入口，会打弃用提示。

全局 flag：`--profile` `--format json|table|csv|pretty` `--jq` `--dry-run` `--yes` `--config` `--data`。

## 铁律

1. **退出码是唯一的成败判据**：`0` 成功 / `1` 一般错误 / `2` API 错误 / `3` 参数错误 / `10` 需 `--yes`。
   新增命令绝不能让失败路径退出 0。
2. **stdout 只放数据，stderr 放提示**。弃用警告、限流等待、推送事件一律 stderr。
3. **错误一律 `CliError(type, message, {exitCode, hint, code})`**，`hint` 写「下一步做什么」。
   绝不把 Node 堆栈打给用户（`USMART_DEBUG=1` 例外）。
4. **写操作必须 `highRisk: true`**，无 `--yes` 退出 10，且必须支持 `--dry-run`（dry-run 不发任何网络请求）。
5. **int64 字段不要 `Number()`**：`entrustId`/`serialNo`/`applyId`/`orderId` 已由 `json-safe.js` 保留为字符串。
6. **抄接口先对 service 前缀**：`user-server` / `stock-order-server` / `asset-center-server` /
   `stock-capital-server` / `ams-center` / `option-order-server` / `quotes-openservice`。抄错得 `107004`。
7. **新枚举进 `src/lib/dict.js`，新错误码进 `src/lib/errors.js`**，并在 option 描述里指向 `usmart dict get <name>`。
8. **敏感信息绝不明文输出**：token / 签名在 dry-run 与错误信封中已脱敏；配置文件 600 权限、不进 git。

## 新增命令的模板

在 `src/commands/<domain>.js` 里：

```javascript
domain.add({
  name: 'margin-detail',
  legacy: 'margin-detail',                    // 可选，1.x 兼容名
  description: '融资账户详情',
  options: [opt('--exchange-type <n>', '市场：0=港股 5=美股', { type: 'int', default: '5', choices: [0, 5] })],
  requireTrade: false,
  highRisk: false,
  action: (s, o, ctx) => s.call(
    (c) => c.postTrade('/asset-center-server/open-api/open-margin-detail/v1',
                       ctx.merge(compact({ exchangeType: o.exchangeType }))),
    { requireTrade: false }
  ),
});
```

框架已处理：参数校验、配置加载、会话与自动重登、dry-run、`--format`/`--jq`、错误信封与退出码。
**`action` 只返回接口响应，不 print、不 catch。**

## 测试

```bash
npm test                   # 单元测试，全 mock，不联网，CI 跑这个
npm run test:integration   # 只读集成测试，需 ~/.config/usmart-cli/usmart.json
```

集成测试规则：**只跑只读命令**；所有写操作只验证「无 `--yes` 退出 10」与「`--dry-run` 请求正确」，
**绝不真实发送交易**。行情接口有网关限流，密集重跑会 `HTTP_403`，需要等待恢复。

`test/skills.test.js` 会校验每个 SKILL.md 里出现的 `usmart` 命令都真实存在——**改命令名必须同步改 skill**。

## Skills

`skills/` 下 8 个，通过 `npx skills add YangKGcsdms/usmart-cli` 或 `usmart install` 分发：

| skill | 覆盖 |
|---|---|
| **usmart-shared** | 公共约定：退出码、错误信封、鉴权、字典、限流、安全。其他 skill 都先引用它 |
| usmart-auth | 配置、profile、登录、解锁、验证码登录、doctor |
| usmart-account | 资产、持仓、账户类型、融资、流水、汇率、密码管理 |
| usmart-order | 下单、改单、撤单、碎股、可买卖数量、订单与成交查询 |
| usmart-quote | 行情快照、K 线、分时、逐笔、盘口、基础信息、WebSocket 推送 |
| usmart-ipo | 新股列表、认购、改撤单、申购记录 |
| usmart-derivatives | 美股期权与 MA 策略账户 |
| usmart-cli-dev | 本仓库自身的开发规范 |

## 协作 / 发版

- **写 main 走 PR**：开 `fix/*` / `feat/*` 分支 + `gh pr create`
- 发版：改 `package.json` 版本 → 写 `CHANGELOG.md` → `npm test` + `npm run test:integration` →
  `npm pack --dry-run` 确认打包内容 → 合 main → `npm publish` → `gh release create`
