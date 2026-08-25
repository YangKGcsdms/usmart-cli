import { spawnSync } from 'child_process';
import { CliError, EXIT } from './errors.js';

/**
 * 输出层：stdout 只放数据（JSON / table / csv / pretty），stderr 放提示。
 */
export const FORMATS = ['json', 'table', 'csv', 'pretty'];

export function printJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

/**
 * 按全局 --format / --jq 输出结果。
 * @param {any} result  完整响应（通常 {code,msg,data}）
 */
export function emit(result, { format = 'json', jq } = {}) {
  let value = result;
  if (jq) {
    const out = applyJq(value, jq);
    // jq 产生多个结果时按 NDJSON 逐行输出（与 jq CLI 行为一致），便于管道消费
    if (out && out.__stream) {
      if (format === 'json') {
        for (const v of out.values) process.stdout.write((typeof v === 'string' ? v : JSON.stringify(v)) + '\n');
        return;
      }
      value = out.values;
    } else {
      value = out;
    }
  }
  switch (format) {
    case 'json':
      process.stdout.write((typeof value === 'string' ? value : JSON.stringify(value, null, 2)) + '\n');
      return;
    case 'table':
      process.stdout.write(toTable(rowsOf(value)) + '\n');
      return;
    case 'csv':
      process.stdout.write(toCsv(rowsOf(value)) + '\n');
      return;
    case 'pretty':
      process.stdout.write(toPretty(value) + '\n');
      return;
    default:
      throw new CliError('invalid_format', `不支持的输出格式：${format}`, { exitCode: EXIT.INVALID_ARGS, hint: `可选：${FORMATS.join('|')}` });
  }
}

/** 从响应里挑出适合做表格的行：data 为数组 / data.list / data 本身。 */
export function rowsOf(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const d = 'data' in value && 'code' in value ? value.data : value;
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object') {
      if (Array.isArray(d.list)) return d.list;
      return [d];
    }
    return [{ value: d }];
  }
  return [{ value }];
}

function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function toTable(rows) {
  if (!rows.length) return '(empty)';
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const matrix = rows.map((r) => keys.map((k) => cell(r?.[k])));
  const widths = keys.map((k, i) => Math.max(strWidth(k), ...matrix.map((m) => strWidth(m[i]))));
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - strWidth(s)));
  const line = (cells) => cells.map((c, i) => pad(c, widths[i])).join('  ');
  return [line(keys), line(widths.map((w) => '-'.repeat(w))), ...matrix.map(line)].join('\n');
}

// 中文按 2 宽度计算，保证对齐
function strWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-￿]/.test(ch) ? 2 : 1;
  return w;
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const esc = (s) => {
    const str = cell(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [keys.map(esc).join(','), ...rows.map((r) => keys.map((k) => esc(r?.[k])).join(','))].join('\n');
}

export function toPretty(value, indent = 0) {
  const sp = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${sp}[]`;
    return value.map((v, i) => (typeof v === 'object' && v !== null ? `${sp}- [${i}]\n${toPretty(v, indent + 1)}` : `${sp}- ${cell(v)}`)).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => (typeof v === 'object' && v !== null ? `${sp}${k}:\n${toPretty(v, indent + 1)}` : `${sp}${k}: ${cell(v)}`))
      .join('\n');
  }
  return `${sp}${cell(value)}`;
}

/**
 * --jq：本机有 jq 时直接调用（支持完整语法）；否则用内置的简易路径选择器
 * （支持 .a.b、.a[0]、.a[]、.a[].b、.[]）。
 */
export function applyJq(value, expr) {
  const bin = spawnSync('jq', ['-c', expr], { input: JSON.stringify(value), encoding: 'utf-8' });
  if (!bin.error) {
    if (bin.status !== 0) {
      throw new CliError('jq_error', (bin.stderr || 'jq 执行失败').trim(), { exitCode: EXIT.INVALID_ARGS });
    }
    const lines = bin.stdout.trim().split('\n').filter(Boolean);
    const parsed = lines.map((l) => {
      try { return JSON.parse(l); } catch { return l; }
    });
    return parsed.length === 1 ? parsed[0] : { __stream: true, values: parsed };
  }
  return simplePath(value, expr);
}

export function simplePath(value, expr) {
  const e = expr.trim();
  if (e === '.' || e === '') return value;
  if (!/^\.[A-Za-z0-9_.\[\]]*$/.test(e)) {
    throw new CliError('jq_unavailable', `本机未安装 jq，内置选择器仅支持 .a.b[0].c 形式，无法解析：${expr}`, {
      exitCode: EXIT.INVALID_ARGS,
      hint: 'brew install jq 后可使用完整 jq 语法',
    });
  }
  const tokens = e.slice(1).split(/\.(?![^\[]*\])/).filter((t) => t !== '');
  let cur = [value];
  for (const tok of tokens) {
    const m = tok.match(/^([A-Za-z0-9_]*)((?:\[\d*\])*)$/);
    if (!m) throw new CliError('jq_unavailable', `无法解析路径片段：${tok}`, { exitCode: EXIT.INVALID_ARGS });
    const key = m[1];
    const idx = [...m[2].matchAll(/\[(\d*)\]/g)].map((x) => x[1]);
    let next = [];
    for (const v of cur) {
      let node = key ? (v == null ? undefined : v[key]) : v;
      let nodes = [node];
      for (const i of idx) {
        const out = [];
        for (const n of nodes) {
          if (!Array.isArray(n)) continue;
          if (i === '') out.push(...n);
          else out.push(n[Number(i)]);
        }
        nodes = out;
      }
      next.push(...nodes);
    }
    cur = next;
  }
  return cur.length === 1 ? cur[0] : { __stream: true, values: cur };
}
