import { readConfig, writeConfig } from '../lib/config.js';

export function registerConfig(program) {
  const config = program.command('config').description('全局配置管理');

  config
    .command('init')
    .description('初始化 CLI 配置')
    .option('--profile <name>', 'profile 名称', 'default')
    .option('--base-url <url>', '后端地址')
    .option('--app-id <id>', '应用 ID')
    .action(async (options) => {
      // TODO: 交互式读取 base_url / app_id / app_secret
      const baseURL = options.baseUrl || 'http://localhost:9999';
      const appId = options.appId || '';
      writeConfig(options.profile, {
        base_url: baseURL,
        app_id: appId,
        // app_secret 不应保存，或保存到 keychain
      });
      console.log(`配置已保存到 profile: ${options.profile}`);
    });

  config
    .command('show')
    .description('查看当前配置')
    .option('--profile <name>', 'profile 名称', 'default')
    .action(async (options) => {
      const cfg = readConfig(options.profile);
      if (!cfg) {
        console.error(`未找到 profile: ${options.profile}`);
        process.exit(1);
      }
      console.log(JSON.stringify(cfg, null, 2));
    });
}
