import fs from 'fs';
import path from 'path';
import os from 'os';
import { CliError, EXIT } from './errors.js';

/**
 * 配置目录与 profile 解析。
 *
 * - 目录：$USMART_CONFIG_DIR，缺省 ~/.config/usmart-cli
 * - profile：--profile <name> / $USMART_PROFILE，缺省 default
 *   default  → <dir>/usmart.json（兼容 1.x）
 *   <name>   → <dir>/<name>.json
 * - 会话缓存与配置同目录、同 profile 隔离：session.json / session-<name>.json
 */
export function configDir() {
  return process.env.USMART_CONFIG_DIR || path.join(os.homedir(), '.config', 'usmart-cli');
}

export function resolveProfile(name) {
  return name || process.env.USMART_PROFILE || 'default';
}

export function configPathFor(profile) {
  const p = resolveProfile(profile);
  return path.join(configDir(), p === 'default' ? 'usmart.json' : `${p}.json`);
}

export function sessionPathFor(profile) {
  const p = resolveProfile(profile);
  return path.join(configDir(), p === 'default' ? 'session.json' : `session-${p}.json`);
}

export function getDefaultConfigPath() {
  return configPathFor('default');
}

/** 列出目录下所有 profile。 */
export function listProfiles() {
  const dir = configDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('session') && f !== 'ratelimit.json')
    .map((f) => {
      const name = f === 'usmart.json' ? 'default' : f.replace(/\.json$/, '');
      return { name, path: path.join(dir, f) };
    });
}

/**
 * 读取并校验配置。
 * @param {object} [opts]
 * @param {string} [opts.configPath] 显式路径（优先级最高）
 * @param {string} [opts.profile]
 */
export function readUsmartConfig(opts = {}) {
  const configPath = typeof opts === 'string' ? opts : (opts.configPath || configPathFor(opts.profile));
  if (!fs.existsSync(configPath)) {
    throw new CliError('config_missing', `未找到 uSMART 配置文件：${configPath}`, {
      exitCode: EXIT.ERROR,
      hint: `运行 usmart auth config-init${typeof opts === 'object' && opts.profile && opts.profile !== 'default' ? ` --profile ${opts.profile}` : ''} 生成模板后填入账号、RSA 密钥、环境地址`,
    });
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    throw new CliError('config_invalid', `配置文件不是合法 JSON：${configPath}（${err.message}）`, { exitCode: EXIT.ERROR });
  }
  validateConfig(parsed, configPath);
  parsed.__path = configPath;
  return parsed;
}

export function writeUsmartConfig(config, configPath = getDefaultConfigPath()) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // 直接以 600 创建，避免先写 644 再 chmod 的窗口期。
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  fs.chmodSync(configPath, 0o600);
}

export const REQUIRED_ACCOUNT_FIELDS = [
  'lang', 'channel', 'areaCode', 'phoneNumber',
  'loginPassword', 'tradePassword', 'publicKey', 'privateKey',
];
export const REQUIRED_ENV_FIELDS = ['tradeHost', 'quoteHost'];

export function validateConfig(config, configPath = '') {
  if (!config || typeof config !== 'object' || !config.account || !config.env) {
    throw new CliError('config_invalid', '配置文件必须包含 account 和 env 两个字段', { exitCode: EXIT.ERROR, details: { path: configPath } });
  }
  const missing = [];
  for (const f of REQUIRED_ACCOUNT_FIELDS) if (!config.account[f]) missing.push(`account.${f}`);
  for (const f of REQUIRED_ENV_FIELDS) if (!config.env[f]) missing.push(`env.${f}`);
  if (missing.length) {
    throw new CliError('config_invalid', `配置缺少必填字段：${missing.join(', ')}`, {
      exitCode: EXIT.ERROR,
      hint: `编辑 ${configPath || '配置文件'} 补齐上述字段`,
      details: { missing },
    });
  }
  // 可选字段默认值
  config.account.deviceType = config.account.deviceType || 't5';
  config.env.pushHost = config.env.pushHost || deriveWsHost(config.env.quoteHost);
  return config;
}

/** 由行情 host 推导推送 wss 地址（官方：wss://open-hz.yxzq.com:8443/wss/v1）。 */
export function deriveWsHost(quoteHost) {
  if (!quoteHost) return '';
  return quoteHost.replace(/^http/, 'ws').replace(/\/+$/, '') + '/wss/v1';
}
