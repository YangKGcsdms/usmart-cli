/**
 * 行情接口契约测试（离线，不联网）。
 *
 * 存在的理由：行情网关会因突发把客户端 HTTP 403 封禁一段时间（官方文档未描述该行为），
 * 集成测试因此可能跑不了。本文件用官方文档《基础行情开放API》里逐字抄下来的
 * 请求/响应示例做两件事：
 *   1. 断言 CLI 用 --dry-run 构造出的请求体字段与官方示例一致（少发/错发字段会被抓到）；
 *   2. 断言官方响应形状能被解析层与输出层正确处理。
 * 它不能替代真实调用，但能覆盖「请求构造」和「响应解析」这两处最容易出错的地方。
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parseJsonSafe } from '../src/lib/json-safe.js';
import { rowsOf, toTable, toCsv, simplePath } from '../src/lib/output.js';
import { describeCode } from '../src/lib/errors.js';
import { bucketForQuotePath } from '../src/lib/rate-limit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'usmart');
const DOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/quote-doc-examples.json'), 'utf-8'));

let tmpDir;

/** 造一份语法合法的假配置，让 --dry-run 能跑起来（dry-run 不发任何网络请求）。 */
before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-contract-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(path.join(tmpDir, 'usmart.json'), JSON.stringify({
    account: {
      lang: '1', channel: '100082', areaCode: '86', phoneNumber: '13800138000',
      loginPassword: 'pw', tradePassword: '123456',
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    },
    env: { tradeHost: 'https://open-jy.yxzq.com', quoteHost: 'https://open-hz.yxzq.com:8443' },
  }, null, 2), { mode: 0o600 });
});

