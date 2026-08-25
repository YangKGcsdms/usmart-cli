import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { acquire, bucketForQuotePath, minIntervalMs } from '../src/lib/rate-limit.js';

describe('rate-limit', () => {
  let dir; let saved;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-rl-')); saved = process.env.USMART_CONFIG_DIR; process.env.USMART_CONFIG_DIR = dir; delete process.env.USMART_NO_RATE_LIMIT; });
  afterEach(() => { if (saved === undefined) delete process.env.USMART_CONFIG_DIR; else process.env.USMART_CONFIG_DIR = saved; fs.rmSync(dir, { recursive: true, force: true }); });

  it('basicinfo 走低频桶', () => {
    assert.equal(bucketForQuotePath('/quotes-openservice/api/v1/basicinfo'), 'quote-low');
    assert.equal(bucketForQuotePath('/quotes-openservice/api/v1/kline'), 'quote-high');
  });
  it('未超限不等待，超限等待到窗口空出', async () => {
    for (let i = 0; i < 3; i++) assert.equal(await acquire('t', 3, { spacing: false }), 0);
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'ratelimit.json'), 'utf-8'));
    assert.equal(data.t.length, 3);
    // 人为把最早一条改成 59.9s 前，第 4 次应只等约 150ms
    data.t[0] = Date.now() - 59_900; fs.writeFileSync(path.join(dir, 'ratelimit.json'), JSON.stringify(data));
    const waited = await acquire('t', 3, { spacing: false });
    assert.ok(waited > 0 && waited < 2000, String(waited));
  });
  it('最小间隔会拉开相邻两次请求', async () => {
    process.env.USMART_QUOTE_MIN_INTERVAL_MS = '150';
    assert.equal(minIntervalMs(), 150);
    await acquire('t', 100);
    const t0 = Date.now();
    await acquire('t', 100);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 120, `相邻请求应间隔 ~150ms，实际 ${elapsed}ms`);
    delete process.env.USMART_QUOTE_MIN_INTERVAL_MS;
  });
  it('USMART_NO_RATE_LIMIT 关闭', async () => { process.env.USMART_NO_RATE_LIMIT = '1'; assert.equal(await acquire('t', 0), 0); });
});
