---
name: usmart-auth
version: 2.0.0
description: "usmart-cli 的配置与鉴权：初始化配置 config-init、多 profile 管理、测试登录、交易解锁、会话状态、登出、短信验证码登录、健康检查 doctor。当用户第一次使用 usmart-cli、要配置或切换账号、排查登录/连接问题时触发。"
metadata:
  requires:
    bins: ["usmart"]
  cliHelp: "usmart auth --help"
---

# usmart auth —— 配置与鉴权

开始前先读 [`../usmart-shared/SKILL.md`](../usmart-shared/SKILL.md)（退出码、错误信封、安全规则）。

uSMART 用「账号 + RSA 签名」鉴权，**不是 OAuth**，没有 access token 换取流程。登录与交易解锁由 CLI 在每次调用时自动完成，token 缓存本地复用。

## 首次配置

```bash
usmart auth config-init          # 生成 ~/.config/usmart-cli/usmart.json（600 权限）
# 编辑填入真实值，然后：
usmart doctor                    # 离线检查：字段、权限、占位符
usmart doctor --online           # 联网检查：真实登录一次
```

配置结构：

```json
{
  "account": {
    "lang": "1", "channel": "渠道号", "areaCode": "86", "phoneNumber": "手机号",
    "loginPassword": "登录密码", "tradePassword": "6位交易密码",
    "publicKey": "Base64 X509/SPKI 公钥", "privateKey": "Base64 PKCS8 私钥",
    "deviceType": "t5"
  },
  "env": {
    "tradeHost": "https://open-jy.yxzq.com",
    "quoteHost": "https://open-hz.yxzq.com:8443",
    "pushHost": "wss://open-hz.yxzq.com:8443/wss/v1"
  }
}
```

- `publicKey` 用于加密手机号/密码，`privateKey` 用于请求签名，**两者由盈立分配、不是一对**
- `pushHost` 不填会从 `quoteHost` 自动推导
- 测试环境把 host 换成 `open-jy-uat.yxzq.com` / `open-hz-uat.yxzq.com`

## 多账号 / 多环境（profile）

```bash
usmart auth config-init --profile uat     # → ~/.config/usmart-cli/uat.json
usmart --profile uat account asset        # 用 uat 账号
usmart auth profiles                      # 列出所有 profile 及其会话状态
```

配置目录可用 `USMART_CONFIG_DIR` 整体覆盖（配置与会话缓存一起走该目录）。

## 会话

```bash
usmart auth status        # 读本地缓存，不触发网络
usmart auth login         # 主动登录一次（一般不需要，业务命令会自动登录）
usmart auth unlock        # 主动交易解锁（一般不需要）
usmart auth trade-status  # 问服务端：data.status 0=未解锁 1=已解锁
usmart auth logout        # 清除本地 token
```

`status` / `login` / `unlock` 输出：

```json
{"ok":true,"loggedIn":true,"tradeUnlocked":false,"token":"eyJ0****oJtY","profile":"default"}
```

## 短信验证码登录

账号被风控要求验证码时（`300707`、新设备登录）：

```bash
usmart auth send-captcha --type 106       # 106=短信登录
usmart auth login-captcha --captcha 123456
```

`--type` 取值见 `usmart dict get captcha-type`。

## 排查

| 现象 | 处理 |
|---|---|
| 退出码 1 + `config_missing` | 跑 `usmart auth config-init` |
| 退出码 1 + `config_invalid` | `error.details.missing` 里是缺的字段 |
| `login_failed` | 检查 `phoneNumber` / `loginPassword` / `areaCode` / `publicKey`；必要时改走验证码登录 |
| `trade_unlock_failed` + `310104` | 交易密码错，**别重试**，`301002` 会锁定 |
| RSA 报错 `publicKey/privateKey 格式错误` | 必须是 Base64 编码的 DER（公钥 X509/SPKI、私钥 PKCS8），不是 PEM |
| `doctor` 报「无模板占位符」失败 | 配置里还留着 `YOUR_xxx` / `BASE64_xxx` |
| 行情 `HTTP_403` | 网关限流，降频等待；不是配置问题 |