after(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

function dryRun(args) {
  const r = spawnSync('node', [BIN, ...args, '--dry-run'], {
    encoding: 'utf-8',
    env: { ...process.env, USMART_CONFIG_DIR: tmpDir, USMART_NO_RATE_LIMIT: '1' },
  });
  assert.equal(r.status, 0, `exit=${r.status}\n${r.stdout}\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

describe('行情接口契约：请求构造对齐官方示例', () => {
  const cases = [
    ['marketstate', ['quote', 'market-state', '--market', 'sh'], '/quotes-openservice/api/v1/marketstate'],
    ['basicinfo', ['quote', 'basicinfo', '--market', 'hk'], '/quotes-openservice/api/v1/basicinfo'],
    ['realtime', ['quote', 'realtime', '--secu-ids', 'hk00700'], '/quotes-openservice/api/v1/realtime'],
    ['timeline', ['quote', 'timeline', '--secu-id', 'hk02208', '--type', '0'], '/quotes-openservice/api/v1/timeline'],
    ['kline', ['quote', 'kline', '--secu-id', 'sh600001', '--type', '7', '--start', '0', '--count', '0', '--right', '0'], '/quotes-openservice/api/v1/kline'],
    ['tick', ['quote', 'tick', '--secu-id', 'sh600001', '--trade-time', '0', '--seq', '0', '--count', '0', '--sort', '0'], '/quotes-openservice/api/v1/tick'],
    ['orderbook', ['quote', 'order-book', '--secu-id', 'hk00001'], '/quotes-openservice/api/v1/orderbook'],
  ];

  for (const [name, args, expectPath] of cases) {
    it(`${name}：URL 与请求体字段与官方示例一致`, () => {
      const out = dryRun(args);
      const { url, body, method } = out.request;
      assert.equal(method, 'POST');
      assert.equal(url, 'https://open-hz.yxzq.com:8443' + expectPath);

      const expected = DOC[name].request;
      for (const [k, v] of Object.entries(expected)) {
        assert.deepEqual(body[k], v, `${name} 的字段 ${k} 与官方示例不符：期望 ${JSON.stringify(v)}，实际 ${JSON.stringify(body[k])}`);
      }
      // 不能多发官方示例之外的字段（tick 的 seq 是文档参数表要求的，见下）
      const allowExtra = name === 'tick' ? new Set(['seq']) : new Set();
      for (const k of Object.keys(body)) {
        assert.ok(k in expected || allowExtra.has(k), `${name} 多发了字段 ${k}`);
      }
    });
  }

  it('tick 同时发送 seq 与 start（文档参数表写 seq、请求示例写 start，两者取值必须一致）', () => {
    const out = dryRun(['quote', 'tick', '--secu-id', 'hk00700', '--seq', '12345', '--trade-time', '999']);
    assert.equal(out.request.body.seq, 12345);
    assert.equal(out.request.body.start, 12345);
    assert.equal(out.request.body.tradeTime, 999);
  });

  it('行情请求头包含官方签名所需的全部字段', () => {
    const h = dryRun(['quote', 'market-state', '--market', 'hk']).request.headers;
    for (const k of ['Content-Type', 'X-Lang', 'X-Channel', 'X-Request-Id', 'X-Time', 'X-Sign', 'Authorization']) {
      assert.ok(h[k], `缺少请求头 ${k}`);
    }
    assert.match(h['X-Request-Id'], /^\d{19}$/, 'X-Request-Id 必须是 19 位数字');
    assert.match(h['X-Time'], /^\d{10}$/);
    assert.match(h['X-Sign'], /…$/, 'dry-run 输出里签名应脱敏');
    assert.match(h.Authorization, /\*{4}|dry-run/, 'dry-run 输出里 token 应脱敏');
  });

  it('basicinfo 走低频限流桶（20/min），其余走高频桶（120/min）', () => {
    assert.equal(bucketForQuotePath('/quotes-openservice/api/v1/basicinfo'), 'quote-low');
    for (const p of ['marketstate', 'realtime', 'timeline', 'kline', 'tick', 'orderbook']) {
      assert.equal(bucketForQuotePath(`/quotes-openservice/api/v1/${p}`), 'quote-high');
    }
  });

  it('非法 secuId / market 在本地就被拦下，不浪费限流额度', () => {
    const r = spawnSync('node', [BIN, 'quote', 'market-state', '--market', 'jp'], {
      encoding: 'utf-8', env: { ...process.env, USMART_CONFIG_DIR: tmpDir },
    });
    assert.equal(r.status, 3);
    assert.equal(JSON.parse(r.stdout).error.type, 'invalid_args');
  });
});

describe('行情接口契约：官方响应形状能被正确解析', () => {
  it('marketstate：字典可解释 status 与 tradingDayType', () => {
    const d = DOC.marketstate.response.data;
    assert.equal(d.status, 7);
    assert.equal(simplePath(DOC.marketstate.response, '.data.desc'), '已收盘');
  });

  it('realtime：可取出报价字段，table/csv 输出成行', () => {
    const resp = DOC.realtime.response;
    const rows = rowsOf(resp);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].latestPrice, 376.8);
    assert.match(toTable(rows).split('\n')[0], /latestPrice/);
    assert.match(toCsv(rows).split('\n')[0], /latestPrice/);
    assert.equal(simplePath(resp, '.data.list[0].symbol'), '00700');
  });

  it('basicinfo：多条记录逐行取值', () => {
    const out = simplePath(DOC.basicinfo.response, '.data.list[].symbol');
    assert.deepEqual(out.values, ['21922', '29260']);
    assert.equal(rowsOf(DOC.basicinfo.response).length, 2);
  });

  it('kline / timeline：数值字段保持数字类型', () => {
    const k = rowsOf(DOC.kline.response)[0];
    assert.equal(typeof k.close, 'number');
    assert.equal(k.volume, 41413014);
    const t = rowsOf(DOC.timeline.response)[0];
    assert.equal(t.pctchng, 0.0012);
  });

  it('tick / orderbook：list 被正确识别为表格行', () => {
    assert.equal(rowsOf(DOC.tick.response)[0].seq, 1202);
    const ob = rowsOf(DOC.orderbook.response)[0];
    assert.equal(ob.bidPrice, 9.31);
    assert.equal(ob.askOrderCount, 3);
  });

  it('latestTime（17 位，超过 2^53）保留为字符串且无损', () => {
    // 20191224120822000 > Number.MAX_SAFE_INTEGER，交给 JSON.parse 会有精度风险，
    // 故与 entrustId 一样保留成字符串；定宽 yyyyMMddHHmmssSSS 仍可按字典序比较。
    const parsed = parseJsonSafe(JSON.stringify(DOC.realtime.response));
    const t = parsed.data.list[0].latestTime;
    assert.equal(typeof t, 'string');
    assert.equal(t, '20191224120822000');
  });

  it('REST 与 WebSocket 两条链路对同一字段的类型一致', async () => {
    const { _decodeForTest } = await import('../src/lib/push.js');
    const payload = JSON.stringify({ latestTime: 20191224120822000, seq: 1202, price: 74.65 });
    const viaWs = _decodeForTest(Buffer.from(payload).toString('base64'));
    const viaRest = parseJsonSafe(payload);
    assert.equal(typeof viaWs.latestTime, typeof viaRest.latestTime);
    assert.equal(viaWs.latestTime, viaRest.latestTime);
    assert.equal(typeof viaWs.seq, 'number');   // 小整数不受影响
    assert.equal(viaWs.price, 74.65);           // 小数不受影响
  });

  it('官方行情错误码都能给出可读说明与 hint', () => {
    for (const code of ['806000', '806100', '806109', '806110', '806111']) {
      const d = describeCode(code);
      assert.ok(d, `缺少错误码 ${code}`);
      assert.ok(d.msg.length > 0);
    }
    assert.match(describeCode('806111').hint, /secuId|市场/);
  });
});
