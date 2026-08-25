import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonSafe } from '../src/lib/json-safe.js';

describe('json-safe', () => {
  it('超过 2^53 的整数保留为字符串', () => {
    const j = parseJsonSafe('{"id":2087690029453040611,"entrustId": 2087702639189356509 ,"list":[2087713040170029001,1]}');
    assert.equal(j.id, '2087690029453040611');
    assert.equal(j.entrustId, '2087702639189356509');
    assert.equal(j.list[0], '2087713040170029001');
    assert.equal(j.list[1], 1);
  });
  it('普通数字 / 小数 / 已是字符串的不受影响', () => {
    const j = parseJsonSafe('{"a":123,"b":1.5,"c":"2087690029453040611","d":-42,"e":1756090000000}');
    assert.equal(j.a, 123); assert.equal(j.b, 1.5); assert.equal(j.c, '2087690029453040611'); assert.equal(j.d, -42); assert.equal(j.e, 1756090000000);
  });
  it('负的大整数也保留', () => {
    assert.equal(parseJsonSafe('{"a":-9223372036854775807}').a, '-9223372036854775807');
  });
});
