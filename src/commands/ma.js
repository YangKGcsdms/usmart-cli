import { defineDomain } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { nextSerialNo } from '../lib/request-id.js';

/** MA 接口价格单位为「每股价格 × 10000」，CLI 接受真实价格并自动换算。 */
const toMaPrice = (p) => Math.round(Number(p) * 10000);

export function registerMa(program) {
  const ma = defineDomain(program, 'ma', 'MA 策略账户：下单、撤单、订单列表、订单详情、策略购买力');

  ma.add({
    name: 'place',
    description: 'MA 下单（高风险，需要 --yes；--price 为真实价格，CLI 自动 ×10000）',
    options: [
      opt('--strategy-id <id>', '策略 ID', { type: 'number', required: true }),
      opt('--stock-id <code>', '股票代码', { required: true }),
      opt('--trade-type <n>', '交易类型：1=买 2=卖', { type: 'int', required: true, choices: [1, 2] }),
      opt('--op-type <n>', '委托类型：0=买 1=卖', { type: 'int', required: true, choices: [0, 1] }),
      opt('--order-type <n>', '1=限价 2=增强限价 3=市价 4=竞价 5=竞价现价 6=条件单', { type: 'int', required: true, choices: [1, 2, 3, 4, 5, 6] }),
      opt('--quantity <n>', '委托数量', { type: 'number', required: true }),
      opt('--price <n>', '每股价格（真实价格）', { type: 'number', required: true }),
      opt('--pre-post <n>', '是否允许盘前盘后：1=不允许 2=允许', { type: 'int', default: '1', choices: [1, 2] }),
      opt('--serial-no <n>', '自定义流水号，缺省自动生成'),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/ams-center/open-api/ma-order-submit/v1', ctx.merge({
      serialNo: o.serialNo || nextSerialNo(), strategyId: o.strategyId, stockId: o.stockId, tradeType: o.tradeType, opType: o.opType,
      orderType: o.orderType, sellQuota: o.quantity, sellPrice: toMaPrice(o.price), openClosePreFlag: o.prePost,
    })), { requireTrade: true }),
  });

  ma.add({
    name: 'cancel',
    description: 'MA 撤单（高风险，需要 --yes）',
    options: [opt('--ma-order-id <id>', 'MA 订单 ID', { required: true })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/ams-center/open-api/ma-order-cancel/v1', ctx.merge({ maOrderId: o.maOrderId })), { requireTrade: true }),
  });

  ma.add({
    name: 'list',
    description: 'MA 订单列表（分页）',
    options: [
      opt('--strategy-id <id>', '策略 ID', { type: 'number', required: true }),
      opt('--today <n>', '1=今日订单 0=历史', { type: 'int', default: '1', choices: [0, 1] }),
      opt('--page-num <n>', '页码', { type: 'int', default: '1' }),
      opt('--page-size <n>', '每页条数', { type: 'int', default: '20' }),
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/ams-center/open-api/ma-order-list/v1', ctx.merge({ strategyId: o.strategyId, today: o.today, pageNum: o.pageNum, pageSize: o.pageSize }))),
  });

  ma.add({
    name: 'detail',
    description: 'MA 订单详情',
    options: [opt('--ma-order-id <id>', 'MA 订单 ID', { required: true })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/ams-center/open-api/ma-order-detail/v1', ctx.merge({ maOrderId: o.maOrderId }))),
  });

  ma.add({
    name: 'purchase-power',
    description: '策略购买力（--price 为真实价格，自动 ×10000）',
    options: [
      opt('--strategy-id <id>', '策略 ID', { type: 'number', required: true }),
      opt('--stock-id <code>', '股票代码', { required: true }),
      opt('--op-type <n>', '0=买 1=卖', { type: 'int', required: true, choices: [0, 1] }),
      opt('--price <n>', '每股价格（真实价格）', { type: 'number', required: true }),
      opt('--amount <n>', '股票数量', { type: 'number', required: true }),
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/ams-center/open-api/get-ma-trade-account-info/v1', ctx.merge(compact({
      strategyId: o.strategyId, stockId: o.stockId, opType: o.opType, price: toMaPrice(o.price), amount: o.amount,
    })))),
  });

  return ma;
}
