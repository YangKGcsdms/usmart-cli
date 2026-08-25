import fs from 'fs';
import { guard, globalsOf, emit, resolveProfile, UsmartSessionManager } from '../lib/registry.js';
import { configDir, configPathFor, validateConfig, listProfiles } from '../lib/usmart-config.js';
import { loadSession, getSessionFilePath } from '../lib/session-cache.js';
import { isSuccess } from '../lib/usmart-client.js';
import { deriveSigningPublicKey } from '../lib/rsa.js';

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

        // RSA 密钥体检：截断是最常见的粘贴错误；验签公钥用于和 uSMART 登记的那份比对。
        let signingPub = null;
        try {
          signingPub = deriveSigningPublicKey(config.account.privateKey);
          push('签名私钥可解析', true, `${config.account.privateKey.length} 字符`);
        } catch (err) {
          push('签名私钥可解析', false, err.message);
        }
        try {
          const encBytes = Buffer.from(config.account.publicKey, 'base64').length;
          push('加密公钥可解析', encBytes > 100, `${encBytes} 字节（uSMART 提供，用于加密手机号/密码；与签名私钥不是一对）`);
        } catch {
          push('加密公钥可解析', false, 'publicKey 无法 Base64 解码');
        }
        if (signingPub) {
          checks.push({
            item: '当前私钥对应的验签公钥',
            ok: true,
            detail: signingPub,
            note: '这是应提交给 uSMART 登记的公钥。若登录报 107012（非法 OPEN 请求），把它与 uSMART 那边登记的比对。',
          });
        }

        const session = loadSession(config, profile);
        push('会话缓存', true, session && session.token ? `已登录（${getSessionFilePath(profile)}），tradeUnlocked=${session.tradeUnlocked}，updatedAt=${session.updatedAt}` : '无缓存 token（首次调用会自动登录）');

        if (options.online && !looksPlaceholder) {
          // 诊断命令必须有界：短超时、不重试，绝不 hang 住等用户。
          const PROBE_TIMEOUT_MS = Number(process.env.USMART_DOCTOR_TIMEOUT_MS) || 8000;
          try {
            const mgr = new UsmartSessionManager(config, { profile, timeoutMs: PROBE_TIMEOUT_MS, quoteRetry: 0 });
            await mgr.ensureLogin();
            const st = await mgr.call((c) => c.postTrade('/user-server/open-api/get-trade-status', {}));
            push('联网登录', true, `登录成功；服务端交易解锁状态=${isSuccess(st) ? st.data?.status : '未知'}`);
          } catch (err) {
            push('联网登录', false, `${err.message}${err.hint ? '；' + err.hint : ''}`);
          }
          // 行情 REST 与交易 REST 是分开授权的，单独探一次，避免误判为整体故障
          try {
            const mgr = new UsmartSessionManager(config, { profile, timeoutMs: PROBE_TIMEOUT_MS, quoteRetry: 0 });
            const q = await mgr.call((c) => c.postQuote('/quotes-openservice/api/v1/marketstate', { market: 'hk' }));
            push('行情 REST 可用', isSuccess(q), isSuccess(q) ? '正常' : `${q.msg}（code=${q.code}）`, 'warn');
          } catch (err) {
            const is403 = String(err.code) === 'HTTP_403';
            push('行情 REST 可用', false,
              is403
                ? '网关返回 HTTP 403：token 有效但该渠道无 REST 行情权限，需联系 uSMART 开通（WebSocket 推送不受影响，可用 usmart quote subscribe 降级）'
                : `${err.message}`,
              'warn');
          }
        }
      }

      const profiles = listProfiles().map((p) => p.name);
      const ok = checks.every((c) => c.ok || c.level === 'warn');
      emit({ ok, profile, profiles, checks }, { format: g.format, jq: g.jq });
      process.exitCode = ok ? 0 : 1;
    }));
}
