import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { UsmartClient } from '../src/lib/usmart-client.js';

function generateConfig() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    account: {
      lang: '1',
      channel: 'test-channel',
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

describe('UsmartClient', () => {
  let originalFetch;
  let lastRequest;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastRequest = null;
    globalThis.fetch = async (url, init) => {
      lastRequest = { url, init };
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: '0', msg: 'ok', data: {} }) };
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('postTrade 应构造正确的基础 header', async () => {
    const client = new UsmartClient(generateConfig());
    client.token = 'token123';
    await client.postTrade('/test-path', { exchangeType: 100 });

    assert.ok(lastRequest.url.endsWith('/test-path'));
    const headers = lastRequest.init.headers;
    assert.equal(headers['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(headers['X-Lang'], '1');
    assert.equal(headers['X-Channel'], 'test-channel');
    assert.equal(headers['X-Dt'], 't5');
    assert.equal(headers['Authorization'], 'token123');
    assert.ok(headers['X-Sign']);
    assert.match(headers['X-Request-Id'], /^\d{19}$/);
    assert.match(headers['X-Time'], /^\d{10}$/);
  });

  it('postQuote 应包含 X-Time 并使用行情 host', async () => {
    const client = new UsmartClient(generateConfig());
    client.token = 'token123';
    await client.postQuote('/quotes/v1/realtime', { secuIds: ['usAAPL'] });

    assert.ok(lastRequest.url.includes('localhost:19999/quotes/v1/realtime'));
    const headers = lastRequest.init.headers;
    assert.ok(headers['X-Time']);
    assert.ok(headers['X-Sign']);
    assert.ok(headers['Authorization']);
  });

  it('login 成功后应保存 token', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      text: async () => JSON.stringify({ code: '0', msg: 'ok', data: { token: 'new-token' } }),
    });
    const client = new UsmartClient(generateConfig());
    const result = await client.login();
    assert.equal(result.data.token, 'new-token');
    assert.equal(client.token, 'new-token');
  });
});

describe('超时与重试可配置（诊断命令需要有界）', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('quoteRetry: 0 时行情请求不重试', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; };
    const client = new UsmartClient(generateConfig(), { quoteRetry: 0 });
    await assert.rejects(() => client.postQuote('/q', {}));
    assert.equal(calls, 1, '不应重试');
  });

  it('默认行情请求会重试一次', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; };
    const client = new UsmartClient(generateConfig());
    await assert.rejects(() => client.postQuote('/q', {}));
    assert.equal(calls, 2, '默认应重试一次');
  });

  it('timeoutMs 可覆盖', () => {
    assert.equal(new UsmartClient(generateConfig(), { timeoutMs: 1234 }).timeoutMs, 1234);
  });
});
