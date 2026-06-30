import { readConfig, writeConfig } from '../lib/config.js';

export function registerAuth(program) {
  const auth = program.command('auth').description('认证与授权');

  auth
    .command('login')
    .description('登录授权')
    .option('--profile <name>', 'profile 名称', 'default')
    .option('--scope <scope>', '授权 scope')
    .action(async (options) => {
      // TODO: 实现 OAuth / 账号密码 / 设备码登录
      console.log(`请在浏览器完成授权后，将 token 设置到 profile: ${options.profile}`);
      console.log(`示例：usmart config init --profile ${options.profile} 并手动写入 token`);
    });

  auth
    .command('status')
    .description('查看登录状态')
    .option('--profile <name>', 'profile 名称', 'default')
    .action(async (options) => {
      const cfg = readConfig(options.profile);
      if (!cfg || !cfg.token) {
        console.log(JSON.stringify({ identity: 'none', profile: options.profile }, null, 2));
      } else {
        console.log(JSON.stringify({ identity: 'user', profile: options.profile, base_url: cfg.base_url }, null, 2));
      }
    });

  auth
    .command('logout')
    .description('退出登录')
    .option('--profile <name>', 'profile 名称', 'default')
    .action(async (options) => {
      const cfg = readConfig(options.profile);
      if (cfg) {
        delete cfg.token;
        writeConfig(options.profile, cfg);
      }
      console.log(`已退出 profile: ${options.profile}`);
    });
}
