#!/usr/bin/env node

/**
 * usmart-cli 安装后引导脚本。
 * 在 `npm install -g usmart-cli` 后执行，向终端输出下一步指引。
 * 对 AI agent 友好：明确给出配置路径和示例命令。
 */

const isCI = process.env.CI || process.env.NODE_ENV === 'test';

if (isCI) {
  process.exit(0);
}

const messages = [
  '',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '  usmart-cli 安装成功 🎉',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  '下一步（任选其一）：',
  '',
  '1. 快速初始化 uSMART 配置文件：',
  '   usmart usmart config-init',
  '',
  '2. 手动复制示例配置并编辑：',
  '   cp $(npm root -g)/usmart-cli/usmart.config.example.json ~/.config/usmart-cli/usmart.json',
  '   # 编辑 ~/.config/usmart-cli/usmart.json 填入账号、密码、RSA 密钥、环境地址',
  '',
  '3. 测试登录：',
  '   usmart usmart login',
  '',
  '4. 查看持仓：',
  '   usmart usmart holding --exchange-type 100',
  '',
  '5. AI Agent 安装 Skills（Claude Code / Cursor / Codex 等）：',
  '   npx skills add yingli/usmart-cli -y -g',
  '',
  '更多信息：',
  '   usmart --help',
  '   usmart usmart --help',
  '',
  '注意：usmart.json 包含敏感信息，请勿提交到 git。',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '',
];

console.log(messages.join('\n'));
