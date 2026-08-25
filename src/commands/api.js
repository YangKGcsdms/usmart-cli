import { makeHandler, applyOptions, CliError, EXIT } from '../lib/registry.js';

/**
 * 通用 API 调用：usmart api POST <path> [--data] [--quote] [--require-trade] [--no-auth]
 * uSMART 开放接口全部为 POST；path 以 / 开头。
 */
const def = {
  name: 'api',
  __domain: '',
  description: '通用 uSMART API 调用（兜底：CLI 未封装的接口）',
  options: [],
  allowData: true,
  action: async (session, opts, ctx) => {
    const { method, path } = ctx.args;
    if (String(method).toUpperCase() !== 'POST') {
      throw new CliError('invalid_args', `uSMART 开放接口仅支持 POST，收到 ${method}`, { exitCode: EXIT.INVALID_ARGS });
    }
    if (!path.startsWith('/')) throw new CliError('invalid_args', 'path 需以 / 开头，如 /stock-order-server/open-api/today-entrust', { exitCode: EXIT.INVALID_ARGS });
    const body = ctx.extra;
    const requireTrade = !!opts.requireTrade;
    const auth = opts.auth !== false;
    return session.call((c) => (opts.quote ? c.postQuote(path, body) : c.postTrade(path, body, { auth })), { requireTrade, auth });
  },
};

/** 在任意父命令上注册 `api <method> <path>`；legacyName 用于 `usmart usmart api` 兼容入口。 */
export function registerApiCommand(parent, { legacyName } = {}) {
  const cmd = parent
    .command('api <method> <path>')
    .description(legacyName ? `[已弃用 → usmart api] ${def.description}` : def.description)
    .option('--quote', '走行情 host（默认交易 host）')
    .option('--require-trade', '需要交易解锁（写操作）')
    .option('--no-auth', '不带登录态（如 reset-login-password）');
  applyOptions(cmd, def);
  cmd.action((method, path, options, command) => {
    const wrapped = { ...def, action: (s, o, ctx) => def.action(s, o, { ...ctx, args: { method, path } }) };
    return makeHandler(wrapped, { legacyName })(options, command);
  });
  return cmd;
}

export function registerApi(program) {
  return registerApiCommand(program);
}
