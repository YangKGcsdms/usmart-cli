import fs from 'fs';
import { Option } from 'commander';
import { CliError, EXIT } from './errors.js';

/**
 * 命令参数声明与校验。
 *
 * spec: {
 *   flags: '--stock-code <code>', desc, required?, type?: 'int'|'number'|'string'|'boolean'|'list'|'json',
 *   choices?: [...], default?
 * }
 */
export function opt(flags, desc, extra = {}) {
  return { flags, desc, ...extra };
}

export function attrName(flags) {
  return new Option(flags).attributeName();
}

/**
 * 把 commander 解析出的 opts 按 specs 做必填/类型/枚举校验并做类型转换。
 * @param {object} [o]
 * @param {boolean} [o.relaxRequired] 为 true 时不因缺必填而报错（用户用 --data 手搓请求体）
 * @param {(missing: string[]) => void} [o.onRelaxed]
 */
export function validateOptions(opts, specs, { relaxRequired = false, onRelaxed } = {}) {
  const missing = [];
  const invalid = [];
  const out = { ...opts };
  for (const s of specs) {
    const name = attrName(s.flags);
    let v = opts[name];
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (s.required) missing.push(s.flags);
      continue;
    }
    try {
      v = coerce(v, s.type || 'string');
    } catch (e) {
      invalid.push(`${s.flags}: ${e.message}`);
      continue;
    }
    if (s.choices && !s.choices.map(String).includes(String(v))) {
      invalid.push(`${s.flags}: 取值需为 ${s.choices.join('|')}，实际 ${v}`);
      continue;
    }
    out[name] = v;
  }
  if (relaxRequired && missing.length) {
    // 传副本：下面会清空 missing，回调方不应看到被就地改掉的数组
    if (onRelaxed) onRelaxed([...missing]);
    missing.length = 0;
  }
  if (missing.length || invalid.length) {
    const parts = [];
    if (missing.length) parts.push(`缺少必填参数：${missing.join(', ')}`);
    if (invalid.length) parts.push(`参数不合法：${invalid.join('; ')}`);
    throw new CliError('invalid_args', parts.join('；'), {
      exitCode: EXIT.INVALID_ARGS,
      hint: '使用 --help 查看参数说明',
      details: { missing, invalid },
    });
  }
  return out;
}

export function coerce(v, type) {
  switch (type) {
    case 'int': {
      const n = Number(v);
      if (!Number.isInteger(n)) throw new Error(`需为整数，实际 ${v}`);
      return n;
    }
    case 'number': {
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`需为数字，实际 ${v}`);
      return n;
    }
    case 'boolean':
      if (typeof v === 'boolean') return v;
      if (['true', '1', 'yes'].includes(String(v).toLowerCase())) return true;
      if (['false', '0', 'no'].includes(String(v).toLowerCase())) return false;
      throw new Error(`需为 true/false，实际 ${v}`);
    case 'list':
      return Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean);
    case 'json':
      return parseData(v);
    case 'string':
    default:
      return String(v);
  }
}

/** 解析 --data：JSON 字符串或 @文件。 */
export function parseData(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === '{}') return {};
  if (typeof raw === 'object') return raw;
  const text = raw.startsWith('@') ? fs.readFileSync(raw.slice(1), 'utf-8') : raw;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new CliError('invalid_json', `--data 不是合法 JSON：${e.message}`, {
      exitCode: EXIT.INVALID_ARGS,
      hint: "示例：--data '{\"stockCode\":\"AAPL\"}' 或 --data @order.json",
    });
  }
}

/** 去掉 undefined / '' / null 字段。 */
export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null));
}
