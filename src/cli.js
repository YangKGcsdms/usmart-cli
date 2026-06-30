import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { registerConfig } from './commands/config.js';
import { registerAuth } from './commands/auth.js';
import { registerDoctor } from './commands/doctor.js';
import { registerApi } from './commands/api.js';
import { registerUsmart } from './commands/usmart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

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

  registerConfig(program);
  registerAuth(program);
  registerDoctor(program);
  registerApi(program);
  registerUsmart(program);

  program.parse(argv);
}
