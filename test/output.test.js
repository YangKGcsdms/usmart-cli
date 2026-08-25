import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rowsOf, toTable, toCsv, toPretty, simplePath } from '../src/lib/output.js';

const resp = { code: 0, msg: 'ok', data: { list: [{ a: 1, b: 'x,y' }, { a: 2, b: '中文' }] } };

describe('output', () => {
  it('rowsOf 取 data.list / data 数组 / 单对象', () => {
    assert.equal(rowsOf(resp).length, 2);
    assert.equal(rowsOf({ code: 0, data: [1, 2, 3] }).length, 3);
    assert.deepEqual(rowsOf({ code: 0, data: { status: 1 } }), [{ status: 1 }]);
  });
  it('table 对齐输出', () => {
    const t = toTable(rowsOf(resp));
    const lines = t.split('\n');
    assert.match(lines[0], /^a\s+b/);
    assert.equal(lines.length, 4);
  });
  it('csv 转义逗号', () => {
    const c = toCsv(rowsOf(resp));
    assert.equal(c.split('\n')[1], '1,"x,y"');
  });
  it('pretty 缩进树', () => {
    assert.match(toPretty(resp), /data:\n\s+list:\n\s+- \[0\]\n\s+a: 1/);
  });
  it('simplePath 支持 .a.b[0].c / .a[] / .[]', () => {
    assert.equal(simplePath(resp, '.data.list[0].a'), 1);
    assert.deepEqual(simplePath(resp, '.data.list[].a').values, [1, 2]);
    assert.deepEqual(simplePath([{ x: 1 }, { x: 2 }], '.[].x').values, [1, 2]);
    assert.equal(simplePath(resp, '.'), resp);
  });
  it('simplePath 拒绝复杂表达式并给 hint', () => {
    assert.throws(() => simplePath(resp, '.data | length'), (e) => e.type === 'jq_unavailable' && /jq/.test(e.hint));
  });
});
