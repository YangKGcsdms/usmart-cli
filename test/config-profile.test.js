import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configDir, configPathFor, sessionPathFor, readUsmartConfig, writeUsmartConfig, listProfiles, deriveWsHost } from '../src/lib/usmart-config.js';
import { saveSession, loadSession, clearSession } from '../src/lib/session-cache.js';

const sample = {
  account: { lang: '1', channel: 'c', areaCode: '86', phoneNumber: '1', loginPassword: 'p', tradePassword: '123456', publicKey: 'x', privateKey: 'y' },
  env: { tradeHost: 'https://t', quoteHost: 'https://q:8443' },
};

describe('config + profile + USMART_CONFIG_DIR', () => {
  let dir; let saved;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-cfg-')); saved = process.env.USMART_CONFIG_DIR; process.env.USMART_CONFIG_DIR = dir; });
  afterEach(() => { if (saved === undefined) delete process.env.USMART_CONFIG_DIR; else process.env.USMART_CONFIG_DIR = saved; fs.rmSync(dir, { recursive: true, force: true }); });

  it('USMART_CONFIG_DIR 同时作用于配置与会话', () => {
    assert.equal(configDir(), dir);
    assert.equal(configPathFor('default'), path.join(dir, 'usmart.json'));
    assert.equal(configPathFor('uat'), path.join(dir, 'uat.json'));
    assert.equal(sessionPathFor('default'), path.join(dir, 'session.json'));
    assert.equal(sessionPathFor('uat'), path.join(dir, 'session-uat.json'));
  });
  it('写入即 600 权限；缺失时报 config_missing 且 hint 带 profile', () => {
    writeUsmartConfig(sample, configPathFor('uat'));
    assert.equal((fs.statSync(configPathFor('uat')).mode & 0o777).toString(8), '600');
    const cfg = readUsmartConfig({ profile: 'uat' });
    assert.equal(cfg.env.pushHost, 'wss://q:8443/wss/v1');
    assert.equal(cfg.account.deviceType, 't5');
    assert.throws(() => readUsmartConfig({ profile: 'prod' }), (e) => e.type === 'config_missing' && /--profile prod/.test(e.hint));
  });
  it('缺字段 → config_invalid 列出缺失项', () => {
    writeUsmartConfig({ account: { lang: '1' }, env: {} }, configPathFor('bad'));
    assert.throws(() => readUsmartConfig({ profile: 'bad' }), (e) => e.type === 'config_invalid' && e.details.missing.includes('account.channel') && e.details.missing.includes('env.tradeHost'));
  });
  it('listProfiles 识别 default 与命名 profile，忽略 session 文件', () => {
    writeUsmartConfig(sample, configPathFor('default'));
    writeUsmartConfig(sample, configPathFor('uat'));
    saveSession(sample, { token: 't' }, 'uat');
    assert.deepEqual(listProfiles().map((p) => p.name).sort(), ['default', 'uat']);
  });
  it('会话按 profile 与配置指纹隔离', () => {
    saveSession(sample, { token: 'tok', tradeUnlocked: true }, 'uat');
    assert.equal((fs.statSync(sessionPathFor('uat')).mode & 0o777).toString(8), '600');
    assert.equal(loadSession(sample, 'uat').token, 'tok');
    assert.equal(loadSession(sample, 'default'), null);
    assert.equal(loadSession({ ...sample, account: { ...sample.account, phoneNumber: '2' } }, 'uat'), null);
    clearSession('uat');
    assert.equal(loadSession(sample, 'uat'), null);
  });
  it('deriveWsHost', () => { assert.equal(deriveWsHost('https://open-hz.yxzq.com:8443'), 'wss://open-hz.yxzq.com:8443/wss/v1'); });
});
