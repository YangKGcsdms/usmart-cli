import { createClient } from '../lib/client.js';

export function registerApi(program) {
  program
    .command('api <method> <path>')
    .description('通用 API 调用')
    .option('--params <json>', 'URL 查询参数 JSON')
    .option('--data <json>', '请求体 JSON')
    .action(async (method, path, options, command) => {
      const profile = command.optsWithGlobals().profile;
      const client = await createClient(profile);

      const params = options.params ? JSON.parse(options.params) : {};
      const data = options.data ? JSON.parse(options.data) : undefined;

      if (command.optsWithGlobals().dryRun) {
        console.log(JSON.stringify({ method, path, params, data }, null, 2));
        return;
      }

      const res = await client.request(method.toUpperCase(), path, { params, data });
      console.log(JSON.stringify(res, null, 2));
    });
}
