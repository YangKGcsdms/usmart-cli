import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CliError, EXIT, toCliError, describeCode } from '../src/lib/errors.js';

describe('errors', () => {
  it('toJSON 产出结构化信封', () => {
    const e = new CliError('api_error', 'boom', { exitCode: EXIT.API_ERROR, code: 409933, hint: 'h', httpStatus: 200 });
    assert.deepEqual(e.toJSON(), { ok: false, error: { type: 'api_error', message: 'boom', code: '409933', http_status: 200, hint: 'h' } });
  });
  it('普通 Error → internal_error exit 1，不带堆栈', () => {
    const e = toCliError(new Error('x'));
    assert.equal(e.type, 'internal_error'); assert.equal(e.exitCode, 1); assert.equal(e.details, undefined);
  });
  it('SyntaxError → invalid_json exit 3', () => {
    assert.equal(toCliError(new SyntaxError('bad')).exitCode, EXIT.INVALID_ARGS);
  });
  it('网络错误 retryable', () => {
    const e = toCliError(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    assert.equal(e.type, 'network_error'); assert.equal(e.retryable, true);
  });
  it('错误码表覆盖官方文档主要码', () => {
    for (const c of ['300101', '409984', '806111', '800004', '107004', '107012', '305016', '409933', '409985']) assert.ok(describeCode(c), c);
    assert.equal(describeCode('999999'), null);
  });
});
