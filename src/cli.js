import { Command } from 'commander';
import { registerDoctor } from './commands/doctor.js';
import { registerUsmart } from './commands/usmart.js';
import { registerSkills } from './commands/skills.js';
import { readPackageJson } from './lib/meta.js';

const pkg = readPackageJson();

export function run(argv) {
  const program = new Command();

  program
    .name('usmart')
    .description('uSMART 盈立证券命令行工具')
    .version(pkg.version)
    .option('--profile <name>', '使用指定 profile', 'default')
    .option('--format <fmt>', '输出格式：json|table|csv|pretty', 'json')
    .option('--jq <expr>', 'jq 表达式过滤 JSON 输出')
    .option('--dry-run', '只打印请求，不执行')
    .option('--yes', '自动确认高风险操作');

  registerUsmart(program);
  registerDoctor(program);
  registerSkills(program);

  program.parse(argv);
}
