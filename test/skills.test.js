import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { SKILLS_DIR } from '../src/lib/meta.js';

const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe('skills 元数据', () => {
  it('每个目录都有 SKILL.md', () => {
    for (const d of dirs) assert.ok(fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md')), d);
  });
  it('frontmatter 的 name 与目录名一致，且有 description/version', () => {
    for (const d of dirs) {
      const md = fs.readFileSync(path.join(SKILLS_DIR, d, 'SKILL.md'), 'utf-8');
      assert.match(md, /^---\n/, d);
      const name = md.match(/^name:\s*(.+)$/m)?.[1].trim();
      const desc = md.match(/^description:\s*(.+)$/m)?.[1].trim();
      const ver = md.match(/^version:\s*(.+)$/m)?.[1].trim();
      assert.equal(name, d);
      assert.ok(desc && desc.length > 30, `${d} description 过短`);
      assert.ok(ver, `${d} 缺 version`);
    }
  });
  it('覆盖全部领域', () => {
    for (const n of ['usmart-shared', 'usmart-auth', 'usmart-account', 'usmart-order', 'usmart-quote', 'usmart-ipo', 'usmart-derivatives', 'usmart-cli-dev']) {
      assert.ok(dirs.includes(n), n);
    }
  });
  it('skill 里出现的 usmart 命令都真实存在', async () => {
    const { buildProgram } = await import('../src/cli.js');
    const program = buildProgram();
    const known = new Set();
    for (const d of program.commands) {
      known.add(d.name());
      for (const c of d.commands) known.add(`${d.name()} ${c.name()}`);
    }
    const bad = [];
    for (const d of dirs) {
      const md = fs.readFileSync(path.join(SKILLS_DIR, d, 'SKILL.md'), 'utf-8');
      for (const m of md.matchAll(/^\s*usmart ((?:--\S+ \S+ )*)([a-z-]+)(?: ([a-z-]+))?/gm)) {
        const domain = m[2];
        const sub = m[3];
        if (['dict', 'doctor', 'install', 'update', 'api', 'skills', 'help'].includes(domain)) continue;
        const key = sub && !sub.startsWith('-') ? `${domain} ${sub}` : domain;
        if (!known.has(key) && !known.has(domain)) bad.push(`${d}: usmart ${key}`);
      }
    }
    assert.deepEqual(bad, [], `skill 引用了不存在的命令：\n${bad.join('\n')}`);
  });
});
