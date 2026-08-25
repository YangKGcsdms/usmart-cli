import { defineDomain, CliError, EXIT } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { nextSerialNo } from '../lib/request-id.js';

const EXCHANGE_REQ = opt('--exchange-type <n>', '市场：0=港股 5=美股 6=沪港通 7=深港通', { type: 'int', required: true, choices: [0, 5, 6, 7] });
const PAGE = [
  opt('--page-num <n>', '页码，从 1 开始', { type: 'int', default: '1' }),
  opt('--page-size <n>', '每页条数', { type: 'int', default: '20' }),
];

function side(v) {
  if (v === undefined) return undefined;
  const s = String(v).toLowerCase();
  if (['0', 'buy', 'b'].includes(s)) return 0;
  if (['1', 'sell', 's'].includes(s)) return 1;
  throw new CliError('invalid_args', `--side 需为 buy|sell|0|1，实际 ${v}`, { exitCode: EXIT.INVALID_ARGS });
}

export function registerOrder(program) {
  const order = defineDomain(program, 'order', '股票交易与委托：下单、改单、撤单、碎股、可买卖数量、今日/历史订单、订单详情、成交流水');

  order.add({
    name: 'place', legacy: 'place-order',
    description: '下单（高风险，需要 --yes；serialNo 自动生成）',
    options: [
      opt('--stock-code <code>', '股票代码，如 00700 / AAPL', { required: true }),
      EXCHANGE_REQ,
      opt('--side <buy|sell>', '买卖方向：buy|sell（或 0|1）', { required: true }),
      opt('--entrust-prop <p>', "委托属性：'0'=限价单 d=竞价单 e=增强限价单 g=竞价限价单 w=市价单（见 usmart dict get entrust-prop）", { required: true, choices: ['0', 'd', 'e', 'g', 'w'] }),
      opt('--price <n>', '委托价格（竞价单/市价单传 0）', { type: 'number', required: true }),
      opt('--amount <n>', '委托数量', { type: 'number', required: true }),
      opt('--stock-name <name>', '股票名称（可选）'),
      opt('--session-type <n>', '交易阶段：0=正常 1=盘前 2=盘后 3=暗盘 12=盘前盘后', { type: 'int', choices: [0, 1, 2, 3, 12] }),
      opt('--force', '超过 9 倍 24 档时强制委托（forceEntrustFlag）', { type: 'boolean' }),
      opt('--exchange <x>', '美股交易所，默认 SMART'),
      opt('--order-type <t>', '订单类型 DAY/GTC/GTD（官方暂只支持 DAY）'),
      opt('--valid-date <d>', 'GTD 有效期 yyyy-MM-dd'),
      opt('--serial-no <n>', '自定义流水号（19 位以内唯一整数），缺省自动生成'),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/entrust-order', ctx.merge(compact({
      serialNo: o.serialNo || nextSerialNo(),
      stockCode: o.stockCode, exchangeType: o.exchangeType, entrustType: side(o.side), entrustProp: o.entrustProp,
      entrustPrice: o.price, entrustAmount: o.amount, stockName: o.stockName, sessionType: o.sessionType,
      forceEntrustFlag: o.force ? true : undefined, exchange: o.exchange, orderType: o.orderType, validDate: o.validDate,
    }))), { requireTrade: true }),
  });

  order.add({
    name: 'modify',
    description: '改单（高风险，需要 --yes）：修改价格/数量',
    options: [
      opt('--entrust-id <id>', '委托 ID', { required: true }),
      opt('--price <n>', '新委托价格', { type: 'number', required: true }),
      opt('--amount <n>', '新委托数量', { type: 'number', required: true }),
      opt('--force', '强制委托（forceEntrustFlag）', { type: 'boolean' }),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/modify-order', ctx.merge(compact({
      entrustId: o.entrustId, actionType: 1, entrustPrice: o.price, entrustAmount: o.amount, forceEntrustFlag: o.force ? true : undefined,
    }))), { requireTrade: true }),
  });

  order.add({
    name: 'cancel', legacy: 'cancel-order',
    description: '撤单（高风险，需要 --yes）',
    options: [opt('--entrust-id <id>', '委托 ID', { required: true })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/modify-order', ctx.merge({
      entrustId: o.entrustId, actionType: 0, entrustAmount: 0, entrustPrice: 0,
    })), { requireTrade: true }),
  });

  order.add({
    name: 'modified-range',
    description: '改单允许的价格/数量范围',
    options: [opt('--entrust-id <id>', '委托 ID', { required: true }), opt('--new-price <n>', '最新价（竞价单也需传）', { type: 'number', required: true })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/modified-range', ctx.merge({ entrustId: o.entrustId, newPrice: o.newPrice }))),
  });

  order.add({
    name: 'odd-place', legacy: 'odd-entrust',
    description: '港股碎股卖出（高风险，需要 --yes；碎股只支持卖）',
    options: [
      opt('--stock-code <code>', '股票代码', { required: true }),
      opt('--exchange-type <n>', '市场：0=港股 5=美股', { type: 'int', default: '0', choices: [0, 5] }),
      opt('--price <n>', '委托价格', { type: 'number', required: true }),
      opt('--amount <n>', '委托数量', { type: 'number', required: true }),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/odd-entrust', ctx.merge({
      stockCode: o.stockCode, exchangeType: o.exchangeType, entrustType: 1, entrustPrice: o.price, entrustAmount: o.amount,
    })), { requireTrade: true }),
  });

  order.add({
    name: 'odd-cancel', legacy: 'odd-modify',
    description: '港股碎股撤单（高风险，需要 --yes）',
    options: [opt('--odd-id <id>', '碎股委托 ID', { required: true })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/odd-modify', ctx.merge({ oddId: o.oddId, actionType: 0 })), { requireTrade: true }),
  });

  order.add({
    name: 'max-quantity', legacy: 'trade-quantity',
    description: '最大可买 / 可卖数量（含购买力）',
    options: [
      opt('--stock-code <code>', '证券代码', { required: true }),
      EXCHANGE_REQ,
      opt('--entrust-prop <p>', "委托属性：'0' d e g u", { default: '0', choices: ['0', 'd', 'e', 'g', 'u'] }),
      opt('--price <n>', '委托价格（竞价单可不填）', { type: 'number' }),
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/trade-quantity', ctx.merge(compact({
      stockCode: o.stockCode, exchangeType: o.exchangeType, entrustProp: o.entrustProp, entrustPrice: o.price,
    })))),
  });

  order.add({
    name: 'margin-quantity',
    description: '融资可买股数',
    options: [
      opt('--stock-code <code>', '证券代码', { required: true }),
      EXCHANGE_REQ,
      opt('--entrust-prop <p>', "委托属性：'0' d e g u", { default: '0', choices: ['0', 'd', 'e', 'g', 'u'] }),
      opt('--amount <n>', '委托数量', { type: 'number', required: true }),
      opt('--price <n>', '委托价格（竞价单可不填）', { type: 'number' }),
      opt('--entrust-type <n>', '0=买 5=改单', { type: 'int', choices: [0, 5] }),
      opt('--entrust-id <id>', '改单时必填的委托 ID'),
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/trade-margin-quantity', ctx.merge(compact({
      stockCode: o.stockCode, exchangeType: o.exchangeType, entrustProp: o.entrustProp, entrustAmount: o.amount,
      entrustPrice: o.price, entrustType: o.entrustType, entrustId: o.entrustId,
    })))),
  });

  order.add({
    name: 'today', legacy: 'today-entrust',
    description: '今日订单（分页）',
    options: [
      opt('--exchange-type <n>', '市场：0=港股 5=美股 67=A股 100=全部', { type: 'int', default: '100', choices: [0, 5, 67, 100] }),
      opt('--stock-code <code>', '证券代码过滤'),
      opt('--stock-name <name>', '证券名称过滤'),
      ...PAGE,
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/today-entrust', ctx.merge(compact({
      exchangeType: o.exchangeType, stockCode: o.stockCode, stockName: o.stockName, pageNum: o.pageNum, pageSize: o.pageSize,
    })))),
  });

  order.add({
    name: 'history', legacy: 'his-entrust',
    description: '历史订单（分页）',
    options: [
      opt('--exchange-type <n>', '市场：0=港股 5=美股 67=A股', { type: 'int', default: '5', choices: [0, 5, 67] }),
      opt('--date-flag <n>', '1=近1周 2=近1月 3=近3月 4=近1年 5=今年 6=自选 7=全部', { type: 'int', default: '7', choices: [1, 2, 3, 4, 5, 6, 7] }),
      opt('--begin-date <d>', '开始日期 yyyy-MM-dd（date-flag=6）'),
      opt('--end-date <d>', '结束日期 yyyy-MM-dd（date-flag=6）'),
      opt('--stock-code <code>', '证券代码过滤'),
      ...PAGE,
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/his-entrust', ctx.merge(compact({
      exchangeType: o.exchangeType, dateFlag: String(o.dateFlag), entrustBeginDate: o.beginDate, entrustEndDate: o.endDate,
      stockCode: o.stockCode, pageNum: o.pageNum, pageSize: o.pageSize,
    })))),
  });

  order.add({
    name: 'detail', legacy: 'order-detail',
    description: '订单明细（--entrust-id 与 --serial-no 至少传一个）',
    options: [opt('--entrust-id <id>', '委托 ID'), opt('--serial-no <n>', '下单流水号')],
    action: (s, o, ctx) => {
      if (!o.entrustId && !o.serialNo) throw new CliError('invalid_args', '--entrust-id 与 --serial-no 至少传一个', { exitCode: EXIT.INVALID_ARGS });
      return s.call((c) => c.postTrade('/stock-order-server/open-api/order-detail', ctx.merge(compact({ entrustId: o.entrustId, serialNo: o.serialNo }))));
    },
  });

  order.add({
    name: 'fills', legacy: 'stock-record',
    description: '成交流水（分页）',
    options: [
      opt('--exchange-type <n>', '市场：0=港股 5=美股 67=A股', { type: 'int', default: '5', choices: [0, 5, 67] }),
      opt('--stock-code <code>', '证券代码过滤'),
      opt('--entrust-id <id>', '委托 ID 过滤'),
      opt('--begin-time <d>', '成交开始日期 yyyy-MM-dd'),
      opt('--end-time <d>', '成交结束日期 yyyy-MM-dd'),
      ...PAGE,
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/stock-record', ctx.merge(compact({
      exchangeType: o.exchangeType, stockCode: o.stockCode, entrustId: o.entrustId, beginTime: o.beginTime, endTime: o.endTime, pageNum: o.pageNum, pageSize: o.pageSize,
    })))),
  });

  return order;
}
