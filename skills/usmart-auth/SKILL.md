---
name: usmart-auth
version: 1.0.0
description: "盈立 CLI 认证与配置：初始化 config、登录 login、查看状态 status、登出 logout、健康检查 doctor。当用户第一次使用 usmart-cli、需要配置登录信息、测试登录是否成功、切换账号或排查连接问题时触发。"
---

# usmart-cli 认证与配置

## 初始化配置

首次使用必须运行：

```bash
usmart config init
```

引导输入：
- 环境（`local` / `staging` / `prod`）
- 后端地址（如 `http://localhost:9999`）
- 应用 ID / AppKey
- 应用密钥（AppSecret）— **从 stdin 输入，不回显**

配置保存位置：
- macOS：`~/Library/Application Support/usmart-cli/config.json`
- Linux：`~/.config/usmart-cli/config.json`
- Windows：`%APPDATA%/usmart-cli/config.json`

### 多环境 profile

```bash
usmart config init --profile staging    # 初始化 staging profile
usmart config show --profile staging    # 查看 staging 配置
usmart auth login --profile staging     # 登录 staging
```

## 登录

### 用户登录

```bash
usmart auth login
```

CLI 会输出一个授权链接或二维码。用户完成授权后，token 保存在本地安全存储（Keychain / Secret Service）。

### 指定 scope / domain 登录（推荐）

```bash
usmart auth login --scope "trade:read"
usmart auth login --domain "account"   # 按业务域批量授权
```

多次 `login` 的 scope 会累积（增量授权）。

### Bot 身份

如果后端支持应用级 bot token，只需配置 AppKey + AppSecret，无需 `auth login`：

```bash
usmart config init --as bot
usmart api GET /ping --as bot
```

## 查看状态

```bash
usmart auth status
```

输出示例：

```json
{
  "identity": "user",
  "profile": "default",
  "base_url": "http://localhost:9999",
  "user_id": "user_xxx",
  "expires_at": "2026-07-01T10:00:00Z",
  "scopes": ["trade:read", "account:read"]
}
```

## 登出

```bash
usmart auth logout
usmart auth logout --profile staging
```

## 健康检查

```bash
usmart doctor
```

检查项：
1. 配置文件是否存在且可解析。
2. 当前 profile 的 base_url 是否可达。
3. token 是否存在且未过期。
4. 调用 `/ping` 或 `/health` 验证后端连通性。

## 权限不足处理

当 API 返回 `403` 或 `permission denied` 时：

1. 查看当前身份：`usmart auth status`
2. 如果缺 scope，执行增量登录：
   ```bash
   usmart auth login --scope "<missing_scope>"
   ```
3. 如果是 bot 身份缺权限，需要到管理后台为应用开通对应 scope，**不要对 bot 执行 `auth login`**。

## 安全规则

- **禁止输出 AppSecret 或 access token 到终端明文**。
- 配置文件中只保存 base_url、profile、app_id；token 必须走 OS 安全存储。
- 高风险的写操作（删除、资金操作等）需要 `--yes` 确认；先用 `--dry-run` 预览。
