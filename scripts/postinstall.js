#!/usr/bin/env node

/**
 * usmart-cli 安装后引导。对 AI agent 友好：明确给出配置路径和下一步命令。
 * CI / 非交互环境静默跳过。
 */
if (process.env.CI || process.env.NODE_ENV === 'test' || !process.stdout.isTTY) {
  process.exit(0);
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  usmart-cli 安装成功 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

下一步：

1. 生成配置文件
   usmart auth config-init
   # 编辑 ~/.config/usmart-cli/usmart.json 填入账号、密码、RSA 密钥、环境地址

2. 检查配置（--online 会真实登录一次）
   usmart doctor --online

3. 试跑
   usmart account asset
   usmart quote realtime --secu-ids usAAPL,hk00700

4. 安装 AI Agent Skills（Claude Code / Cursor / Codex 等）
   usmart install

帮助：
   usmart --help
   usmart <domain> --help      # auth account order quote ipo ma option dict
   usmart dict list            # 官方数据字典

注意：配置文件含登录密码、交易密码与 RSA 私钥（权限 600），请勿提交到 git。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
