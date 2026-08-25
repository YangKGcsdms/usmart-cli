/**
 * 交易类接口契约测试（离线，不发任何真实请求）。
 *
 * 交易功能按约定不做集成测试，所以这层是它唯一的「对着官方文档核对」的防线：
 * 用《账户交易开放API》里的请求示例，逐字段断言 CLI 用 --dry-run 构造出的请求体。
 * 重点锁住那些搞反了会造成真实损失的语义。
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'usmart');
const DOC = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/trade-doc-examples.json'), 'utf-8'));

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'usmart-trade-contract-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(path.join(tmpDir, 'usmart.json'), JSON.stringify({
    account: {
      lang: '1', channel: '100082', areaCode: '86', phoneNumber: '13800138000',
      loginPassword: 'pw', tradePassword: '123456',
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    },
    env: { tradeHost: 'https://open-jy.yxzq.com', quoteHost: 'https://open-hz.yxzq.com:8443' },
  }), { mode: 0o600 });
});

after(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

/** 跑 --dry-run 拿到将要发出的请求（dry-run 不发任何网络请求）。 */
function req(args) {
  const r = spawnSync('node', [BIN, ...args, '--dry-run'], {
    encoding: 'utf-8',
    env: { ...process.env, USMART_CONFIG_DIR: tmpDir, USMART_NO_RATE_LIMIT: '1' },
  });
  assert.equal(r.status, 0, `exit=${r.status}\n${r.stdout}\n${r.stderr}`);
  return JSON.parse(r.stdout).request;
}

describe('交易契约：actionType 的反向语义（搞反会造成真实损失）', () => {
  it('委托改撤单（文档 2.2）：改单 actionType=1，撤单 actionType=0', () => {
    assert.equal(DOC['2.2 modify-order'].actionType, 1, '官方示例里 1 是改单');

    const modify = req(['order', 'modify', '--entrust-id', '1181776863632019500', '--price', '322', '--amount', '500']);
    assert.equal(modify.body.actionType, 1, 'order modify 必须发 actionType=1，发成 0 会变成撤单');
    assert.equal(modify.url, 'https://open-jy.yxzq.com/stock-order-server/open-api/modify-order');

    const cancel = req(['order', 'cancel', '--entrust-id', '1181776863632019500']);
    assert.equal(cancel.body.actionType, 0, 'order cancel 必须发 actionType=0');
    assert.equal(cancel.body.entrustAmount, 0, '文档要求撤单时数量传 0');
    assert.equal(cancel.body.entrustPrice, 0, '文档要求撤单时价格传 0');
  });

  it('IPO 改撤单（文档 3.4）：语义与委托相反 —— 改单 actionType=0，撤单 actionType=1', () => {
    const modify = req(['ipo', 'modify', '--apply-id', '1182192040986583000', '--quantity', '200']);
    assert.equal(modify.body.actionType, 0, 'ipo modify 必须发 actionType=0（与 order modify 相反）');

    const cancel = req(['ipo', 'cancel', '--apply-id', '1182192040986583000']);
    assert.equal(cancel.body.actionType, 1, 'ipo cancel 必须发 actionType=1（与 order cancel 相反）');
    assert.equal(cancel.body.applyQuantity, 0);
  });

  it('碎股撤单（文档 2.5）：actionType=0 且用 oddId 而非 entrustId', () => {
    const b = req(['order', 'odd-cancel', '--odd-id', '1207553433704988700']).body;
    assert.equal(b.actionType, DOC['2.5 odd-modify'].actionType);
    assert.equal(b.oddId, '1207553433704988700');
    assert.ok(!('entrustId' in b), '碎股撤单不能发 entrustId');
  });
});

