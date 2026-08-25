import fs from 'fs';
import { guard, globalsOf, emit, resolveProfile, UsmartSessionManager } from '../lib/registry.js';
import { configDir, configPathFor, validateConfig, listProfiles } from '../lib/usmart-config.js';
import { loadSession, getSessionFilePath } from '../lib/session-cache.js';
import { isSuccess } from '../lib/usmart-client.js';

function modeOf(file) {
  try { return (fs.statSync(file).mode & 0o777).toString(8); } catch { return null; }
}

export function registerDoctor(program) {
  program
    .command('doctor')
    .description('健康检查：Node 版本、配置目录/文件权限、必填字段、会话缓存；--online 额外做真实登录探测')
    .option('--config <path>', '配置文件路径')
    .option('--online', '联网：登录 + 查询交易解锁状态')
    .action(guard(async (options, command) => {
      const g = globalsOf(command);
      const profile = resolveProfile(g.profile);
      const configPath = options.config || configPathFor(profile);
      const checks = [];
      const push = (item, ok, detail, level = 'error') => checks.push({ item, ok, detail, ...(ok ? {} : { level }) });

      const major = Number(process.versions.node.split('.')[0]);
      push('Node 版本', major >= 18, `${process.version}${major < 22 ? '（quote subscribe 需要 Node 22+ 的内置 WebSocket，或安装 ws）' : ''}`, major >= 18 ? 'warn' : 'error');

      const dir = configDir();
      push('配置目录', fs.existsSync(dir), `${dir}${process.env.USMART_CONFIG_DIR ? '（来自 USMART_CONFIG_DIR）' : ''}`);

      const exists = fs.existsSync(configPath);
      push(`配置文件（profile=${profile}）`, exists, exists ? configPath : `缺失：${configPath}，运行 usmart auth config-init${profile !== 'default' ? ` --profile ${profile}` : ''}`);

      let config = null;
      if (exists) {
        const mode = modeOf(configPath);
        push('配置文件权限 600', mode === '600', `当前 ${mode}${mode !== '600' ? `，建议 chmod 600 ${configPath}` : ''}`, 'warn');
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          push('配置文件可解析', true, 'JSON 合法');
        } catch (err) {
          push('配置文件可解析', false, err.message);
        }
      }
      if (config) {
        try {
          validateConfig(config, configPath);
          push('必填字段完整', true, `tradeHost=${config.env.tradeHost} quoteHost=${config.env.quoteHost}`);
        } catch (err) {
          push('必填字段完整', false, err.message);
        }
        const looksPlaceholder = /YOUR_|BASE64_|https:\/\/\.\.\./.test(JSON.stringify(config));
        push('无模板占位符', !looksPlaceholder, looksPlaceholder ? '配置里仍有 YOUR_xxx / BASE64_xxx 占位符，请填入真实值' : '已填入真实值');

        const session = loadSession(config, profile);
        push('会话缓存', true, session && session.token ? `已登录（${getSessionFilePath(profile)}），tradeUnlocked=${session.tradeUnlocked}，updatedAt=${session.updatedAt}` : '无缓存 token（首次调用会自动登录）');

        if (options.online && !looksPlaceholder) {
          try {
            const mgr = new UsmartSessionManager(config, { profile });
            await mgr.ensureLogin();
            const st = await mgr.call((c) => c.postTrade('/user-server/open-api/get-trade-status', {}));
            push('联网登录', true, `登录成功；服务端交易解锁状态=${isSuccess(st) ? st.data?.status : '未知'}`);
          } catch (err) {
            push('联网登录', false, `${err.message}${err.hint ? '；' + err.hint : ''}`);
          }
        }
      }

      const profiles = listProfiles().map((p) => p.name);
      const ok = checks.every((c) => c.ok || c.level === 'warn');
      emit({ ok, profile, profiles, checks }, { format: g.format, jq: g.jq });
      process.exitCode = ok ? 0 : 1;
    }));
}
