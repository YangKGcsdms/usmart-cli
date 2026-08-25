import { Command } from 'commander';
import { registerAuth } from './commands/auth.js';
import { registerAccount } from './commands/account.js';
import { registerOrder } from './commands/order.js';
import { registerQuote } from './commands/quote.js';
import { registerIpo } from './commands/ipo.js';
import { registerMa } from './commands/ma.js';
import { registerOption } from './commands/option.js';
import { registerDict } from './commands/dict.js';
import { registerApi, registerApiCommand } from './commands/api.js';
import { registerDoctor } from './commands/doctor.js';
import { registerSkills } from './commands/skills.js';
import { registerLegacyGroup } from './lib/registry.js';
import { readPackageJson } from './lib/meta.js';
import { FORMATS } from './lib/output.js';
import { printJson } from './lib/output.js';
import { toCliError } from './lib/errors.js';

const pkg = readPackageJson();

export function buildProgram() {
  const program = new Command();

  program
    .name('usmart')
    .description('uSMART 盈立证券命令行工具 —— 让智能体与人类通过 CLI 操作 uSMART 交易与行情\n\n用法：usmart <domain> <command> [options]\n域：auth account order quote ipo ma option dict api doctor skills')
    .version(pkg.version)
    .option('--profile <name>', '使用指定 profile（<配置目录>/<name>.json；default → usmart.json）')
    .option('--format <fmt>', `输出格式：${FORMATS.join('|')}`, 'json')
    .option('--jq <expr>', 'jq 表达式过滤输出（本机有 jq 用完整语法；否则支持 .a.b[0].c）')
    .option('--dry-run', '只打印将发起的请求，不发送（高风险命令可免 --yes 预览）')
    .option('--yes', '确认执行高风险写操作')
    .showHelpAfterError('（使用 --help 查看用法）')
    .showSuggestionAfterError();

  registerAuth(program);
  registerAccount(program);
  registerOrder(program);
  registerQuote(program);
  registerIpo(program);
  registerMa(program);
  registerOption(program);
  registerDict(program);
  registerApi(program);
  registerDoctor(program);
  registerSkills(program);
  const legacy = registerLegacyGroup(program);
  registerApiCommand(legacy, { legacyName: 'api' });

  return program;
}

export async function run(argv) {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const cli = toCliError(err);
    printJson(cli.toJSON());
    process.exit(cli.exitCode);
  }
}
