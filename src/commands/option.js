import { defineDomain } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { nextOptionRequestId } from '../lib/request-id.js';

const SIDE = opt('--side <n>', '买卖方向：1=买 2=卖', { type: 'int', required: true, choices: [1, 2] });
const BIZ = opt('--business-type <t>', 'O=期权（默认） OS=期权沽空', { default: 'O', choices: ['O', 'OS'] });

export function registerOption(program) {
  const option = defineDomain(program, 'option', '美股期权：下单、改单、撤单、购买力、改单状态、今日订单、订单详情');

  option.add({
    name: 'place',
    description: '期权下单（高风险，需要 --yes；requestId 自动生成）',
    options: [
      opt('--symbol <s>', '期权代码', { required: true }),
      SIDE,
      opt('--qty <n>', '数量（最多两位小数）', { type: 'number', required: true }),
      opt('--order-type <n>', '1=市价单 2=限价单', { type: 'int', required: true, choices: [1, 2] }),
      opt('--price <n>', '价格（限价单必填）', { type: 'number' }),
      BIZ,
      opt('--entrust-type <n>', '委托方式：2=INTERNET（默认） 1=电话委托', { type: 'int', choices: [1, 2] }),
      opt('--request-id <id>', '自定义流水号（10~36 位），缺省自动生成'),
    ],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/option-trade/v1', ctx.merge(compact({
      requestId: o.requestId || nextOptionRequestId(), symbol: o.symbol, side: o.side, qty: o.qty, orderType: o.orderType, price: o.price,
      businessType: o.businessType, entrustType: o.entrustType,
    }))), { requireTrade: true }),
  });

  option.add({
    name: 'replace',
    description: '期权改单（高风险，需要 --yes）',
    options: [opt('--order-id <id>', '订单 ID', { required: true }), opt('--qty <n>', '新数量', { type: 'number', required: true }), opt('--price <n>', '新价格', { type: 'number', required: true }), opt('--request-id <id>', '自定义流水号')],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/option-replace-order/v1', ctx.merge({
      requestId: o.requestId || nextOptionRequestId(), orderId: o.orderId, qty: o.qty, price: o.price,
    })), { requireTrade: true }),
  });

  option.add({
    name: 'cancel',
    description: '期权撤单（高风险，需要 --yes）',
    options: [opt('--order-id <id>', '订单 ID', { required: true }), opt('--request-id <id>', '自定义流水号')],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/option-cancel-order/v1', ctx.merge({ requestId: o.requestId || nextOptionRequestId(), orderId: o.orderId })), { requireTrade: true }),
  });

  option.add({
    name: 'purchase-power',
    description: '期权下单购买力',
    options: [opt('--symbol <s>', '期权代码', { required: true }), SIDE, BIZ, opt('--qty <n>', '数量', { type: 'number' }), opt('--price <n>', '价格（买入时必传）', { type: 'number' })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/option-customer-range/v2', ctx.merge(compact({ symbol: o.symbol, side: o.side, businessType: o.businessType, entrustQty: o.qty, price: o.price })))),
  });

  option.add({
    name: 'replace-power',
    description: '期权改单购买力',
    options: [opt('--order-id <id>', '订单 ID', { required: true }), opt('--price <n>', '价格', { type: 'number', required: true }), opt('--qty <n>', '数量', { type: 'number' })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/option-customer-replace-range/v1', ctx.merge(compact({ orderId: o.orderId, price: o.price, entrustQty: o.qty })))),
  });

  option.add({
    name: 'replace-status',
    description: '期权改单状态查询',
    options: [opt('--order-id <id>', '订单 ID', { required: true })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/query-option-order-replace-status/v1', ctx.merge({ orderId: o.orderId }))),
  });

  option.add({
    name: 'list',
    description: '期权今日订单列表',
    options: [opt('--market <n>', '市场：51=美股期权', { type: 'int', default: '51' }), opt('--symbol <s>', '期权代码过滤')],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/user-option-order-list/v1', ctx.merge(compact({ market: o.market, symbol: o.symbol })))),
  });

  option.add({
    name: 'detail',
    description: '期权订单详情',
    options: [opt('--order-id <id>', '订单 ID', { required: true })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/option-order-server/open-api/user-option-order-detail/v1', ctx.merge({ orderId: o.orderId }))),
  });

  return option;
}
