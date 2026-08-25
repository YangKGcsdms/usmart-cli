import { readUsmartConfig, resolveProfile } from './usmart-config.js';
import { UsmartSessionManager } from './session.js';
import { isSuccess, apiError, maskToken } from './usmart-client.js';
import { validateOptions, parseData, attrName } from './validate.js';
import { emit, printJson } from './output.js';
import { CliError, EXIT, toCliError, describeCode } from './errors.js';

/**
 * 命令注册框架。
 *
 * def = {
 *   name, description,
 *   legacy?: 'old-name'          // 同时注册到隐藏的 `usmart usmart <old-name>`，兼容 1.x
 *   options?: [opt(...)],
 *   requireTrade?: boolean,      // 需要交易解锁
 *   highRisk?: boolean,          // 写操作：不带 --yes 退出码 10；--dry-run 可预览
 *   allowData?: boolean,         // 额外接受 --data（合并/覆盖请求体），默认 true
 *                                //   给了 --data 时必填校验降级为提示：用户在手搓请求体（1.x 的用法）
 *   action(session, opts, ctx) → Promise<response>
 *   readOnlyStatus?: boolean     // login/unlock 这类：动作完成后输出会话状态
 * }
 */
export const legacyRegistry = new Map();

export function registerCommand(parent, def) {
  const cmd = parent.command(def.name).description(def.description);
  applyOptions(cmd, def);
  cmd.action(makeHandler(def));
  if (def.legacy) legacyRegistry.set(def.legacy, { def, domain: parent.name() });
  return cmd;
}

export function applyOptions(cmd, def) {
  for (const o of def.options || []) {
    const desc = o.required ? `${o.desc}（必填）` : o.desc;
    cmd.option(o.flags, desc, o.default);
  }
  if (def.allowData !== false) cmd.option('--data <json>', '额外请求体字段（JSON 或 @文件），会合并/覆盖命令参数');
  cmd.option('--config <path>', '配置文件路径（优先于 --profile）');
}

export function makeHandler(def, { legacyName } = {}) {
  return async (options, command) => {
    const globalOpts = command.optsWithGlobals ? command.optsWithGlobals() : {};
    const format = globalOpts.format || 'json';
    const jq = globalOpts.jq;
    const dryRun = !!globalOpts.dryRun;
    const profile = resolveProfile(globalOpts.profile);
    const fullName = `usmart ${legacyName ? 'usmart ' + legacyName : commandPath(command)}`;

    try {
      if (legacyName) {
        process.stderr.write(`[usmart] 提示：\`${fullName}\` 已弃用，请改用 \`usmart ${commandPathOf(def)}\`\n`);
      }

      // 1. 高风险门禁：dry-run 可无 --yes 预览；真正执行必须 --yes
      if (def.highRisk && !dryRun && !globalOpts.yes) {
        printJson({
          ok: false,
          error: {
            type: 'confirmation_required',
            message: `${fullName} 是高风险写操作，需要确认`,
            hint: '添加 --yes 确认执行，或先用 --dry-run 预览请求',
            risk: { level: 'high-risk-write', action: fullName },
          },
        });
        process.exitCode = EXIT.CONFIRM_REQUIRED;
        return;
      }

      // 2. 参数校验。
      //    显式给了 --data 时说明用户在手搓请求体（1.x 的老用法），此时把必填校验降级为
      //    stderr 提示，交给服务端判断；命令没给的字段会被 compact/JSON.stringify 丢掉，
      //    不会退化成「静默发送 entrustId: 0」那种情况。
      const extra = def.allowData !== false ? parseData(options.data) : {};
      const hasData = Object.keys(extra).length > 0;
      const opts = validateOptions(options, def.options || [], { relaxRequired: hasData, onRelaxed: (missing) => {
        process.stderr.write(`[usmart] 已提供 --data，跳过必填校验：${missing.join(', ')}\n`);
      } });

      // 3. 配置 + 会话
      const config = readUsmartConfig({ configPath: options.config, profile });
      const session = new UsmartSessionManager(config, { profile, dryRun });
      const ctx = { config, profile, dryRun, extra, globalOpts, merge: (body) => ({ ...body, ...extra }) };

      // 4. 执行
      const result = await def.action(session, opts, ctx);

      // 5. 输出
      if (def.readOnlyStatus) {
        emit({ ok: true, loggedIn: session.isLoggedIn(), tradeUnlocked: session.isTradeUnlocked(), token: maskToken(session.getClient().token), profile }, { format, jq });
        return;
      }
      if (result && result.__dryRun) {
        emit({ ok: true, dryRun: true, request: result.__dryRun }, { format, jq });
        return;
      }
      if (result && result.__stream) return; // 流式命令自行输出
      if (!isSuccess(result)) {
        const err = apiError(result);
        const d = describeCode(err.code);
        if (d) {
          if (d.hint) err.hint = d.hint;
          if (!err.message || err.message === `uSMART 返回错误码 ${err.code}`) err.message = d.msg;
        }
        throw err;
      }
      emit(result, { format, jq });
    } catch (err) {
      const cli = toCliError(err);
      printJson(cli.toJSON());
      // 用 exitCode 而不是 process.exit()：后者会在管道场景下截断尚未 flush 的 stdout
      process.exitCode = cli.exitCode;
    }
  };
}

function commandPath(command) {
  const parts = [];
  let c = command;
  while (c && c.parent) { parts.unshift(c.name()); c = c.parent; }
  return parts.join(' ');
}

export function commandPathOf(def) {
  return def.__domain ? `${def.__domain} ${def.name}` : def.name;
}

/** 定义一个 domain 子命令组。 */
export function defineDomain(program, name, description) {
  const domain = program.command(name).description(description);
  domain.__isDomain = true;
  return {
    cmd: domain,
    add(def) {
      def.__domain = name;
      return registerCommand(domain, def);
    },
  };
}

/** 把所有带 legacy 名的命令注册到隐藏的 `usmart usmart <old>` 组。 */
export function registerLegacyGroup(program) {
  const legacy = program.command('usmart', { hidden: true }).description('[已弃用] 1.x 兼容入口，请使用 usmart <domain> <command>');
  for (const [oldName, { def }] of legacyRegistry) {
    const cmd = legacy.command(oldName).description(`[已弃用 → usmart ${commandPathOf(def)}] ${def.description}`);
    applyOptions(cmd, def);
    cmd.action(makeHandler(def, { legacyName: oldName }));
  }
  return legacy;
}

export { CliError, EXIT, attrName };

/** 包装不走 session 的自定义命令：统一错误输出与退出码。 */
export function guard(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      const cli = toCliError(err);
      printJson(cli.toJSON());
      // 用 exitCode 而不是 process.exit()：后者会在管道场景下截断尚未 flush 的 stdout
      process.exitCode = cli.exitCode;
    }
  };
}

/** 从 commander 命令取全局选项（format/jq/profile…）。 */
export function globalsOf(command) {
  return command.optsWithGlobals ? command.optsWithGlobals() : {};
}

export { emit, printJson, readUsmartConfig, resolveProfile, UsmartSessionManager, maskToken };
