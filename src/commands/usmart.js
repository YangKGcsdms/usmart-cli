import fs from 'fs';
import path from 'path';
import { getDefaultConfigPath, readUsmartConfig, writeUsmartConfig } from '../lib/usmart-config.js';
import { UsmartSessionManager } from '../lib/session.js';

const HIGH_RISK_COMMANDS = new Set([
  'place-order',
  'cancel-order',
  'odd-entrust',
  'odd-modify',
]);

export function registerUsmart(program) {
  const usmart = program.command('usmart').description('uSMART 盈立证券 API 操作');

  // =========================================================
  // 配置
  // =========================================================
  usmart
    .command('config-init')
    .description('初始化 uSMART 配置文件')
    .option('--config <path>', '配置文件路径')
    .action(async (options) => {
      const configPath = options.config || getDefaultConfigPath();
      if (fs.existsSync(configPath)) {
        console.error(`配置文件已存在：${configPath}`);
        process.exit(1);
      }
      const examplePath = path.join(process.cwd(), 'usmart.config.example.json');
      let example = {};
      if (fs.existsSync(examplePath)) {
        example = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
      }
      delete example._comment;
      writeUsmartConfig(example, configPath);
      fs.chmodSync(configPath, 0o600);
      console.log(`配置文件模板已生成：${configPath}`);
      console.log('请编辑该文件填入真实账号、密码、RSA 密钥、环境地址。');
    });

  // =========================================================
  // 鉴权测试
  // =========================================================
  usmart
    .command('login')
    .description('测试登录')
    .option('--config <path>', '配置文件路径')
    .action(withConfig((session) => session.ensureLogin(), { readOnly: true }));

  usmart
    .command('unlock')
    .description('测试交易解锁')
    .option('--config <path>', '配置文件路径')
    .action(withConfig((session) => session.ensureTradeUnlocked(), { readOnly: true }));

  usmart
    .command('status')
    .description('查看当前会话状态（不触发登录）')
    .option('--config <path>', '配置文件路径')
    .action((options) => {
      const session = new UsmartSessionManager(readUsmartConfig(options.config));
      printJson({ loggedIn: session.isLoggedIn(), tradeUnlocked: session.isTradeUnlocked() });
    });

  // =========================================================
  // 资产 / 账户
  // =========================================================
  registerCommand(usmart, {
    name: 'asset',
    description: '查询综合资产（含持仓）',
    options: [['--money-type <n>', '币种：0=CNY 1=USD 2=HKD，缺省=全部']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/asset-center-server/open-api/open-assetQuery/v1', optional({ moneyType: opts.moneyType })),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'holding',
    description: '查询持仓',
    options: [['--exchange-type <n>', '市场：0=港股 5=美股 100=全部', '100']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/stock-holding', { exchangeType: Number(opts.exchangeType) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'account-type',
    description: '查询账户类型（现金/融资）',
    options: [['--market-type <n>', '市场：0=港股 5=美股', '5']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/user-server/open-api/get-user-info-with-market-for-stock/v1', { marketType: Number(opts.marketType) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'trade-quantity',
    description: '查询最大可买卖数量',
    options: [
      ['--stock-code <code>', '股票代码', ''],
      ['--exchange-type <n>', '市场：0=港股 5=美股', '5'],
      ['--entrust-prop <prop>', '委托属性', ''],
      ['--entrust-price <price>', '委托价格', '0'],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/trade-quantity', {
        stockCode: opts.stockCode,
        exchangeType: Number(opts.exchangeType),
        entrustProp: opts.entrustProp,
        entrustPrice: Number(opts.entrustPrice),
      }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'margin-detail',
    description: '融资账户详情',
    options: [['--exchange-type <n>', '市场：0=港股 5=美股', '5']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/asset-center-server/open-api/open-margin-detail/v1', { exchangeType: Number(opts.exchangeType) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'rate-info',
    description: '资金账户费率（佣金率 + 平台费率）',
    options: [['--exchange-type <n>', '市场：0=港股 5=美股', '5']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-broker-server/open-api/get-rate-info-by-fund-account/v1', { exchangeType: Number(opts.exchangeType) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'mortgage-list',
    description: '融资抵押清单',
    options: [['--exchange-type <n>', '市场：0=港股 5=美股', '5']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-broker-server/open-api/mortgage-list', { exchangeType: Number(opts.exchangeType) }),
      { requireTrade: false }
    ),
  });

  // =========================================================
  // 交易（写操作）
  // =========================================================
  registerCommand(usmart, {
    name: 'place-order',
    description: '下单（高风险，需要 --yes）',
    options: [['--data <json>', '订单参数 JSON 或 @文件', '']],
    requireTrade: true,
    highRisk: true,
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/entrust-order', parseData(opts.data)),
      { requireTrade: true }
    ),
  });

  registerCommand(usmart, {
    name: 'cancel-order',
    description: '撤单（高风险，需要 --yes）',
    options: [['--entrust-id <id>', '委托 ID', '']],
    requireTrade: true,
    highRisk: true,
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/modify-order', {
        entrustId: Number(opts.entrustId),
        actionType: 0,
        entrustAmount: 0,
        entrustPrice: 0,
      }),
      { requireTrade: true }
    ),
  });

  registerCommand(usmart, {
    name: 'odd-entrust',
    description: '港股碎股下单（高风险，需要 --yes）',
    options: [['--data <json>', '订单参数 JSON 或 @文件', '']],
    requireTrade: true,
    highRisk: true,
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/odd-entrust', parseData(opts.data)),
      { requireTrade: true }
    ),
  });

  registerCommand(usmart, {
    name: 'odd-modify',
    description: '港股碎股改单（高风险，需要 --yes）',
    options: [['--data <json>', '改单参数 JSON 或 @文件', '']],
    requireTrade: true,
    highRisk: true,
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/odd-modify', parseData(opts.data)),
      { requireTrade: true }
    ),
  });

  // =========================================================
  // 委托查询
  // =========================================================
  registerCommand(usmart, {
    name: 'today-entrust',
    description: '今日委托查询',
    options: [
      ['--exchange-type <n>', '市场：0=港股 5=美股 100=全部', '100'],
      ['--page-num <n>', '页码', '1'],
      ['--page-size <n>', '每页条数', '20'],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/today-entrust', {
        exchangeType: Number(opts.exchangeType),
        pageNum: Number(opts.pageNum),
        pageSize: Number(opts.pageSize),
      }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'his-entrust',
    description: '历史委托查询',
    options: [
      ['--exchange-type <n>', '市场：0=港股 5=美股', '5'],
      ['--date-flag <n>', '1=近1周 2=近1月 3=近3月 7=全部', '7'],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/his-entrust', {
        exchangeType: Number(opts.exchangeType),
        dateFlag: Number(opts.dateFlag),
      }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'order-detail',
    description: '委托详情',
    options: [['--entrust-id <id>', '委托 ID', '']],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/order-detail', { entrustId: Number(opts.entrustId) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'stock-record',
    description: '成交记录',
    options: [
      ['--exchange-type <n>', '市场：0=港股 5=美股', '5'],
      ['--begin-time <date>', '开始日期 yyyy-MM-dd', ''],
      ['--end-time <date>', '结束日期 yyyy-MM-dd', ''],
      ['--page-num <n>', '页码', '1'],
      ['--page-size <n>', '每页条数', '20'],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-order-server/open-api/stock-record', {
        exchangeType: Number(opts.exchangeType),
        beginTime: opts.beginTime,
        endTime: opts.endTime,
        pageNum: Number(opts.pageNum),
        pageSize: Number(opts.pageSize),
      }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'business-flow',
    description: '资金账户流水',
    options: [
      ['--begin-time <date>', '开始日期 yyyy-MM-dd', ''],
      ['--end-time <date>', '结束日期 yyyy-MM-dd', ''],
      ['--page-num <n>', '页码', '1'],
      ['--page-size <n>', '每页条数', '20'],
      ['--biz-type <type>', '流水类型：DEPOSIT/WITHDRAW/FX/DIV/INT，缺省=全部', ''],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-capital-server/open-api/business-flow', optional({
        beginTime: opts.beginTime,
        endTime: opts.endTime,
        pageNum: Number(opts.pageNum),
        pageSize: Number(opts.pageSize),
        bizType: opts.bizType,
      })),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'currency-exchange',
    description: '历史日级汇率',
    options: [
      ['--begin-date <date>', '开始日期 yyyy-MM-dd', ''],
      ['--end-date <date>', '结束日期 yyyy-MM-dd', ''],
    ],
    action: (session, opts) => session.call(
      (c) => c.postTrade('/stock-capital-server/open-api/currency-exchange-info', {
        beginDate: opts.beginDate,
        endDate: opts.endDate,
      }),
      { requireTrade: false }
    ),
  });

  // =========================================================
  // 行情
  // =========================================================
  registerCommand(usmart, {
    name: 'realtime',
    description: '实时行情',
    options: [['--secu-ids <ids>', '证券ID，多个用逗号分隔，如 usAAPL,hk00700', '']],
    action: (session, opts) => session.call(
      (c) => c.postQuote('/quotes-openservice/api/v1/realtime', { secuIds: opts.secuIds.split(',').filter(Boolean) }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'market-state',
    description: '市场状态',
    options: [['--market <market>', '市场：hk/us/sh/sz', 'hk']],
    action: (session, opts) => session.call(
      (c) => c.postQuote('/quotes-openservice/api/v1/marketstate', { market: opts.market }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'kline',
    description: 'K 线数据',
    options: [
      ['--secu-id <id>', '证券ID，如 usAAPL', ''],
      ['--type <n>', 'K线类型', '7'],
      ['--start <n>', '起始位置', '0'],
      ['--count <n>', '请求数量', '100'],
      ['--right <n>', '复权类型：0=不复权', '0'],
    ],
    action: (session, opts) => session.call(
      (c) => c.postQuote('/quotes-openservice/api/v1/kline', {
        secuId: opts.secuId,
        type: Number(opts.type),
        start: Number(opts.start),
        count: Number(opts.count),
        right: Number(opts.right),
      }),
      { requireTrade: false }
    ),
  });

  registerCommand(usmart, {
    name: 'order-book',
    description: '买卖盘（五档）',
    options: [['--secu-id <id>', '证券ID，如 usAAPL', '']],
    action: (session, opts) => session.call(
      (c) => c.postQuote('/quotes-openservice/api/v1/orderbook', { secuId: opts.secuId }),
      { requireTrade: false }
    ),
  });

  // =========================================================
  // 其他
  // =========================================================
  registerCommand(usmart, {
    name: 'trade-status',
    description: '查询交易解锁状态',
    action: (session) => session.call(
      (c) => c.postTrade('/user-server/open-api/get-trade-status', {}),
      { requireTrade: false }
    ),
  });

  // =========================================================
  // 通用 API
  // =========================================================
  usmart
    .command('api <method> <path>')
    .description('通用 uSMART API 调用')
    .option('--data <json>', '请求体 JSON 或 @文件', '{}')
    .option('--quote', '使用行情 host（默认交易 host）')
    .option('--require-trade', '是否需要交易解锁')
    .option('--config <path>', '配置文件路径')
    .action(async (method, pathArg, options, command) => {
      const config = readUsmartConfig(options.config);
      const session = new UsmartSessionManager(config);
      const body = parseData(options.data);
      const requireTrade = options.requireTrade;
      const useQuote = options.quote;

      const result = await session.call(async (client) => {
        if (useQuote) {
          return client.postQuote(pathArg, body);
        }
        return client.postTrade(pathArg, body);
      }, { requireTrade });

      printJson(result);
    });
}

// =========================================================
// 命令注册辅助函数
// =========================================================

function registerCommand(parent, { name, description, options = [], action, requireTrade = false, highRisk = false }) {
  const cmd = parent.command(name).description(description);
  for (const opt of options) {
    cmd.option(opt[0], opt[1], opt[2]);
  }
  cmd.option('--config <path>', '配置文件路径');
  cmd.action(withConfig(action, { requireTrade, highRisk }));
}

function withConfig(action, { requireTrade = false, highRisk = false, readOnly = false } = {}) {
  return async (options, command) => {
    const cmdName = command.name();
    const globalOpts = command.optsWithGlobals ? command.optsWithGlobals() : {};

    if (highRisk && !globalOpts.yes) {
      printJson({
        ok: false,
        error: {
          type: 'confirmation_required',
          message: `usmart usmart ${cmdName} 是高风险写操作，需要确认`,
          hint: '添加 --yes 确认执行，或先用 --dry-run 预览',
          risk: { level: 'high-risk-write', action: `usmart usmart ${cmdName}` },
        },
      });
      process.exit(10);
    }

    const config = readUsmartConfig(options.config);
    const session = new UsmartSessionManager(config);

    if (readOnly) {
      await action(session, options);
      printJson({
        ok: true,
        loggedIn: session.isLoggedIn(),
        tradeUnlocked: session.isTradeUnlocked(),
        token: maskToken(session.getClient().token),
      });
      return;
    }

    const result = await action(session, options);
    printJson(result);
  };
}

// =========================================================
// 工具函数
// =========================================================

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

function optional(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== '' && v !== null));
}

function parseData(raw) {
  if (!raw || raw === '{}') return {};
  if (raw.startsWith('@')) {
    const filePath = raw.slice(1);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return JSON.parse(raw);
}
