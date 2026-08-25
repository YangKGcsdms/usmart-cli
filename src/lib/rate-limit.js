import fs from 'fs';
import path from 'path';
import { configDir } from './usmart-config.js';

/**
 * 客户端限流（滑动窗口，跨进程通过文件共享）。
 *
 * 官方限制（基础行情 API）：
 *   高频接口（realtime/timeline/kline/tick/marketstate/orderbook）120 次/分钟
 *   低频接口（basicinfo）20 次/分钟
 *
 * 超限时不报错而是等待到窗口空出（最多 60s），并在 stderr 提示；
 * 设置 USMART_NO_RATE_LIMIT=1 可关闭（测试用）。
 */
export const QUOTE_LIMITS = {
  'quote-high': 120,
  'quote-low': 20,
};

export function bucketForQuotePath(p) {
  return /\/basicinfo$/.test(p) ? 'quote-low' : 'quote-high';
}

function file() {
  return path.join(configDir(), 'ratelimit.json');
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf-8'));
  } catch {
    return {};
  }
}

function save(data) {
  try {
    const dir = configDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file(), JSON.stringify(data), { mode: 0o600 });
  } catch {
    /* 限流记录写失败不影响主流程 */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 申请一次调用额度；必要时等待。
 * @returns {Promise<number>} 实际等待的毫秒数
 */
export async function acquire(bucket, limitPerMinute = QUOTE_LIMITS[bucket] || 120) {
  if (process.env.USMART_NO_RATE_LIMIT) return 0;
  const windowMs = 60_000;
  let waited = 0;
  for (;;) {
    const now = Date.now();
    const data = load();
    const stamps = (data[bucket] || []).filter((t) => now - t < windowMs);
    if (stamps.length < limitPerMinute) {
      stamps.push(now);
      data[bucket] = stamps;
      save(data);
      return waited;
    }
    const waitMs = Math.min(windowMs, stamps[0] + windowMs - now + 50);
    process.stderr.write(`[usmart] 触发客户端限流（${bucket} ${limitPerMinute}/min），等待 ${Math.ceil(waitMs / 1000)}s…\n`);
    await sleep(waitMs);
    waited += waitMs;
  }
}
