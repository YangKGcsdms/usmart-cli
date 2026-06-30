import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { SKILLS_DIR, REPO_SLUG, readPackageJson } from '../lib/meta.js';

/**
 * skill 读取与分发命令（对标 lark-cli skills / update）。
 *
 *   usmart skills list            列出包内 skill
 *   usmart skills read <name>     读取某个 skill 的 SKILL.md
 *   usmart skills read <name> <relpath>   读取 skill 目录下的引用文件
 *   usmart install                安装 CLI 配套 skill 到所有 agent（npx skills add）
 *   usmart update                 重新同步 skill 到最新
 */
export function registerSkills(program) {
  const skills = program.command('skills').description('读取与同步内置 AI Agent Skills');

  skills
    .command('list')
    .description('列出包内所有 skill')
    .action(() => {
      const list = scanSkills();
      console.log(JSON.stringify({ ok: true, count: list.length, skills: list }, null, 2));
    });

  skills
    .command('read <name> [relpath]')
    .description('读取指定 skill 的 SKILL.md，或其目录下的引用文件')
    .action((name, relpath) => {
      const safeName = sanitize(name);
      const base = path.join(SKILLS_DIR, safeName);
      if (!fs.existsSync(base)) {
        console.error(`未找到 skill：${name}（在 ${SKILLS_DIR}）`);
        process.exit(1);
      }
      const target = relpath
        ? path.join(base, sanitizeRel(relpath))
        : path.join(base, 'SKILL.md');
      if (!path.resolve(target).startsWith(path.resolve(base))) {
        console.error('非法路径');
        process.exit(1);
      }
      if (!fs.existsSync(target)) {
        console.error(`文件不存在：${target}`);
        process.exit(1);
      }
      process.stdout.write(fs.readFileSync(target, 'utf-8'));
    });

  program
    .command('install')
    .description('把 usmart skills 安装到所有支持的 AI Agent（Claude Code / Cursor / Codex 等）')
    .action(() => {
      console.error(`正在通过 npx skills add ${REPO_SLUG} 安装 skills…`);
      const code = runSkillsAdd();
      if (code === 0) {
        console.error('✅ skills 安装完成。下一步：usmart usmart config-init');
      } else {
        console.error(`⚠️ skills 安装失败（退出码 ${code}）。可手动运行：npx -y skills add ${REPO_SLUG} -y -g`);
        process.exit(code);
      }
    });

  program
    .command('update')
    .description('重新同步 skills 到最新版本')
    .action(() => {
      const pkg = readPackageJson();
      console.error(`usmart-cli v${pkg.version} —— 正在同步 skills…`);
      const code = runSkillsAdd();
      process.exit(code);
    });
}

function runSkillsAdd() {
  const r = spawnSync('npx', ['-y', 'skills', 'add', REPO_SLUG, '-y', '-g'], {
    stdio: 'inherit',
  });
  return r.status == null ? 1 : r.status;
}

function scanSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, d.name, 'SKILL.md'), 'utf-8');
      return { name: d.name, description: extractDescription(content) };
    });
}

function extractDescription(md) {
  const m = md.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return m ? m[1] : '';
}

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeRel(rel) {
  return String(rel).replace(/\.\.(\/|\\)/g, '');
}
