/**
 * 集成测试：用真实账号配置（~/.config/usmart-cli/usmart.json 或 USMART_CONFIG_DIR）跑所有只读命令。
 * 交易类写操作（下单/撤单/改单/认购/密码修改/出金撤销）只测 --dry-run 与 --yes 门禁，绝不真实发送。
 *
 * 运行：USMART_INTEGRATION=1 npm run test:integration
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = path.join(ROOT, 'bin', 'usmart');
const ENABLED = !!process.env.USMART_INTEGRATION;

function run(args, { env = {}, timeout = 60_000 } = {}) {
  const r = spawnSync('node', [BIN, ...args], { encoding: 'utf-8', timeout, env: { ...process.env, ...env } });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not json */ }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, json };
}

/** 只读命令：期望 exit 0 且 code == 0。 */
function expectOk(args, opts) {
  const r = run(args, opts);
  assert.equal(r.code, 0, `exit=${r.code}\nstdout=${r.stdout.slice(0, 800)}\nstderr=${r.stderr.slice(0, 400)}`);
  assert.ok(r.json, `stdout 不是 JSON：${r.stdout.slice(0, 300)}`);
  assert.equal(String(r.json.code ?? (r.json.ok ? 0 : -1)), '0', `code=${r.json.code} msg=${r.json.msg}`);
  return r.json;
}

/** 需要外部 ID 的接口：路径与签名必须正确（不能是 107004/404），业务码允许非 0（退出码 2）。 */
function expectReachable(args) {
  const r = run(args);
  assert.ok([0, 2].includes(r.code), `exit=${r.code}\n${r.stdout.slice(0, 600)}`);
  assert.ok(r.json, `stdout 不是 JSON：${r.stdout.slice(0, 300)}`);
  if (r.code === 2) {
    const code = String(r.json.error?.code);
    assert.ok(!['107004', 'HTTP_404', 'HTTP_500', '-1'].includes(code), `接口不可达：${r.stdout.slice(0, 400)}`);
  }
  return r;
}

