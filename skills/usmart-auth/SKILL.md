---
name: usmart-auth
version: 1.0.0
description: "盈立 CLI 认证与配置：初始化配置 config-init、测试登录 login、交易解锁 unlock、查看会话状态 status、健康检查 doctor、安装 skill。当用户第一次使用 usmart-cli、需要配置账号、测试登录、排查连接问题时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart --help"
---

# usmart-cli 认证与配置

uSMART 使用「账号 + RSA 签名」鉴权，**不是 OAuth**。登录与交易解锁由 CLI 在每次调用时自动完成（参考 Java AOP），token 缓存到本地复用。

## 安装到各 Agent

```bash
usmart install          # = npx skills add YangKGcsdms/usmart-cli -y -g
usmart update           # 同步 skill 到最新
```

## 初始化配置

首次使用必须运行：

```bash
usmart usmart config-init
```

生成模板 `~/.config/usmart-cli/usmart.json`（权限 600），然后编辑填入：

- `account`：`lang` / `channel` / `areaCode` / `phoneNumber` / `loginPassword` / `tradePassword` / `publicKey` / `privateKey`（RSA，Base64 DER）
- `env`：`tradeHost` / `quoteHost`

> 自定义路径：所有命令支持 `--config <path>`；也可用环境变量 `USMART_CONFIG_DIR` 覆盖配置目录。

## 登录 / 交易解锁（测试用）

```bash
usmart usmart login     # 测试登录，成功后缓存 token
usmart usmart unlock    # 测试交易解锁（trade-login）
```

业务命令会自动登录/解锁，一般无需手动调用这两个。

## 查看会话状态

```bash
usmart usmart status
```

读取本地缓存（`~/.config/usmart-cli/session.json`），不触发网络：

```json
{ "ok": true, "loggedIn": true, "tradeUnlocked": false, "token": "abcd****wxyz" }
```

## 健康检查

```bash
usmart doctor
```

检查：配置文件是否存在且可解析、`account`/`env` 必填字段是否完整、是否有缓存 token。退出码非 0 表示有问题。

## 会话与过期处理

- token 缓存按「账号+环境」指纹隔离，换账号自动失效。
- `300101`（token 过期）：只读命令自动重登重试；交易命令重登后要求重新发起，避免重复下单。
- `409984`（交易锁过期）：自动重新解锁并重试。

## 安全规则

- **禁止把 `usmart.json` 提交 git，禁止终端明文输出密码 / token / RSA 私钥。**
- 配置文件与会话缓存均为 600 权限。
- 高风险写操作（下单 / 撤单）必须带 `--yes`，不带会退出码 10；可先 `--dry-run` 预览实际请求而不发送。
