import fs from 'fs';
import { getDefaultConfigPath } from '../lib/usmart-config.js';
import { loadSession, getSessionFilePath } from '../lib/session-cache.js';

export function registerDoctor(program) {
  program
    .command('doctor')
    .description('健康检查：配置文件、必填字段、会话缓存')
    .option('--config <path>', '配置文件路径')
    .action((options) => {
      const configPath = options.config || getDefaultConfigPath();
      const checks = [];

      const exists = fs.existsSync(configPath);
      checks.push({ item: '配置文件存在', ok: exists, detail: exists ? configPath : `缺失，运行 usmart usmart config-init` });

      let config = null;
      if (exists) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (err) {
          checks.push({ item: '配置文件可解析', ok: false, detail: err.message });
        }
      }

      if (config) {
        const accountFields = ['lang', 'channel', 'areaCode', 'phoneNumber', 'loginPassword', 'tradePassword', 'publicKey', 'privateKey'];
        const missingAccount = accountFields.filter((f) => !config.account || !config.account[f]);
        checks.push({ item: 'account 字段完整', ok: missingAccount.length === 0, detail: missingAccount.length ? `缺失：${missingAccount.join(', ')}` : '完整' });

        const envFields = ['tradeHost', 'quoteHost'];
        const missingEnv = envFields.filter((f) => !config.env || !config.env[f]);
        checks.push({ item: 'env 字段完整', ok: missingEnv.length === 0, detail: missingEnv.length ? `缺失：${missingEnv.join(', ')}` : `tradeHost=${config.env?.tradeHost}` });

        const session = loadSession(config);
        checks.push({ item: '会话缓存', ok: true, detail: session && session.token ? `已登录（${getSessionFilePath()}），tradeUnlocked=${session.tradeUnlocked}` : '无缓存 token（首次调用会自动登录）' });
      }

      console.log(JSON.stringify({ ok: checks.every((c) => c.ok), checks }, null, 2));
      process.exit(checks.every((c) => c.ok) ? 0 : 1);
    });
}
