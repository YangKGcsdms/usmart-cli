import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextRequestId, nextSerialNo, nextOptionRequestId } from '../src/lib/request-id.js';

describe('request-id', () => {
  it('X-Request-Id 为 19 位数字且唯一', () => {
    const ids = new Set();
    for (let i = 0; i < 5000; i++) {
      const id = nextRequestId();
      assert.match(id, /^\d{19}$/);
      ids.add(id);
    }
    assert.equal(ids.size, 5000);
  });
  it('serialNo 可安全放进 int64', () => {
    const n = BigInt(nextSerialNo());
    assert.ok(n > 0n && n < 9223372036854775807n);
  });
  it('期权 requestId 长度在 10~36 之间', () => {
    const id = nextOptionRequestId();
    assert.ok(id.length >= 10 && id.length <= 36);
  });
});
