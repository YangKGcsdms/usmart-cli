import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { opt, validateOptions, parseData, compact } from '../src/lib/validate.js';
import { CliError, EXIT } from '../src/lib/errors.js';

const specs = [
  opt('--stock-code <code>', 'x', { required: true }),
  opt('--exchange-type <n>', 'x', { type: 'int', choices: [0, 5] }),
  opt('--price <n>', 'x', { type: 'number' }),
  opt('--secu-ids <ids>', 'x', { type: 'list' }),
  opt('--force', 'x', { type: 'boolean' }),
];

describe('validate', () => {
  it('缺必填 → CliError exit 3', () => {
    assert.throws(() => validateOptions({}, specs), (e) => e instanceof CliError && e.exitCode === EXIT.INVALID_ARGS && e.details.missing.includes('--stock-code <code>'));
  });
  it('类型转换：int/number/list/boolean', () => {
    const o = validateOptions({ stockCode: 'AAPL', exchangeType: '5', price: '1.5', secuIds: 'a, b,,c', force: true }, specs);
    assert.equal(o.exchangeType, 5); assert.equal(o.price, 1.5); assert.deepEqual(o.secuIds, ['a', 'b', 'c']); assert.equal(o.force, true);
  });
  it('枚举不合法 → exit 3', () => {
    assert.throws(() => validateOptions({ stockCode: 'A', exchangeType: '9' }, specs), (e) => e.exitCode === EXIT.INVALID_ARGS && /取值需为/.test(e.message));
  });
  it('整数字段传小数 → exit 3', () => {
    assert.throws(() => validateOptions({ stockCode: 'A', exchangeType: '1.5' }, specs), (e) => e.exitCode === EXIT.INVALID_ARGS);
  });
  it('relaxRequired 时跳过必填校验并回调（--data 手搓请求体的 1.x 用法）', () => {
    let reported = null;
    const o = validateOptions({ exchangeType: '5' }, specs, { relaxRequired: true, onRelaxed: (m) => { reported = m; } });
    assert.equal(o.exchangeType, 5);
    assert.deepEqual(reported, ['--stock-code <code>']);
  });
  it('relaxRequired 不会放过类型/枚举错误', () => {
    assert.throws(() => validateOptions({ exchangeType: '9' }, specs, { relaxRequired: true }), (e) => e.exitCode === EXIT.INVALID_ARGS);
  });
  it('parseData：JSON / 空 / 非法', () => {
    assert.deepEqual(parseData('{"a":1}'), { a: 1 });
    assert.deepEqual(parseData(undefined), {});
    assert.throws(() => parseData('nope'), (e) => e.type === 'invalid_json' && e.exitCode === EXIT.INVALID_ARGS);
  });
  it('compact 去掉空值', () => {
    assert.deepEqual(compact({ a: 1, b: '', c: null, d: undefined, e: 0, f: false }), { a: 1, e: 0, f: false });
  });
});
