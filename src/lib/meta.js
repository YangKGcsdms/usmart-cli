import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

/** 包根目录（src 的上一级）。无论 CLI 在哪个 cwd 被调用都正确。 */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** GitHub 仓库 slug（owner/repo），用于 `npx skills add`。 */
export const REPO_SLUG = 'YangKGcsdms/usmart-cli';

/** 包内 skills 目录。 */
export const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');

/** 配置示例文件路径。 */
export const CONFIG_EXAMPLE_PATH = path.join(PACKAGE_ROOT, 'usmart.config.example.json');

let cachedPkg;
export function readPackageJson() {
  if (!cachedPkg) {
    cachedPkg = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
  }
  return cachedPkg;
}
