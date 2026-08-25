import { defineDomain, CliError, EXIT } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { nextSerialNo } from '../lib/request-id.js';

const PAGE = [
  opt('--page-num <n>', '页码，从 1 开始', { type: 'int', default: '1' }),
  opt('--page-size <n>', '每页条数', { type: 'int', default: '20' }),
];

export function registerIpo(program) {
  const ipo = defineDomain(program, 'ipo', '新股认购：IPO 列表、详情、认购、改单、撤单、申购记录');

  ipo.add({
    name: 'list',
    description: 'IPO 列表（0=认购中 1=待上市）',
    options: [opt('--status <n>', 'Tab：0=认购中 1=待上市', { type: 'int', default: '0', choices: [0, 1] }), ...PAGE],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/ipo-list', ctx.merge({ status: o.status, pageNum: o.pageNum, pageSize: o.pageSize }))),
  });

  ipo.add({
    name: 'info',
    description: '新股详情（--ipo-id 优先；否则 --stock-code + --exchange-type）',
    options: [opt('--ipo-id <id>', '新股 ID'), opt('--stock-code <code>', '股票代码'), opt('--exchange-type <n>', '市场：0=港股 5=美股', { type: 'int', choices: [0, 5] })],
    action: (s, o, ctx) => {
      if (!o.ipoId && !(o.stockCode && o.exchangeType !== undefined)) {
        throw new CliError('invalid_args', '需要 --ipo-id，或同时提供 --stock-code 与 --exchange-type', { exitCode: EXIT.INVALID_ARGS });
      }
      return s.call((c) => c.postTrade('/stock-order-server/open-api/ipo-info', ctx.merge(compact({ ipoId: o.ipoId, stockCode: o.stockCode, exchangeType: o.exchangeType }))));
    },
  });

  ipo.add({
    name: 'apply',
    description: '新股认购（高风险，需要 --yes；serialNo 自动生成）',
    options: [
      opt('--ipo-id <id>', '新股 ID', { required: true }),
      opt('--apply-type <n>', '1=现金 2=融资', { type: 'int', required: true, choices: [1, 2] }),
      opt('--quantity <n>', '认购数量', { type: 'number', required: true }),
      opt('--cash <n>', '认购现金（融资认购必填）', { type: 'number' }),
      opt('--serial-no <n>', '自定义流水号，缺省自动生成'),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => {
      if (o.applyType === 2 && o.cash === undefined) throw new CliError('invalid_args', '融资认购（--apply-type 2）必须提供 --cash', { exitCode: EXIT.INVALID_ARGS });
      return s.call((c) => c.postTrade('/stock-order-server/open-api/apply-ipo', ctx.merge(compact({
        serialNo: o.serialNo || nextSerialNo(), ipoId: o.ipoId, applyType: o.applyType, applyQuantity: o.quantity, cash: o.cash,
      }))), { requireTrade: true });
    },
  });

  ipo.add({
    name: 'modify',
    description: 'IPO 改单（高风险，需要 --yes）',
    options: [opt('--apply-id <id>', '认购记录 ID', { required: true }), opt('--quantity <n>', '新认购数量', { type: 'number', required: true }), opt('--cash <n>', '认购现金（融资单必填）', { type: 'number' })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/modify-ipo', ctx.merge(compact({ actionType: 0, applyId: o.applyId, applyQuantity: o.quantity, cash: o.cash }))), { requireTrade: true }),
  });

  ipo.add({
    name: 'cancel',
    description: 'IPO 撤单（高风险，需要 --yes）',
    options: [opt('--apply-id <id>', '认购记录 ID', { required: true })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/modify-ipo', ctx.merge({ actionType: 1, applyId: o.applyId, applyQuantity: 0 })), { requireTrade: true }),
  });

  ipo.add({
    name: 'records',
    description: '我的申购列表（分页）',
    options: [opt('--begin <t>', '认购开始时间 yyyy-MM-dd HH:mm:ss'), opt('--end <t>', '认购结束时间 yyyy-MM-dd HH:mm:ss'), ...PAGE],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/ipo-record-list', ctx.merge(compact({ applyTimeMin: o.begin, applyTimeMax: o.end, pageNum: o.pageNum, pageSize: o.pageSize })))),
  });

  ipo.add({
    name: 'record',
    description: '申购明细（--apply-id 与 --serial-no 传其一）',
    options: [opt('--apply-id <id>', '申购编号'), opt('--serial-no <n>', '流水号')],
    action: (s, o, ctx) => {
      if (!o.applyId && !o.serialNo) throw new CliError('invalid_args', '--apply-id 与 --serial-no 至少传一个', { exitCode: EXIT.INVALID_ARGS });
      return s.call((c) => c.postTrade('/stock-order-server/open-api/ipo-record', ctx.merge(compact({ applyId: o.applyId, serialNo: o.serialNo }))));
    },
  });

  ipo.add({
    name: 'confirm-qty',
    description: '额度不足时确认现金认购数量（高风险，需要 --yes）',
    options: [
      opt('--apply-id <id>', '申购编号', { required: true }),
      opt('--cash-flag <n>', '是否需要现金认购：0=否 1=是', { type: 'int', required: true, choices: [0, 1] }),
      opt('--confirm-by <n>', '确认来源：1=IPO 认购 2=IPO 修改 3=IPO 详情修改', { type: 'int', default: '1', choices: [1, 2, 3] }),
      opt('--quantity <n>', '申购股数（cash-flag=1 时必填）', { type: 'number' }),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => {
      if (o.cashFlag === 1 && o.quantity === undefined) throw new CliError('invalid_args', '--cash-flag 1 时必须提供 --quantity', { exitCode: EXIT.INVALID_ARGS });
      return s.call((c) => c.postTrade('/stock-order-server/open-api/ipo-comfirm-qyt/v1', ctx.merge(compact({
        applyId: o.applyId, noQuotaCashFlag: o.cashFlag, confirmBy: o.confirmBy, noQuotaCashQuantity: o.quantity,
      }))), { requireTrade: true });
    },
  });

  return ipo;
}
