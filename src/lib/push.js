import { CliError, EXIT, describeCode } from './errors.js';

/**
 * 行情推送（WebSocket）客户端。官方协议：
 *   接入：wss://open-hz.yxzq.com:8443/wss/v1
 *   鉴权：{op:'auth', ts, reqId, accessToken}
 *   心跳：服务端 {op:'ping'} → 客户端 {op:'pong'}
 *   订阅：{op:'sub', ts, reqId, topiclist:['rt.hk.00700', ...]}   type ∈ rt|tk|ob，market ∈ hk|us|sh|sz
 *   推送：{op:'update', topic, data}  data 可能为 base64 编码的 JSON
 *   限制：最多同时订阅 10 个 topic，每秒最多订阅/取消 10 个
 */
export const TOPIC_RE = /^(rt|tk|ob)\.(hk|us|sh|sz)\.[A-Za-z0-9.]+$/;
export const MAX_TOPICS = 10;

async function getWebSocket() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try {
    const mod = await import('ws');
    return mod.WebSocket || mod.default;
  } catch {
    throw new CliError('websocket_unavailable', '当前 Node 版本没有内置 WebSocket', {
      exitCode: EXIT.ERROR,
      hint: '升级到 Node 22+，或在全局安装 ws（npm i -g ws）',
    });
  }
}

export function validateTopics(topics) {
  const bad = topics.filter((t) => !TOPIC_RE.test(t));
  if (bad.length) {
    throw new CliError('invalid_args', `topic 格式错误：${bad.join(', ')}`, {
      exitCode: EXIT.INVALID_ARGS,
      hint: '格式 $type.$market.$code，type ∈ rt|tk|ob，market ∈ hk|us|sz|sh，如 rt.hk.00700 / ob.us.AAPL',
    });
  }
  if (topics.length > MAX_TOPICS) {
    throw new CliError('invalid_args', `一次最多订阅 ${MAX_TOPICS} 个 topic，实际 ${topics.length}`, { exitCode: EXIT.INVALID_ARGS });
  }
}

function decodeData(data) {
  if (typeof data !== 'string') return data;
  try {
    const text = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(text);
  } catch {
    try { return JSON.parse(data); } catch { return data; }
  }
}

/**
 * 订阅并流式回调。
 * @param {object} p
 * @param {string} p.url        wss 地址
 * @param {string} p.token      登录 token
 * @param {string[]} p.topics
 * @param {(msg: object) => void} p.onMessage   每条推送 {topic, data, receivedAt}
 * @param {(ev: object) => void} [p.onEvent]    控制事件（auth/sub/pong 等）
 * @param {number} [p.durationMs]   运行时长，0 = 直到 SIGINT
 * @param {number} [p.maxMessages]  收到 N 条后退出，0 = 不限
 * @returns {Promise<{received:number, closedBy:string}>}
 */
export async function subscribe({ url, token, topics, onMessage, onEvent = () => {}, durationMs = 0, maxMessages = 0, connectTimeoutMs = 10_000 }) {
  validateTopics(topics);
  const WS = await getWebSocket();
  let reqId = Date.now();
  const nextReq = () => ++reqId;
  const ts = () => Math.floor(Date.now() / 1000);

  return new Promise((resolve, reject) => {
    const ws = new WS(url);
    let received = 0;
    let closedBy = '';
    let settled = false;
    const timers = [];
    const finish = (by, err) => {
      if (settled) return;
      settled = true;
      closedBy = by;
      timers.forEach(clearTimeout);
      process.off('SIGINT', onSigint);
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ op: 'unsub', ts: ts(), reqId: nextReq(), topiclist: topics }));
          ws.close();
        }
      } catch { /* ignore */ }
      if (err) reject(err); else resolve({ received, closedBy });
    };
    const onSigint = () => finish('sigint');
    process.on('SIGINT', onSigint);

    const send = (obj) => ws.send(JSON.stringify(obj));

    timers.push(setTimeout(() => finish('timeout', new CliError('timeout', '推送鉴权超时', { exitCode: EXIT.ERROR, retryable: true })), connectTimeoutMs));

    ws.onopen = () => send({ op: 'auth', ts: ts(), reqId: nextReq(), accessToken: token });
    ws.onerror = (ev) => finish('error', new CliError('network_error', `WebSocket 错误：${ev?.message || ev?.error?.message || 'unknown'}`, { exitCode: EXIT.ERROR, retryable: true }));
    ws.onclose = (ev) => finish('server_close', settled ? undefined : new CliError('connection_closed', `连接关闭 code=${ev?.code}`, { exitCode: EXIT.ERROR, retryable: true }));
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
      switch (msg.op) {
        case 'auth':
          if (String(msg.code) !== '0') {
            const d = describeCode(msg.code);
            return finish('auth_failed', new CliError('push_auth_failed', `推送鉴权失败：${msg.msg || d?.msg || msg.code}`, { exitCode: EXIT.API_ERROR, code: msg.code, hint: d?.hint }));
          }
          timers.forEach(clearTimeout);
          onEvent({ event: 'auth', ok: true });
          send({ op: 'sub', ts: ts(), reqId: nextReq(), topiclist: topics });
          return;
        case 'sub':
          if (String(msg.code) !== '0') {
            const d = describeCode(msg.code);
            return finish('sub_failed', new CliError('push_sub_failed', `订阅失败：${msg.msg || d?.msg || msg.code}`, { exitCode: EXIT.API_ERROR, code: msg.code, hint: d?.hint }));
          }
          onEvent({ event: 'sub', ok: true, topics });
          if (durationMs > 0) timers.push(setTimeout(() => finish('duration'), durationMs));
          return;
        case 'ping':
          send({ op: 'pong', ts: ts(), reqId: msg.reqId ?? nextReq() });
          return;
        case 'update':
          received += 1;
          onMessage({ topic: msg.topic, data: decodeData(msg.data), receivedAt: new Date().toISOString() });
          if (maxMessages > 0 && received >= maxMessages) finish('max_messages');
          return;
        case 'unsub':
          return;
        default:
          onEvent({ event: msg.op, raw: msg });
      }
    };
  });
}
