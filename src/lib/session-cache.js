import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sessionPathFor, configDir } from './usmart-config.js';

/**
 * 会话缓存：把登录 token / 交易解锁状态持久化到磁盘，让后续命令复用。
 *
 * - 按 profile 分文件（session.json / session-<profile>.json）。
 * - 再按「配置指纹」隔离：同一 profile 换账号/环境后旧 token 自动失效。
 * - token 过期由 session 层的自动重登重试兜底，这里只做尽量复用。
 */
function fingerprint(config) {
  const seed = [config?.account?.phoneNumber, config?.account?.channel, config?.env?.tradeHost].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

export function loadSession(config, profile) {
  try {
    const file = sessionPathFor(profile);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (data.fingerprint !== fingerprint(config)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(config, { token, tradeUnlocked }, profile) {
  const dir = configDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const data = {
    fingerprint: fingerprint(config),
    token,
    tradeUnlocked: !!tradeUnlocked,
    updatedAt: new Date().toISOString(),
  };
  const file = sessionPathFor(profile);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

export function clearSession(profile) {
  try {
    const file = sessionPathFor(profile);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export function getSessionFilePath(profile) {
  return sessionPathFor(profile);
}

export { path as _path };