describe('integration: usmart-cli 只读命令', { skip: !ENABLED && 'set USMART_INTEGRATION=1 to run' }, () => {
  let firstEntrustId = null;
  let firstIpoId = null;
  let firstApplyId = null;

  // 前置体检：配置/登录不通时，一次说清楚原因就退出，
  // 而不是让上百条用例各自超时失败、把真正的根因埋掉。
  before(() => {
    const doc = run(['doctor']);
    assert.equal(doc.code, 0, `配置未通过体检，先修配置再跑集成测试：\n${doc.stdout}`);

    const login = run(['auth', 'login']);
    if (login.code !== 0) {
      const err = login.json?.error || {};
      const pub = doc.json?.checks?.find((c) => c.item.includes('验签公钥'))?.detail;
      assert.fail(
        `账号无法登录，集成测试无法进行。\n` +
        `  错误码: ${err.code}\n` +
        `  信息  : ${err.message}\n` +
        `  建议  : ${err.hint || '检查配置'}\n` +
        (err.code === '107012' && pub
          ? `  当前私钥对应的验签公钥（需与 uSMART 登记的一致）：\n    ${pub}\n`
          : '')
      );
    }
  });

  describe('doctor / auth', () => {
    it('doctor --online', () => { const j = expectOk(['doctor', '--online']); assert.ok(j.checks.find((c) => c.item === '联网登录')?.ok); });
    it('auth status', () => { const j = expectOk(['auth', 'status']); assert.equal(typeof j.loggedIn, 'boolean'); });
    it('auth login', () => { const j = expectOk(['auth', 'login']); assert.equal(j.loggedIn, true); assert.match(j.token, /\*\*\*\*/); });
    it('auth trade-status', () => { const j = expectOk(['auth', 'trade-status']); assert.ok([0, 1].includes(Number(j.data.status))); });
    it('auth profiles', () => { const j = expectOk(['auth', 'profiles']); assert.ok(j.profiles.some((p) => p.name === 'default')); });
    it('auth unlock（交易解锁本身是只读动作）', () => { const j = expectOk(['auth', 'unlock']); assert.equal(j.tradeUnlocked, true); });
  });

  describe('account', () => {
    it('asset', () => { const j = expectOk(['account', 'asset']); assert.ok(Array.isArray(j.data.assetSingleInfoRespVOS)); });
    it('asset --money-type 1', () => expectOk(['account', 'asset', '--money-type', '1']));
    it('holding', () => { const j = expectOk(['account', 'holding']); assert.ok(Array.isArray(j.data)); });
    it('holding --exchange-type 5', () => expectOk(['account', 'holding', '--exchange-type', '5']));
    it('type', () => { const j = expectOk(['account', 'type', '--market-type', '5']); assert.ok('assetProp' in j.data); });
    it('margin-rate（自动取资金账号）', () => { const j = expectOk(['account', 'margin-rate']); assert.ok('usdRateValue' in j.data); });
    it('margin-detail', () => { const j = expectOk(['account', 'margin-detail', '--exchange-type', '5']); assert.ok('asset' in j.data); });
    it('mortgage-list', () => { const j = expectOk(['account', 'mortgage-list', '--exchange-type', '0', '--page-size', '5']); assert.ok(Array.isArray(j.data.list)); assert.ok(j.data.total > 0); });
    it('mortgage-list --stock-code 00700', () => { const j = expectOk(['account', 'mortgage-list', '--exchange-type', '0', '--stock-code', '00700']); assert.ok(Array.isArray(j.data.list)); });
    it('flow', () => { const j = expectOk(['account', 'flow', '--page-size', '5']); assert.ok(Array.isArray(j.data.list)); });
    it('flow --date-type 9 自定义', () => expectOk(['account', 'flow', '--date-type', '9', '--start-time', '2026-01-01', '--end-time', '2026-08-25', '--page-size', '5']));
    it('flow --type 0', () => expectOk(['account', 'flow', '--type', '0', '--page-size', '5']));
    it('exchange-rate', () => { const j = expectOk(['account', 'exchange-rate']); assert.ok(Array.isArray(j.data) && j.data.length > 0); assert.ok('yxBuyRate' in j.data[0]); });
    it('check-trade-password（配置里的密码）', () => expectOk(['account', 'check-trade-password']));
  });

  describe('order（只读部分）', () => {
    it('max-quantity', () => { const j = expectOk(['order', 'max-quantity', '--stock-code', 'AAPL', '--exchange-type', '5', '--price', '150']); assert.ok('buyEnableAmount' in j.data); });
    it('max-quantity 港股 竞价单', () => expectOk(['order', 'max-quantity', '--stock-code', '00700', '--exchange-type', '0', '--entrust-prop', 'd']));
    it('margin-quantity', () => expectReachable(['order', 'margin-quantity', '--stock-code', 'AAPL', '--exchange-type', '5', '--amount', '1', '--price', '150']));
    it('today', () => { const j = expectOk(['order', 'today', '--page-size', '5']); assert.ok(Array.isArray(j.data.list)); });
    it('today --exchange-type 5', () => expectOk(['order', 'today', '--exchange-type', '5']));
    it('history', () => {
      const j = expectOk(['order', 'history', '--exchange-type', '5', '--date-flag', '7', '--page-size', '5']);
      assert.ok(Array.isArray(j.data.list));
      firstEntrustId = j.data.list[0]?.entrustId ?? null;
      if (firstEntrustId) assert.match(String(firstEntrustId), /^\d+$/);
    });
    it('history --date-flag 6 自选时间', () => expectOk(['order', 'history', '--exchange-type', '5', '--date-flag', '6', '--begin-date', '2026-01-01', '--end-date', '2026-08-25', '--page-size', '5']));
    it('fills', () => {
      const j = expectOk(['order', 'fills', '--exchange-type', '5', '--page-size', '5']);
      assert.ok(Array.isArray(j.data.list));
      // int64 精度：id 必须以字符串保留
      if (j.data.list[0]) assert.equal(typeof j.data.list[0].entrustId, 'string');
    });
    it('fills 时间过滤', () => expectOk(['order', 'fills', '--exchange-type', '5', '--begin-time', '2026-01-01', '--end-time', '2026-08-25', '--page-size', '5']));
    it('detail --entrust-id（明细库只保留近期订单，历史单返回 409933 属正常）', () => {
      if (!firstEntrustId) return;
      expectReachable(['order', 'detail', '--entrust-id', String(firstEntrustId)]);
    });
    it('detail 参数非法时返回 409985 而非崩溃', () => {
      const r = run(['order', 'detail', '--entrust-id', 'not-a-number']);
      assert.equal(r.code, 2);
      assert.equal(r.json.error.code, '409985');
    });
    it('modified-range（已撤单订单：允许业务码非 0）', () => {
      if (!firstEntrustId) return;
      expectReachable(['order', 'modified-range', '--entrust-id', String(firstEntrustId), '--new-price', '100']);
    });
  });

  /**
 * 行情网关可能对整个渠道拒绝 REST 访问（HTTP 403，openresty，无业务码）。
 * 这种情况下跳过并说明原因；**其他任何失败都照常报错**，避免把「网关拒绝」
 * 和「代码写坏了」混为一谈。
 */
function quoteGatewayState() {
  if (process.env.USMART_SKIP_QUOTE) return { ok: false, reason: '显式设置了 USMART_SKIP_QUOTE' };
  const r = run(['quote', 'market-state', '--market', 'hk']);
  if (r.code === 0) return { ok: true };
  const code = r.json?.error?.code;
  if (code === 'HTTP_403') {
    return { ok: false, reason: '行情网关对本渠道返回 HTTP 403（token 有效但无 REST 行情权限）——非代码问题，需联系 uSMART；WebSocket 推送用例仍会运行' };
  }
  if (code === 'HTTP_401') {
    return { ok: false, reason: '行情网关返回 HTTP 401：token 无效，请先 usmart auth logout && usmart auth login' };
  }
  return { ok: true }; // 其他失败让用例自己暴露出来
}

const QUOTE = quoteGatewayState();

describe('quote (REST)', { skip: QUOTE.ok ? false : QUOTE.reason }, () => {
    it('realtime 多只', () => { const j = expectOk(['quote', 'realtime', '--secu-ids', 'usAAPL,hk00700']); assert.equal(j.data.list.length, 2); });
    it('market-state hk/us/sh/sz', () => { for (const m of ['hk', 'us', 'sh', 'sz']) { const j = expectOk(['quote', 'market-state', '--market', m]); assert.equal(j.data.market, m); } });
    it('kline 日K', () => { const j = expectOk(['quote', 'kline', '--secu-id', 'usAAPL', '--type', '7', '--count', '5']); assert.ok(j.data.list.length > 0); });
    it('kline 5分钟 前复权', () => expectOk(['quote', 'kline', '--secu-id', 'hk00700', '--type', '2', '--count', '5', '--right', '1']));
    it('timeline', () => { const j = expectOk(['quote', 'timeline', '--secu-id', 'usAAPL']); assert.ok(Array.isArray(j.data.list)); });
    it('timeline 五日', () => expectOk(['quote', 'timeline', '--secu-id', 'hk00700', '--type', '1']));
    it('tick', () => { const j = expectOk(['quote', 'tick', '--secu-id', 'usAAPL', '--count', '5']); assert.ok(Array.isArray(j.data.list)); });
    it('order-book', () => { const j = expectOk(['quote', 'order-book', '--secu-id', 'hk00700']); assert.ok(j.data); });
    it('basicinfo（低频 20/min，仅调一次）', () => { const j = expectOk(['quote', 'basicinfo', '--market', 'hk']); assert.ok(j.data.list.length > 100); assert.ok('lotSize' in j.data.list[0]); });
  });

  /**
   * 降级路径：REST 被网关 403 拒绝时，realtime / order-book 改走 WebSocket 取快照。
   * 这一组**始终运行** —— REST 通时验证走 REST，REST 被拒时验证降级确实生效，
   * 两种情况下用户敲的命令都必须能拿到数据。
   */
  describe('quote (realtime / order-book 端到端 —— REST 或 WebSocket 降级)', () => {
    /** 命令要么拿到行情，要么因非交易时段无推送而明确报 push_no_data；两者都算正确。 */
    function expectQuoteOrNoData(args, check) {
      const r = run(args, { timeout: 60_000 });
      if (r.code === 0) {
        assert.ok(r.json, r.stdout.slice(0, 200));
        assert.equal(String(r.json.code), '0');
        if (!QUOTE.ok) {
          assert.equal(r.json._via, 'websocket', 'REST 不可用时应标明数据来自降级');
          assert.match(r.json._note, /403/);
        }
        check(r.json);
        return 'got-data';
      }
      // 非交易时段/停牌：推送没有数据，必须给出明确原因而不是空结果
      assert.equal(r.code, 2, r.stdout.slice(0, 300));
      assert.equal(r.json.error.type, 'push_no_data');
      assert.match(r.json.error.hint, /行情变动|非交易时段/);
      assert.ok(Array.isArray(r.json.error.details.topics));
      return 'no-data';
    }

    it('realtime 单只：拿到报价，或明确报无推送', () => {
      const how = expectQuoteOrNoData(['quote', 'realtime', '--secu-ids', 'hk00700', '--ws-timeout', '15s'], (j) => {
        const q = j.data.list[0];
        assert.equal(q.symbol, '00700');
        assert.equal(typeof q.latestPrice, 'number');
      });
      process.stderr.write(`      (realtime hk00700 → ${how})\n`);
    });

    it('realtime 多只：每只各自取到快照', () => {
      expectQuoteOrNoData(['quote', 'realtime', '--secu-ids', 'hk00700,hk09988', '--ws-timeout', '15s'], (j) => {
        assert.ok(j.data.list.length >= 1);
        for (const q of j.data.list) assert.ok(q.symbol && typeof q.latestPrice === 'number');
      });
    });

    it('order-book：拿到买卖档位，或明确报无推送', () => {
      expectQuoteOrNoData(['quote', 'order-book', '--secu-id', 'hk00700', '--ws-timeout', '15s'], (j) => {
        const lv = (j.data.data || j.data.list || [])[0];
        assert.ok(lv, JSON.stringify(j.data).slice(0, 200));
        assert.equal(typeof lv.bidPrice, 'number');
        assert.equal(typeof lv.askPrice, 'number');
      });
    });

    it('--no-ws-fallback 时不降级，REST 是什么就报什么', { skip: QUOTE.ok ? 'REST 正常，无需验证降级开关' : false }, () => {
      const r = run(['quote', 'realtime', '--secu-ids', 'hk00700', '--no-ws-fallback']);
      assert.equal(r.code, 2);
      assert.equal(r.json.error.code, 'HTTP_403');
    });

    it('无法降级的接口（kline/timeline/tick/marketstate/basicinfo）不会伪造数据', { skip: QUOTE.ok ? 'REST 正常' : false }, () => {
      for (const args of [
        ['quote', 'kline', '--secu-id', 'hk00700', '--count', '2'],
        ['quote', 'timeline', '--secu-id', 'hk00700'],
        ['quote', 'tick', '--secu-id', 'hk00700', '--count', '2'],
        ['quote', 'market-state', '--market', 'hk'],
        ['quote', 'basicinfo', '--market', 'hk'],
      ]) {
        const r = run(args);
        assert.equal(r.code, 2, `${args.join(' ')} 应如实报错`);
        assert.equal(r.json.error.code, 'HTTP_403');
        assert.ok(!r.json._via, '这些接口不应声称走了降级');
      }
    });

    it('secuId 格式非法在本地就被拦下', () => {
      const r = run(['quote', 'realtime', '--secu-ids', 'AAPL']);
      assert.ok([2, 3].includes(r.code));
      if (r.code === 3) assert.match(r.json.error.hint, /hk\|us\|sh\|sz/);
    });
  });

  describe('quote (WebSocket 推送 —— 不受 REST 403 影响，始终运行)', () => {
    it('subscribe：WebSocket 鉴权 + 订阅 + 收数据 + 退出', () => {
      const r = run(['quote', 'subscribe', '--topics', 'rt.hk.00700,ob.hk.00700,rt.us.AAPL', '--duration', '10s'], { timeout: 60_000 });
      assert.equal(r.code, 0, `exit=${r.code} stderr=${r.stderr}`);
      assert.match(r.stderr, /"event":"auth","ok":true/);
      assert.match(r.stderr, /"event":"sub","ok":true/);
      assert.match(r.stderr, /订阅结束/);
      // 每行都必须是可解析的 NDJSON，且 topic 在订阅列表内
      const subscribed = new Set(['rt.hk.00700', 'ob.hk.00700', 'rt.us.AAPL']);
      for (const line of r.stdout.trim().split('\n').filter(Boolean)) {
        const m = JSON.parse(line);
        assert.ok(subscribed.has(m.topic), `未订阅的 topic：${m.topic}`);
        assert.ok(m.data && typeof m.data === 'object', line.slice(0, 200));
        assert.ok(m.receivedAt);
      }
      // 收市时段可能一条都没有，只在有数据时校验字段形状
      const rt = r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.topic.startsWith('rt.'));
      if (rt) assert.ok(typeof rt.data.latestPrice === 'number', JSON.stringify(rt.data).slice(0, 200));
    });
    it('subscribe 拒绝非法 topic', () => {
      const r = run(['quote', 'subscribe', '--topics', 'bad.topic']);
      assert.equal(r.code, 3);
      assert.match(r.json.error.hint, /rt\|tk\|ob/);
    });
    it('subscribe 超过 10 个 topic 本地就拦下', () => {
      const many = Array.from({ length: 11 }, (_, i) => `rt.hk.0000${i}`).join(',');
      const r = run(['quote', 'subscribe', '--topics', many]);
      assert.equal(r.code, 3);
      assert.match(r.json.error.message, /最多订阅 10 个/);
    });
    it('subscribe --dry-run', () => { const j = expectOk(['quote', 'subscribe', '--topics', 'rt.hk.00700', '--dry-run']); assert.equal(j.request.method, 'WS'); });
  });

  describe('ipo', () => {
    it('list 认购中', () => { const j = expectOk(['ipo', 'list', '--status', '0', '--page-size', '5']); assert.ok(Array.isArray(j.data.list)); firstIpoId = j.data.list[0]?.ipoId ?? null; });
    it('list 待上市', () => expectOk(['ipo', 'list', '--status', '1', '--page-size', '5']));
    it('info --ipo-id', () => { if (!firstIpoId) return; const j = expectOk(['ipo', 'info', '--ipo-id', String(firstIpoId)]); assert.ok(j.data); });
    it('info --stock-code', () => expectReachable(['ipo', 'info', '--stock-code', '00700', '--exchange-type', '0']));
    it('records', () => { const j = expectOk(['ipo', 'records', '--page-size', '5']); assert.ok(Array.isArray(j.data.list)); firstApplyId = j.data.list[0]?.applyId ?? null; });
    it('record --apply-id', () => { if (!firstApplyId) return; expectOk(['ipo', 'record', '--apply-id', String(firstApplyId)]); });
  });

  describe('option / ma（只读部分，可达性）', () => {
    it('option list', () => { const j = expectOk(['option', 'list']); assert.ok(Array.isArray(j.data.list)); });
    it('option purchase-power', () => expectReachable(['option', 'purchase-power', '--symbol', 'AAPL260918C00300000', '--side', '1', '--qty', '1', '--price', '1']));
    it('option replace-status', () => expectReachable(['option', 'replace-status', '--order-id', '1']));
    it('option detail', () => expectReachable(['option', 'detail', '--order-id', '1']));
    it('option replace-power', () => expectReachable(['option', 'replace-power', '--order-id', '1', '--price', '1']));
    it('ma list', () => expectReachable(['ma', 'list', '--strategy-id', '1']));
    it('ma detail', () => expectReachable(['ma', 'detail', '--ma-order-id', '1']));
    it('ma purchase-power', () => expectReachable(['ma', 'purchase-power', '--strategy-id', '1', '--stock-id', 'AAPL', '--op-type', '0', '--price', '100', '--amount', '1']));
  });

  describe('api / dict / 输出格式 / 兼容别名', () => {
    it('api POST get-trade-status', () => expectOk(['api', 'POST', '/user-server/open-api/get-trade-status']));
    it('api --quote（走行情 host）', { skip: QUOTE.ok ? false : QUOTE.reason }, () => expectOk(['api', 'POST', '/quotes-openservice/api/v1/marketstate', '--quote', '--data', '{"market":"hk"}']));
    it('api 404 → exit 2 + HTTP_404', () => { const r = run(['api', 'POST', '/no/such/path']); assert.equal(r.code, 2); assert.equal(r.json.error.code, 'HTTP_404'); assert.equal(r.json.error.http_status, 404); });
    it('api 业务错误 → exit 2 + 业务码 + hint', () => { const r = run(['api', 'POST', '/stock-order-server/open-api/modified-range', '--data', '{"entrustId":1,"newPrice":1}']); assert.equal(r.code, 2); assert.equal(r.json.error.code, '409933'); assert.ok(r.json.error.hint); });
    it('legacy: usmart usmart holding（带弃用提示）', () => { const r = run(['usmart', 'holding']); assert.equal(r.code, 0); assert.match(r.stderr, /已弃用/); assert.equal(String(r.json.code), '0'); });
    it('legacy: usmart usmart api', () => { const r = run(['usmart', 'api', 'POST', '/user-server/open-api/get-trade-status']); assert.equal(r.code, 0); });
    it('legacy: 1.x 的 --data 整体请求体用法仍可用（place-order --data @file）', () => {
      const f = path.join(os.tmpdir(), 'usmart-order-test.json');
      fs.writeFileSync(f, JSON.stringify({ stockCode: '00700', exchangeType: 0, entrustType: 0, entrustProp: 'e', entrustPrice: 330.4, entrustAmount: 100 }));
      const r = run(['usmart', 'place-order', '--data', `@${f}`, '--dry-run']);
      assert.equal(r.code, 0, r.stdout);
      assert.equal(r.json.request.body.stockCode, '00700');
      assert.match(r.stderr, /跳过必填校验/);
      fs.rmSync(f, { force: true });
    });
    it('legacy: usmart usmart rate-info（修复后可用）', () => { const r = run(['usmart', 'rate-info']); assert.equal(r.code, 0); assert.ok('usdRateValue' in r.json.data); });
    it('--format table', () => { const r = run(['--format', 'table', 'account', 'holding']); assert.equal(r.code, 0); assert.match(r.stdout, /stockCode/); });
    it('--format csv', () => { const r = run(['--format', 'csv', 'account', 'exchange-rate']); assert.equal(r.code, 0); assert.match(r.stdout.split('\n')[0], /yxBuyRate/); });
    it('--format pretty', () => { const r = run(['--format', 'pretty', 'auth', 'trade-status']); assert.equal(r.code, 0); assert.match(r.stdout, /status: [01]/); });
    it('--jq 单值', () => { const r = run(['--jq', '.data.status', 'auth', 'trade-status']); assert.equal(r.code, 0); assert.match(r.stdout.trim(), /^[01]$/); });
    it('--jq 多值 → NDJSON 逐行', () => {
      // holding 的 data 本身就是数组
      const r = run(['--jq', '.data[].stockCode', 'account', 'holding']);
      assert.equal(r.code, 0, r.stdout);
      const lines = r.stdout.trim().split('\n').filter(Boolean);
      assert.ok(lines.length >= 1);
      for (const l of lines) assert.doesNotMatch(l, /^\[|\]$/, `应逐行输出而不是数组：${l}`);
    });
    it('--jq 表达式错误 → exit 3', () => {
      const r = run(['--jq', '.data.list[].nope', 'account', 'holding']);
      assert.equal(r.code, 3);
      assert.equal(r.json.error.type, 'jq_error');
    });
    it('dict list / get', () => {
      expectOk(['dict', 'list']);
      const r = run(['dict', 'get', 'exchange-type', '5']);
      assert.equal(r.code, 0);
      assert.equal(r.json.name, '美股');
      assert.equal(r.json.code, '5');
    });
  });

  describe('写操作只做门禁与 dry-run，绝不发送', () => {
    const writes = [
      ['order', 'place', '--stock-code', 'AAPL', '--exchange-type', '5', '--side', 'buy', '--entrust-prop', '0', '--price', '1', '--amount', '1'],
      ['order', 'modify', '--entrust-id', '1', '--price', '1', '--amount', '1'],
      ['order', 'cancel', '--entrust-id', '1'],
      ['order', 'odd-place', '--stock-code', '00700', '--price', '1', '--amount', '1'],
      ['order', 'odd-cancel', '--odd-id', '1'],
      ['ipo', 'apply', '--ipo-id', '1', '--apply-type', '1', '--quantity', '100'],
      ['ipo', 'modify', '--apply-id', '1', '--quantity', '100'],
      ['ipo', 'cancel', '--apply-id', '1'],
      ['ipo', 'confirm-qty', '--apply-id', '1', '--cash-flag', '0'],
      ['ma', 'place', '--strategy-id', '1', '--stock-id', 'AAPL', '--trade-type', '1', '--op-type', '0', '--order-type', '1', '--quantity', '1', '--price', '1'],
      ['ma', 'cancel', '--ma-order-id', '1'],
      ['option', 'place', '--symbol', 'X', '--side', '1', '--qty', '1', '--order-type', '2', '--price', '1'],
      ['option', 'replace', '--order-id', '1', '--qty', '1', '--price', '1'],
      ['option', 'cancel', '--order-id', '1'],
      ['account', 'cashout-revoke', '--id', '1'],
      ['account', 'set-trade-password', '--password', '123456'],
      ['account', 'update-trade-password', '--old-password', '111111', '--password', '222222'],
      ['account', 'reset-trade-password', '--password', '222222', '--captcha', '0000'],
      ['account', 'update-login-password', '--old-password', 'a', '--password', 'b'],
      ['account', 'reset-login-password', '--password', 'b', '--captcha', '0000'],
    ];
    for (const args of writes) {
      it(`${args.slice(0, 2).join(' ')}：无 --yes → exit 10`, () => { const r = run(args); assert.equal(r.code, 10, r.stdout); assert.equal(r.json.error.type, 'confirmation_required'); });
      it(`${args.slice(0, 2).join(' ')}：--dry-run → 只预览`, () => { const j = expectOk([...args, '--dry-run']); assert.equal(j.dryRun, true); assert.match(j.request.url, /^https:\/\//); });
    }
    it('ma place：价格 ×10000', () => { const j = expectOk(['ma', 'place', '--strategy-id', '1', '--stock-id', 'AAPL', '--trade-type', '1', '--op-type', '0', '--order-type', '1', '--quantity', '1', '--price', '12.34', '--dry-run']); assert.equal(j.request.body.sellPrice, 123400); });
  });

  describe('错误路径', () => {
    it('缺少必填参数 → exit 3', () => { const r = run(['order', 'detail']); assert.equal(r.code, 3); assert.equal(r.json.error.type, 'invalid_args'); });
    it('枚举不合法 → exit 3', () => { const r = run(['quote', 'market-state', '--market', 'jp']); assert.equal(r.code, 3); });
    it('--data 非法 JSON → exit 3', () => { const r = run(['api', 'POST', '/x', '--data', 'not-json']); assert.equal(r.code, 3); assert.equal(r.json.error.type, 'invalid_json'); });
    it('配置缺失 → exit 1 + hint', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-empty-'));
      const r = run(['account', 'asset'], { env: { USMART_CONFIG_DIR: dir } });
      assert.equal(r.code, 1); assert.equal(r.json.error.type, 'config_missing'); assert.match(r.json.error.hint, /config-init/);
      assert.doesNotMatch(r.stdout + r.stderr, /at .*\.js:\d+/, '不应泄漏堆栈');
    });
    it('--profile 不存在 → exit 1 且提示带 profile', () => { const r = run(['--profile', 'nope', 'account', 'asset']); assert.equal(r.code, 1); assert.match(r.json.error.hint, /--profile nope/); });
  });
});
