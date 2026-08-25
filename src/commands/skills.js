import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { SKILLS_DIR, REPO_SLUG, readPackageJson } from '../lib/meta.js';
import { guard, globalsOf, emit, CliError, EXIT } from '../lib/registry.js';

/**
 * skill 读取与分发。
 *
 *   usmart skills list                     列出包内 skill
 *   usmart skills read <name> [relpath]    读取 SKILL.md 或其目录下的引用文件
 *   usmart install                         安装 skill 到所有 agent（npx skills add）
 *   usmart update                          重新同步 skill
 */
export function registerSkills(program) {
  const skills = program.command('skills').description('读取与同步内置 AI Agent Skills');

  skills
    .command('list')
    .description('列出包内所有 skill')
    .action(guard(async (_o, command) => {
      const g = globalsOf(command);
      const list = scanSkills();
      emit({ ok: true, count: list.length, version: readPackageJson().version, skills: list }, { format: g.format, jq: g.jq });
    }));

  skills
    .command('read <name> [relpath]')
    .description('读取指定 skill 的 SKILL.md，或其目录下的引用文件')
    .action(guard(async (name, relpath) => {
      const base = resolveSkillDir(name);
      const target = relpath ? safeJoin(base, relpath) : path.join(base, 'SKILL.md');
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        throw new CliError('not_found', `文件不存在：${relpath || 'SKILL.md'}（skill=${name}）`, { exitCode: EXIT.INVALID_ARGS });
      }
      process.stdout.write(fs.readFileSync(target, 'utf-8'));
    }));

  program
    .command('install')
    .description('把 usmart skills 安装到所有支持的 AI Agent（Claude Code / Cursor / Codex 等）')
    .action(guard(async () => {
      process.stderr.write(`正在通过 npx skills add ${REPO_SLUG} 安装 skills…\n`);
      const code = runSkillsAdd();
      if (code !== 0) {
        throw new CliError('skills_install_failed', `skills 安装失败（退出码 ${code}）`, {
          exitCode: EXIT.ERROR,
          hint: `手动运行：npx -y skills add ${REPO_SLUG} -y -g`,
        });
      }
      process.stderr.write('✅ skills 安装完成。下一步：usmart auth config-init\n');
    }));

  program
    .command('update')
    .description('重新同步 skills 到最新版本')
    .action(guard(async () => {
      const pkg = readPackageJson();
      process.stderr.write(`usmart-cli v${pkg.version} —— 正在同步 skills…\n`);
      const code = runSkillsAdd();
      if (code !== 0) throw new CliError('skills_update_failed', `同步失败（退出码 ${code}）`, { exitCode: EXIT.ERROR, hint: `手动运行：npx -y skills add ${REPO_SLUG} -y -g` });
    }));

  return skills;
}

function runSkillsAdd() {
  const r = spawnSync('npx', ['-y', 'skills', 'add', REPO_SLUG, '-y', '-g'], { stdio: 'inherit' });
  return r.status == null ? 1 : r.status;
}

function resolveSkillDir(name) {
  const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(SKILLS_DIR, safe);
  if (!safe || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new CliError('not_found', `未找到 skill：${name}`, {
      exitCode: EXIT.INVALID_ARGS,
      hint: `可用：${scanSkills().map((s) => s.name).join(', ')}`,
    });
  }
  return dir;
}

/** 只允许访问 base 目录内的文件（解析真实路径后再比较，带分隔符避免前缀误判）。 */
function safeJoin(base, rel) {
  const resolvedBase = fs.realpathSync(base);
  const target = path.resolve(resolvedBase, rel);
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new CliError('invalid_args', '非法路径：只能读取该 skill 目录内的文件', { exitCode: EXIT.INVALID_ARGS });
  }
  return target;
}

function scanSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, d.name, 'SKILL.md'), 'utf-8');
      return { name: d.name, version: extractField(content, 'version'), description: extractField(content, 'description') };
    });
}

function extractField(md, field) {
  const m = md.match(new RegExp(`^${field}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return m ? m[1] : '';
}
