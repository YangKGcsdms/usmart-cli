import fs from 'fs';
import { defineDomain, guard, globalsOf, emit, printJson, readUsmartConfig, resolveProfile, UsmartSessionManager, maskToken, CliError, EXIT } from '../lib/registry.js';
import { configPathFor, writeUsmartConfig, listProfiles, configDir } from '../lib/usmart-config.js';
import { CONFIG_EXAMPLE_PATH } from '../lib/meta.js';
import { opt } from '../lib/validate.js';
import { getSessionFilePath } from '../lib/session-cache.js';

export function registerAuth(program) {
  const auth = defineDomain(program, 'auth', '配置与鉴权：config-init / login / unlock / status / logout / 验证码登录 / profile');

  auth.cmd
    .command('config-init')
    .description('生成配置文件模板（默认 ~/.config/usmart-cli/usmart.json；--profile <name> → <name>.json）')
    .option('--config <path>', '配置文件路径')
    .option('--force', '已存在时覆盖')
    .action(guard(async (options, command) => {
      const g = globalsOf(command);
      const profile = resolveProfile(g.profile);
      const configPath = options.config || configPathFor(profile);
      if (fs.existsSync(configPath) && !options.force) {
        throw new CliError('config_exists', `配置文件已存在：${configPath}`, { exitCode: EXIT.ERROR, hint: '加 --force 覆盖，或用 --profile <name> 创建另一个 profile' });
      }
      const example = JSON.parse(fs.readFileSync(CONFIG_EXAMPLE_PATH, 'utf-8'));
      delete example._comment;
      writeUsmartConfig(example, configPath);
      printJson({ ok: true, path: configPath, profile, next: '编辑该文件填入账号、密码、RSA 密钥、环境地址，然后运行 usmart doctor' });
    }));

  auth.cmd
    .command('profiles')
    .description('列出配置目录下的所有 profile')
    .action(guard(async (_o, command) => {
      const g = globalsOf(command);
      const profiles = listProfiles().map((p) => ({ ...p, session: fs.existsSync(getSessionFilePath(p.name)) }));
      emit({ ok: true, dir: configDir(), current: resolveProfile(g.profile), profiles }, { format: g.format, jq: g.jq });
    }));

  auth.add({
    name: 'login', legacy: 'login',
    description: '测试登录（成功后缓存 token）',
    allowData: false, readOnlyStatus: true,
    action: (session) => session.ensureLogin(),
  });

  auth.add({
    name: 'unlock', legacy: 'unlock',
    description: '测试交易解锁（trade-login）',
    allowData: false, readOnlyStatus: true,
    action: (session) => session.ensureTradeUnlocked(),
  });

  auth.add({
    name: 'status', legacy: 'status',
    description: '查看当前会话状态（读本地缓存，不触发网络）',
    allowData: false, readOnlyStatus: true,
    action: async () => null,
  });

  auth.add({
    name: 'logout',
    description: '清除本地缓存的 token / 解锁状态',
    allowData: false, readOnlyStatus: true,
    action: async (session) => { session.logout(); },
  });

  auth.add({
    name: 'trade-status', legacy: 'trade-status',
    description: '查询服务端交易解锁状态（data.status 0=未解锁 1=已解锁）',
    allowData: false,
    action: (session) => session.call((c) => c.postTrade('/user-server/open-api/get-trade-status', {})),
  });

  auth.add({
    name: 'send-captcha',
    description: '发送手机/邮箱验证码（默认 type=106 短信登录；见 usmart dict get captcha-type）',
    options: [opt('--type <n>', '验证码类型', { type: 'int', default: '106', choices: [101, 102, 103, 104, 105, 106] })],
    allowData: false,
    action: (session, o) => session.call((c) => c.sendCaptcha(o.type), { auth: false }),
  });

  auth.add({
    name: 'login-captcha',
    description: '验证码登录（先 send-captcha），成功后缓存 token',
    options: [opt('--captcha <code>', '收到的验证码', { required: true })],
    allowData: false, readOnlyStatus: true,
    action: (session, o) => session.loginWithCaptcha(o.captcha),
  });

  return auth;
}

export { readUsmartConfig, UsmartSessionManager, maskToken };
