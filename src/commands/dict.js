import { guard, globalsOf, emit, CliError, EXIT } from '../lib/registry.js';
import { listDicts, getDict, lookup } from '../lib/dict.js';

export function registerDict(program) {
  const dict = program.command('dict').description('官方数据字典：市场/币种/订单状态/委托属性/K 线类型/错误码等');

  dict
    .command('list')
    .description('列出所有字典')
    .action(guard(async (_o, command) => {
      const g = globalsOf(command);
      emit({ ok: true, dicts: listDicts() }, { format: g.format, jq: g.jq });
    }));

  dict
    .command('get <name> [code]')
    .description('查看某个字典；带 code 时只查该编码')
    .action(guard(async (name, code, _o, command) => {
      const g = globalsOf(command);
      const d = getDict(name);
      if (!d) {
        throw new CliError('not_found', `未知字典：${name}`, { exitCode: EXIT.INVALID_ARGS, hint: `可用字典：${listDicts().map((x) => x.name).join(', ')}` });
      }
      if (code !== undefined) {
        const hit = lookup(name, code);
        if (!hit) throw new CliError('not_found', `${name} 中没有编码 ${code}`, { exitCode: EXIT.INVALID_ARGS, details: { available: Object.keys(d.values) } });
        emit({ ok: true, dict: name, ...hit }, { format: g.format, jq: g.jq });
        return;
      }
      const entries = Object.entries(d.values).map(([c, n]) => ({ code: c, name: n }));
      emit({ ok: true, dict: name, title: d.title, values: g.format === 'table' || g.format === 'csv' ? entries : d.values }, { format: g.format, jq: g.jq });
    }));

  return dict;
}
