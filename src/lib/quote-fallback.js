import { subscribe } from './push.js';
import { CliError, EXIT } from './errors.js';

/**
 * 行情 REST 降级到 WebSocket 推送。
 *
 * 背景：行情 REST 与交易是分开授权的，渠道无 REST 行情权限时网关直接返回 HTTP 403
 * （token 有效），而同一 token 的 WebSocket 推送不受影响。此时把 realtime / order-book
 * 这两个「取当前快照」的需求转到推送上，先到先得地收一条即返回。
 *
 * 局限（必须让调用方知道）：推送只在行情变动时才推。收市或标的停牌时可能一条都收不到，
 * 这时返回明确的超时错误，而不是假装没有数据。
 */

/** `usAAPL` → `{market:'us', code:'AAPL'}`；`hk00700` → `{market:'hk', code:'00700'}` */
export function parseSecuId(secuId) {
  const m = String(secuId).match(/^(hk|us|sh|sz)(.+)$/i);
  if (!m) {
    throw new CliError('invalid_args', `无法解析 secuId：${secuId}`, {
      exitCode: EXIT.INVALID_ARGS,
      hint: '格式为 市场+代码，市场 ∈ hk|us|sh|sz，如 usAAPL / hk00700',
    });
  }
  return { market: m[1].toLowerCase(), code: m[2] };
}

export function toTopic(type, secuId) {
  const { market, code } = parseSecuId(secuId);
  return `${type}.${market}.${code}`;
}

/**
 * 通过推送收取每个 secuId 的首条数据，拼成与 REST 相同的响应形状。
 * @param {object} p
 * @param {'rt'|'ob'} p.type
 * @param {string[]} p.secuIds
 * @param {string} p.url    wss 地址
 * @param {string} p.token
 * @param {number} [p.timeoutMs]
 */
export async function snapshotViaPush({ type, secuIds, url, token, timeoutMs = 12_000 }) {
  const topics = secuIds.map((id) => toTopic(type, id));
  const got = new Map();

  await subscribe({
    url,
    token,
    topics,
    durationMs: timeoutMs,
    onEvent: () => {},
    onMessage: (m) => { if (!got.has(m.topic)) got.set(m.topic, m.data); },
    // 每个 topic 都拿到一条就够了
    maxMessages: 0,
    stopWhen: () => got.size >= topics.length,
  });

  if (got.size === 0) {
    throw new CliError('push_no_data', `行情 REST 不可用，已降级到 WebSocket，但 ${Math.round(timeoutMs / 1000)}s 内没有收到任何推送`, {
      exitCode: EXIT.API_ERROR,
      hint: '推送只在行情变动时才推：非交易时段、停牌或冷门标的可能长时间无数据。可用 usmart quote subscribe 持续等待，或加大 --ws-timeout',
      details: { topics },
    });
  }

  const list = topics.map((t) => got.get(t)).filter(Boolean);
  return {
    code: 0,
    msg: 'success',
    data: type === 'ob' ? (list[0] ?? null) : { list },
    _via: 'websocket',
    _note: `行情 REST 返回 403（该渠道无 REST 行情权限），已自动降级到 WebSocket 推送${got.size < topics.length ? `；${topics.length - got.size} 个标的在超时内无推送` : ''}`,
  };
}

/** 判断响应是否为「REST 行情被网关拒绝」。 */
export function isQuoteForbidden(resp) {
  return resp != null && (String(resp.code) === 'HTTP_403' || resp.httpStatus === 403);
}