describe('交易契约：请求体字段与官方示例一致', () => {
  it('下单（2.1）：必填字段齐全，serialNo 为 19 位', () => {
    const b = req(['order', 'place', '--stock-code', '00981', '--exchange-type', '0',
      '--side', 'buy', '--entrust-prop', 'e', '--price', '11.0', '--amount', '1000', '--stock-name', '00981']).body;
    for (const k of ['serialNo', 'entrustAmount', 'entrustPrice', 'entrustProp', 'entrustType', 'exchangeType', 'stockCode']) {
      assert.ok(k in b, `下单缺少必填字段 ${k}`);
    }
    assert.match(String(b.serialNo), /^\d{19}$/, 'serialNo 必须 19 位（幂等防重）');
    assert.equal(b.entrustType, 0, 'buy → entrustType 0');
    assert.equal(req(['order', 'place', '--stock-code', 'A', '--exchange-type', '5', '--side', 'sell',
      '--entrust-prop', '0', '--price', '1', '--amount', '1']).body.entrustType, 1, 'sell → entrustType 1');
  });

  it('下单默认不带 password，--with-password 时才附加加密后的交易密码', () => {
    const plain = req(['order', 'place', '--stock-code', 'A', '--exchange-type', '5', '--side', 'buy',
      '--entrust-prop', '0', '--price', '1', '--amount', '1']).body;
    assert.ok(!('password' in plain));
    const withPw = req(['order', 'place', '--stock-code', 'A', '--exchange-type', '5', '--side', 'buy',
      '--entrust-prop', '0', '--price', '1', '--amount', '1', '--with-password']).body;
    assert.ok(withPw.password.length > 100, '应为 RSA 加密后的串');
    assert.notEqual(withPw.password, '123456', '绝不能发明文交易密码');
  });

  it('改单范围（2.3）/ 融资股数（2.12）/ 最大可买卖（2.6）字段对齐', () => {
    const range = req(['order', 'modified-range', '--entrust-id', '1181776863632019500', '--new-price', '323']).body;
    assert.deepEqual(Object.keys(range).sort(), Object.keys(DOC['2.3 modified-range']).sort());

    const mq = req(['order', 'margin-quantity', '--stock-code', 'A', '--exchange-type', '5', '--amount', '1', '--price', '1']).body;
    for (const k of ['entrustAmount', 'entrustProp', 'exchangeType', 'stockCode']) assert.ok(k in mq, `融资股数缺 ${k}`);

    const tq = req(['order', 'max-quantity', '--stock-code', '700', '--exchange-type', '0', '--entrust-prop', 'e', '--price', '234']).body;
    assert.deepEqual(tq, DOC['2.6 trade-quantity']);
  });

  it('IPO 认购（3.3）：融资认购必须带 cash，现金认购可不带', () => {
    const cash = req(['ipo', 'apply', '--ipo-id', '1133576191818039300', '--apply-type', '1', '--quantity', '100']).body;
    assert.equal(cash.applyType, 1);
    assert.match(String(cash.serialNo), /^\d{19}$/);

    const margin = req(['ipo', 'apply', '--ipo-id', '1', '--apply-type', '2', '--quantity', '1000', '--cash', '5000']).body;
    assert.equal(margin.cash, 5000);

    // 融资认购漏传 cash 必须在本地就被拦下（退出码 3），而不是发出去
    const bad = spawnSync('node', [BIN, 'ipo', 'apply', '--ipo-id', '1', '--apply-type', '2', '--quantity', '1', '--dry-run'], {
      encoding: 'utf-8', env: { ...process.env, USMART_CONFIG_DIR: tmpDir },
    });
    assert.equal(bad.status, 3);
    assert.match(JSON.parse(bad.stdout).error.message, /--cash/);
  });

  it('MA 下单（7.1）：--price 收真实价格并按官方要求 ×10000', () => {
    const b = req(['ma', 'place', '--strategy-id', '10626', '--stock-id', 'hk02202', '--trade-type', '1',
      '--op-type', '0', '--order-type', '2', '--quantity', '100', '--price', '0.1']).body;
    assert.equal(b.sellPrice, 1000, '0.1 × 10000 = 1000，与官方示例一致');
    assert.equal(b.sellQuota, 100);
    assert.equal(b.openClosePreFlag, 1);
    // 策略购买力同样换算
    const pp = req(['ma', 'purchase-power', '--strategy-id', '10626', '--stock-id', 'hk01810',
      '--op-type', '0', '--price', '53.3', '--amount', '200']).body;
    assert.equal(pp.price, 533000, '53.3 × 10000 = 533000，与官方示例一致');
  });

  it('期权下单（8.1）：价格保留小数，requestId 长度 10~36', () => {
    const b = req(['option', 'place', '--symbol', 'TSLA250808C50000', '--side', '1',
      '--qty', '1', '--order-type', '2', '--price', '2.93']).body;
    assert.equal(b.price, 2.93, '期权价格不能被取整');
    assert.equal(b.businessType, 'O');
    assert.ok(b.requestId.length >= 10 && b.requestId.length <= 36, `requestId 长度 ${b.requestId.length} 越界`);
  });

  it('资金流水（4.2）：date-type 9 需要起止时间，字段名用 startTime/endTime', () => {
    const b = req(['account', 'flow', '--date-type', '9', '--start-time', '2020-05-09', '--end-time', '2020-12-24']).body;
    assert.equal(b.dateType, 9);
    assert.ok('startTime' in b && 'endTime' in b, '官方字段是 startTime/endTime，不是 beginTime/endTime');

    const bad = spawnSync('node', [BIN, 'account', 'flow', '--date-type', '9', '--dry-run'], {
      encoding: 'utf-8', env: { ...process.env, USMART_CONFIG_DIR: tmpDir },
    });
    assert.equal(bad.status, 3, 'date-type 9 缺起止时间应本地拦下');
  });

  it('出金撤销（4.3）/ 抵押清单（6.1）/ 融资利率（1.13）路径与字段正确', () => {
    const revoke = req(['account', 'cashout-revoke', '--id', '768268401176485900']);
    assert.match(revoke.url, /\/stock-capital-server\/open-api\/app-cashOut-revoke$/);
    assert.equal(revoke.body.id, '768268401176485900');

    const mort = req(['account', 'mortgage-list', '--exchange-type', '0', '--page-num', '1', '--page-size', '10', '--status', '1', '--all']);
    assert.match(mort.url, /\/stock-order-server\/open-api\/mortgage-list$/, 'v1.x 曾误用 stock-broker-server 导致 107004');
    assert.equal(mort.body.pageSizeZero, true);
  });

  it('所有写操作的 URL 都指向交易 host，绝不会误发到行情 host', () => {
    const writes = [
      ['order', 'place', '--stock-code', 'A', '--exchange-type', '5', '--side', 'buy', '--entrust-prop', '0', '--price', '1', '--amount', '1'],
      ['order', 'cancel', '--entrust-id', '1'],
      ['ipo', 'apply', '--ipo-id', '1', '--apply-type', '1', '--quantity', '1'],
      ['ma', 'place', '--strategy-id', '1', '--stock-id', 'A', '--trade-type', '1', '--op-type', '0', '--order-type', '1', '--quantity', '1', '--price', '1'],
      ['option', 'place', '--symbol', 'X', '--side', '1', '--qty', '1', '--order-type', '2', '--price', '1'],
      ['account', 'cashout-revoke', '--id', '1'],
    ];
    for (const w of writes) {
      assert.match(req(w).url, /^https:\/\/open-jy\.yxzq\.com\//, `${w.join(' ')} 的 URL 不对`);
    }
  });

  it('dry-run 绝不泄漏明文凭据', () => {
    const r = req(['order', 'place', '--stock-code', 'A', '--exchange-type', '5', '--side', 'buy',
      '--entrust-prop', '0', '--price', '1', '--amount', '1', '--with-password']);
    const dump = JSON.stringify(r);
    assert.ok(!dump.includes('123456'), '不能出现明文交易密码');
    assert.ok(!dump.includes('13800138000'), '不能出现明文手机号');
    assert.match(r.headers['X-Sign'], /…$/, '签名应脱敏');
  });
});
