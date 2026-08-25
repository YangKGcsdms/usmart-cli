import { defineDomain } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { subscribe } from '../lib/push.js';

const MARKET = opt('--market <m>', '市场：hk|us|sh|sz', { default: 'hk', choices: ['hk', 'us', 'sh', 'sz'] });
const SECU = opt('--secu-id <id>', '证券唯一标识 = 市场+代码，如 usAAPL / hk00700', { required: true });

function parseDuration(v) {
  if (v === undefined || v === null || v === '') return 0;
  const m = String(v).match(/^(\d+)(ms|s|m|h)?$/);
  if (!m) return Number(v) || 0;
  const n = Number(m[1]);
  return { ms: n, s: n * 1000, m: n * 60_000, h: n * 3_600_000 }[m[2] || 's'];
}

export function registerQuote(program) {
  const quote = defineDomain(program, 'quote', '基础行情：实时、市场状态、K 线、分时、逐笔、买卖盘、证券基础信息、WebSocket 推送订阅');

  quote.add({
    name: 'realtime', legacy: 'realtime',
    description: '实时行情（可多只，逗号分隔）',
    options: [opt('--secu-ids <ids>', '证券 ID 列表，如 usAAPL,hk00700', { type: 'list', required: true })],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/realtime', ctx.merge({ secuIds: o.secuIds }))),
  });

  quote.add({
    name: 'market-state', legacy: 'market-state',
    description: '市场状态（status 见 usmart dict get market-status）',
    options: [MARKET],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/marketstate', ctx.merge({ market: o.market }))),
  });

  quote.add({
    name: 'basicinfo',
    description: '整个市场的证券基础信息（代码/名称/类型/每手数量）—— 低频接口，20 次/分钟',
    options: [MARKET],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/basicinfo', ctx.merge({ market: o.market }))),
  });

  quote.add({
    name: 'kline', legacy: 'kline',
    description: 'K 线（type 见 usmart dict get kline-type）',
    options: [
      SECU,
      opt('--type <n>', 'K 线类型：1=1分 2=5分 3=10分 4=15分 5=30分 6=60分 7=日 8=周 9=月 10=3月 11=6月 12=年', { type: 'int', default: '7', choices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
      opt('--start <n>', '起始时间（首页传 0，翻页传上一页最后一条 latestTime）', { type: 'int', default: '0' }),
      opt('--count <n>', '每页条数', { type: 'int', default: '100' }),
      opt('--right <n>', '复权：0=不复权 1=前复权 2=后复权', { type: 'int', default: '0', choices: [0, 1, 2] }),
    ],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/kline', ctx.merge({ secuId: o.secuId, type: o.type, start: o.start, count: o.count, right: o.right }))),
  });

  quote.add({
    name: 'timeline',
    description: '分时（0=一日 1=五日）',
    options: [SECU, opt('--type <n>', '0=一日分时 1=五日分时', { type: 'int', default: '0', choices: [0, 1] })],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/timeline', ctx.merge({ secuId: o.secuId, type: o.type }))),
  });

  quote.add({
    name: 'tick',
    description: '逐笔成交',
    options: [
      SECU,
      opt('--trade-time <n>', '起始行情时间（首页 0，翻页传结果里的 time）', { type: 'int', default: '0' }),
      opt('--seq <n>', '起始序号（首页 0，翻页传结果里的 seq）', { type: 'int', default: '0' }),
      opt('--count <n>', '每页条数', { type: 'int', default: '50' }),
      opt('--sort <n>', '0=时间逆序 1=时间顺序', { type: 'int', default: '0', choices: [0, 1] }),
    ],
    // 官方文档自相矛盾：参数表写 `seq`，同一页的请求示例却用 `start`（返回体里也叫 start）。
    // 实测首页两者都能拿到数据，但分不出服务端究竟读哪个 —— 若它读 start 而我们只发 seq，
    // 翻页会静默停在第一页。故两个字段一起发、取值相同。
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/tick', ctx.merge({
      secuId: o.secuId, tradeTime: o.tradeTime, seq: o.seq, start: o.seq, count: o.count, sortDirection: o.sort,
    }))),
  });

  quote.add({
    name: 'order-book', legacy: 'order-book',
    description: '买卖盘（档位）',
    options: [SECU],
    action: (s, o, ctx) => s.call((c) => c.postQuote('/quotes-openservice/api/v1/orderbook', ctx.merge({ secuId: o.secuId }))),
  });

  quote.add({
    name: 'subscribe',
    description: 'WebSocket 行情推送，stdout 逐行输出 NDJSON（{topic,data,receivedAt}）；Ctrl-C / --duration / --count 结束',
    options: [
      opt('--topics <list>', 'topic 列表，格式 $type.$market.$code（type: rt|tk|ob），如 rt.hk.00700,ob.us.AAPL，最多 10 个', { type: 'list', required: true }),
      opt('--duration <t>', '运行时长，如 30s / 5m / 1h，缺省直到 Ctrl-C'),
      opt('--count <n>', '收到 N 条推送后退出', { type: 'int', default: '0' }),
    ],
    allowData: false,
    action: async (s, o, ctx) => {
      await s.ensureLogin();
      if (ctx.dryRun) {
        return { __dryRun: { method: 'WS', url: ctx.config.env.pushHost, body: { op: 'sub', topiclist: o.topics } } };
      }
      const result = await subscribe({
        url: ctx.config.env.pushHost,
        token: s.getClient().token,
        topics: o.topics,
        durationMs: parseDuration(o.duration),
        maxMessages: o.count,
        onEvent: (ev) => process.stderr.write(`[usmart] ${JSON.stringify(ev)}\n`),
        onMessage: (m) => process.stdout.write(JSON.stringify(m) + '\n'),
      });
      process.stderr.write(`[usmart] 订阅结束：received=${result.received} closedBy=${result.closedBy}\n`);
      return { __stream: true, ...compact(result) };
    },
  });

  return quote;
}
