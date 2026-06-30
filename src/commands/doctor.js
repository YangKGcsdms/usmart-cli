import { readConfig } from '../lib/config.js';
import { createClient } from '../lib/client.js';

export function registerDoctor(program) {
  program
    .command('doctor')
    .description('健康检查：配置、认证、网络连通性')
    .option('--profile <name>', 'profile 名称', 'default')
    .action(async (options) => {
      const profile = options.profile;
      const checks = [];

      const cfg = readConfig(profile);
      checks.push({ item: '配置存在', ok: !!cfg, detail: cfg ? '已找到' : '未找到' });
      checks.push({ item: 'base_url 配置', ok: !!cfg?.base_url, detail: cfg?.base_url || '缺失' });
      checks.push({ item: 'token 存在', ok: !!cfg?.token, detail: cfg?.token ? '已登录' : '未登录' });

      if (cfg?.base_url) {
        try {
          const client = await createClient(profile);
          await client.get('/ping');
          checks.push({ item: '后端连通性', ok: true, detail: `${cfg.base_url}/ping 可达` });
        } catch (err) {
          checks.push({ item: '后端连通性', ok: false, detail: err.message });
        }
      }

      console.log(JSON.stringify(checks, null, 2));
      const allOk = checks.every(c => c.ok);
      process.exit(allOk ? 0 : 1);
    });
}
