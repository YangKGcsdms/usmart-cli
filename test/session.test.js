import { describe, it, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { UsmartSessionManager, CODE_TOKEN_INVALID } from '../src/lib/session.js';

// 把会话缓存隔离到临时目录，避免污染真实 ~/.config 且保证测试间互不干扰。
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-test-'));
process.env.USMART_CONFIG_DIR = TMP_DIR;

function generateConfig() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    account: {
      lang: '1',
      channel: 'test',
      areaCode: '86',
      phoneNumber: '13800138000',
      loginPassword: 'loginpass',
      tradePassword: '123456',
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    },
    env: {
      tradeHost: 'http://localhost:19999',
      quoteHost: 'http://localhost:19999',
      type: 0,
    },
  };
}

describe('UsmartSessionManager', () => {
  let originalFetch;
  let responses = [];

  beforeEach(() => {
    // 清掉上一个测试写入的会话缓存，保证每个用例从未登录态开始。
    fs.rmSync(path.join(TMP_DIR, 'session.json'), { force: true });
    originalFetch = globalThis.fetch;
    responses = [];
    globalThis.fetch = async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : {};
      const handler = responses.shift() || (() => ({ code: '0', msg: 'ok', data: {} }));
      const result = handler(url, init, body);
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify(result),
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('ensureLogin 成功时设置 loggedIn', async () => {
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't1' } }));
    const session = new UsmartSessionManager(generateConfig());
    await session.ensureLogin();
    assert.equal(session.isLoggedIn(), true);
    assert.equal(session.getClient().token, 't1');
  });

  it('ensureTradeUnlocked 会先登录再解锁', async () => {
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't1' } }));
    responses.push(() => ({ code: '0', msg: 'ok', data: {} }));
    const session = new UsmartSessionManager(generateConfig());
    await session.ensureTradeUnlocked();
    assert.equal(session.isLoggedIn(), true);
    assert.equal(session.isTradeUnlocked(), true);
  });

  it('call 只读接口遇到 300101 会自动重登并重试', async () => {
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't1' } }));
    responses.push(() => ({ code: CODE_TOKEN_INVALID, msg: 'expired' }));
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't2' } }));
    responses.push(() => ({ code: '0', msg: 'ok', data: { list: [1, 2] } }));

    const session = new UsmartSessionManager(generateConfig());
    const result = await session.call(
      (client) => client.postTrade('/test', {}),
      { requireTrade: false }
    );
    assert.equal(result.code, '0');
    assert.deepEqual(result.data.list, [1, 2]);
    assert.equal(session.getClient().token, 't2');
  });

  it('call 交易接口遇到 300101 重登后抛 retryable 异常', async () => {
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't1' } }));
    responses.push(() => ({ code: '0', msg: 'ok', data: {} }));
    responses.push(() => ({ code: CODE_TOKEN_INVALID, msg: 'expired' }));
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't2' } }));
    responses.push(() => ({ code: '0', msg: 'ok', data: {} }));

    const session = new UsmartSessionManager(generateConfig());
    await assert.rejects(
      () => session.call((client) => client.postTrade('/test', {}), { requireTrade: true }),
      (err) => err.code === CODE_TOKEN_INVALID && err.retryable === true
    );
  });

  it('call 遇到 409984 会自动重新解锁并重试', async () => {
    responses.push(() => ({ code: '0', msg: 'ok', data: { token: 't1' } }));
    responses.push(() => ({ code: '0', msg: 'ok', data: {} }));
    responses.push(() => ({ code: '409984', msg: 'locked' }));
    responses.push(() => ({ code: '0', msg: 'ok', data: {} }));
    responses.push(() => ({ code: '0', msg: 'ok', data: { ok: true } }));

    const session = new UsmartSessionManager(generateConfig());
    const result = await session.call(
      (client) => client.postTrade('/test', {}),
      { requireTrade: true }
    );
    assert.equal(result.data.ok, true);
  });
});
