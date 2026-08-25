import fs from 'fs';
import path from 'path';
import { configDir } from './usmart-config.js';

/**
 * 客户端限流：滑动窗口配额 + 最小请求间隔（跨进程通过文件共享）。
 *
 * 官方文档的配额（基础行情 API）：
 *   高频接口（realtime/timeline/kline/tick/marketstate/orderbook）120 次/分钟
 *   低频接口（basicinfo）20 次/分钟
 *
 * 但实测行情网关除了分钟配额，对**突发**同样敏感：短时间内连打十几次会被
 * openresty 在 HTTP 层直接返回 403 并封一段时间（此时未鉴权请求返回 400，
 * 说明不是路径问题）。因此除配额外再强制一个最小请求间隔。
 *
 * 超限时不报错，而是等待到可发送为止；设置 USMART_NO_RATE_LIMIT=1 可整体关闭。
 */
export const QUOTE_LIMITS = {
  'quote-high': 120,
  'quote-low': 20,
};

/** 相邻两次行情请求的最小间隔（毫秒）。 */
export const DEFAULT_MIN_INTERVAL_MS = 400;

export function minIntervalMs() {
  const v = Number(process.env.USMART_QUOTE_MIN_INTERVAL_MS);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MIN_INTERVAL_MS;
}

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
 * @param {string} bucket
 * @param {number} [limitPerMinute]
 * @param {{spacing?: boolean}} [opts] spacing=false 时只做配额、不做间隔
 * @returns {Promise<number>} 实际等待的毫秒数
 */
export async function acquire(bucket, limitPerMinute = QUOTE_LIMITS[bucket] || 120, { spacing = true } = {}) {
  if (process.env.USMART_NO_RATE_LIMIT) return 0;
  const windowMs = 60_000;
  const gap = spacing ? minIntervalMs() : 0;
  let waited = 0;

  for (;;) {
    const now = Date.now();
    const data = load();
    const stamps = (data[bucket] || []).filter((t) => now - t < windowMs);

    // 1. 最小间隔：与全局上一次行情请求拉开距离，避免突发触发网关封禁
    const sinceLast = now - (data.__last || 0);
    if (gap > 0 && sinceLast < gap) {
      const waitMs = gap - sinceLast;
      await sleep(waitMs);
      waited += waitMs;
      continue;
    }

    // 2. 分钟配额
    if (stamps.length >= limitPerMinute) {
      const waitMs = Math.min(windowMs, stamps[0] + windowMs - now + 50);
      process.stderr.write(`[usmart] 触发客户端限流（${bucket} ${limitPerMinute}/min），等待 ${Math.ceil(waitMs / 1000)}s…\n`);
      await sleep(waitMs);
      waited += waitMs;
      continue;
    }

    stamps.push(now);
    data[bucket] = stamps;
    data.__last = now;
    save(data);
    return waited;
  }
}
