import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function configDir() {
  return process.env.USMART_CONFIG_DIR || path.join(os.homedir(), '.config', 'usmart-cli');
}

function sessionFile() {
  return path.join(configDir(), 'session.json');
}

/**
 * 会话缓存：把登录 token / 交易解锁状态持久化到磁盘，
 * 让后续命令复用,避免每条命令都重新登录,也让 `status` 能反映真实状态。
 *
 * 缓存按「配置指纹」隔离：换账号/环境后旧 token 自动失效。
 * token 过期由 session 层的自动重登重试兜底,这里只做尽量复用。
 */

function fingerprint(config) {
  const seed = [
    config?.account?.phoneNumber,
    config?.account?.channel,
    config?.env?.tradeHost,
  ].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export function loadSession(config) {
  try {
    const file = sessionFile();
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (data.fingerprint !== fingerprint(config)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(config, { token, tradeUnlocked }) {
  const dir = configDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = {
    fingerprint: fingerprint(config),
    token,
    tradeUnlocked: !!tradeUnlocked,
    updatedAt: new Date().toISOString(),
  };
  const file = sessionFile();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  fs.chmodSync(file, 0o600);
}

export function clearSession() {
  try {
    const file = sessionFile();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export function getSessionFilePath() {
  return sessionFile();
}
