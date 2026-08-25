import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readUsmartConfig, writeUsmartConfig } from '../src/lib/usmart-config.js';

describe('usmart-config', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-cli-test-'));
  });

  it('读取缺失的配置文件应抛出清晰错误', () => {
    const missing = path.join(tmpDir, 'missing.json');
    assert.throws(() => readUsmartConfig(missing), /未找到 uSMART 配置文件/);
  });

  it('写入并读取完整配置', () => {
    const configPath = path.join(tmpDir, 'usmart.json');
    const config = {
      account: {
        lang: '1',
        channel: 'ch',
        areaCode: '86',
        phoneNumber: '13800138000',
        loginPassword: 'lp',
        tradePassword: '123456',
        publicKey: 'cHVibGljS2V5',
        privateKey: 'cHJpdmF0ZUtleQ==',
      },
      env: {
        tradeHost: 'https://trade.example.com',
        quoteHost: 'https://quote.example.com',
        type: 0,
      },
    };
    writeUsmartConfig(config, configPath);
    const loaded = readUsmartConfig(configPath);
    assert.deepEqual(loaded.account, { ...config.account, deviceType: 't5' });
    assert.equal(loaded.env.tradeHost, config.env.tradeHost);
    assert.equal(loaded.env.pushHost, 'wss://quote.example.com/wss/v1');
    assert.equal((fs.statSync(configPath).mode & 0o777).toString(8), '600');
  });

  it('缺少必要字段应校验失败', () => {
    const configPath = path.join(tmpDir, 'usmart.json');
    writeUsmartConfig({ account: {}, env: {} }, configPath);
    assert.throws(() => readUsmartConfig(configPath), /配置缺少必填字段：account\.lang/);
  });
});
