import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DICTS, listDicts, getDict, lookup } from '../src/lib/dict.js';

describe('dict', () => {
  it('包含官方 §5 全部 7 张表 + 行情/推送字典', () => {
    for (const n of ['order-status', 'exchange-type', 'ipo-status', 'ipo-apply-status', 'money-type', 'device-type', 'asset-prop', 'kline-type', 'market-status', 'push-topic-type']) assert.ok(DICTS[n], n);
  });
  it('币种字典与官方一致：0=CNY 1=USD 2=HKD', () => {
    assert.match(lookup('money-type', 1).name, /USD/); assert.match(lookup('money-type', 2).name, /HKD/);
  });
  it('list / get / lookup', () => {
    assert.ok(listDicts().length > 20);
    assert.equal(getDict('nope'), null);
    assert.equal(lookup('exchange-type', 5).name, '美股');
    assert.equal(lookup('exchange-type', 99), null);
  });
});
