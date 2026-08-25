import { defineDomain, CliError, EXIT } from '../lib/registry.js';
import { opt, compact } from '../lib/validate.js';
import { isSuccess } from '../lib/usmart-client.js';

const EXCHANGE = opt('--exchange-type <n>', '市场：0=港股 5=美股（见 usmart dict get exchange-type）', { type: 'int', default: '5' });
const PAGE = [
  opt('--page-num <n>', '页码，从 1 开始', { type: 'int', default: '1' }),
  opt('--page-size <n>', '每页条数', { type: 'int', default: '20' }),
];

/** 未显式给 fundAccount 时，从资产接口取第一个资金账号。 */
async function resolveFundAccount(session, explicit) {
  if (explicit) return String(explicit);
  const asset = await session.call((c) => c.postTrade('/asset-center-server/open-api/open-assetQuery/v1', {}));
  if (!isSuccess(asset)) return null;
  const first = (asset.data?.assetSingleInfoRespVOS || []).find((a) => a.fundAccount);
  return first ? String(first.fundAccount) : null;
}

export function registerAccount(program) {
  const account = defineDomain(program, 'account', '账户与资产：资产、持仓、账户类型、融资利率、融资详情、抵押比率、资金流水、汇率、密码管理');

  account.add({
    name: 'asset', legacy: 'asset',
    description: '综合资产（含各资金账户持仓 holdInfos，holdProfit=持仓盈亏）',
    options: [opt('--money-type <n>', '币种：0=CNY 1=USD 2=HKD，缺省=全部', { type: 'int', choices: [0, 1, 2] })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/asset-center-server/open-api/open-assetQuery/v1', ctx.merge(compact({ moneyType: o.moneyType })))),
  });

  account.add({
    name: 'holding', legacy: 'holding',
    description: '持仓列表',
    options: [opt('--exchange-type <n>', '市场：0=港股 5=美股 100=全部', { type: 'int', default: '100' })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/stock-holding', ctx.merge({ exchangeType: o.exchangeType }))),
  });

  account.add({
    name: 'type', legacy: 'account-type',
    description: '按市场查询账户类型（data.assetProp：0=现金账户 M=融资账户）',
    options: [opt('--market-type <n>', '市场：0=港股 5=美股', { type: 'int', default: '5' })],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/get-user-info-with-market-for-stock/v1', ctx.merge({ marketType: o.marketType }))),
  });

  account.add({
    name: 'margin-rate', legacy: 'rate-info',
    description: '按资金账号查询融资利率（cny/hkd/usdRateValue，%）；不传 --fund-account 时自动取资产里的第一个资金账号',
    options: [opt('--fund-account <id>', '资金账号')],
    action: async (s, o, ctx) => {
      const fundAccount = await resolveFundAccount(s, o.fundAccount);
      if (!fundAccount) throw new CliError('invalid_args', '无法确定资金账号，请显式传 --fund-account', { exitCode: EXIT.INVALID_ARGS });
      return s.call((c) => c.postTrade('/user-server/open-api/get-rate-info-by-fund-account/v1', ctx.merge({ fundAccount })));
    },
  });

  account.add({
    name: 'margin-detail', legacy: 'margin-detail',
    description: '融资账户详情（购买力、欠款、预计利息等）',
    options: [EXCHANGE],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/asset-center-server/open-api/open-margin-detail/v1', ctx.merge({ exchangeType: o.exchangeType }))),
  });

  account.add({
    name: 'mortgage-list', legacy: 'mortgage-list',
    description: '股票抵押比率列表（孖展）',
    options: [
      opt('--exchange-type <n>', '市场：0=港股 5=美股 67=A股', { type: 'int', choices: [0, 5, 67] }),
      opt('--stock-code <code>', '证券代码'),
      opt('--status <n>', '1=生效中 0=已下架', { type: 'int', default: '1', choices: [0, 1] }),
      opt('--all', '不分页返回全部（pageSizeZero）', { type: 'boolean' }),
      opt('--page-num <n>', '页码', { type: 'int', default: '1' }),
      opt('--page-size <n>', '每页条数（最大 20）', { type: 'int', default: '20' }),
    ],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-order-server/open-api/mortgage-list', ctx.merge(compact({
      exchangeType: o.exchangeType, stockCode: o.stockCode, status: o.status,
      pageSizeZero: o.all ? true : undefined, pageNum: o.pageNum, pageSize: o.pageSize,
    })))),
  });

  account.add({
    name: 'flow', legacy: 'business-flow',
    description: '资金流水（入金/出金/货币兑换）',
    options: [
      opt('--date-type <n>', '-1=全部 0=近1月 1=近3月 2=近1年 3=今年 9=自定义', { type: 'int', default: '-1', choices: [-1, 0, 1, 2, 3, 9] }),
      opt('--start-time <t>', '开始时间（date-type=9 时必填），yyyy-MM-dd'),
      opt('--end-time <t>', '结束时间（date-type=9 时必填），yyyy-MM-dd'),
      opt('--type <n>', '0=入金 1=出金 2=货币兑换，缺省=全部', { type: 'int', choices: [0, 1, 2] }),
      ...PAGE,
    ],
    action: (s, o, ctx) => {
      if (o.dateType === 9 && (!o.startTime || !o.endTime)) {
        throw new CliError('invalid_args', '--date-type 9 需要同时提供 --start-time 与 --end-time', { exitCode: EXIT.INVALID_ARGS });
      }
      return s.call((c) => c.postTrade('/stock-capital-server/open-api/business-flow', ctx.merge(compact({
        dateType: o.dateType, startTime: o.startTime, endTime: o.endTime, type: o.type, pageNum: o.pageNum, pageSize: o.pageSize,
      }))));
    },
  });

  account.add({
    name: 'exchange-rate', legacy: 'currency-exchange',
    description: '当前汇率表（盈立/中银 买入卖出价，币种 0=CNY 1=USD 2=HKD）',
    action: (s, _o, ctx) => s.call((c) => c.postTrade('/stock-capital-server/open-api/currency-exchange-info', ctx.merge({}))),
  });

  account.add({
    name: 'cashout-revoke',
    description: '撤销出金申请（高风险，需要 --yes）',
    options: [opt('--id <id>', '出金记录 id', { required: true })],
    highRisk: true, requireTrade: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/stock-capital-server/open-api/app-cashOut-revoke', ctx.merge({ id: o.id })), { requireTrade: true }),
  });

  // ---------------- 密码管理 ----------------
  account.add({
    name: 'check-trade-password',
    description: '校验交易密码（缺省用配置里的 tradePassword；连续错误会锁定）',
    options: [opt('--password <pwd>', '6 位纯数字交易密码')],
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/check-trade-password', ctx.merge({ password: c.encrypt(o.password || ctx.config.account.tradePassword) }))),
  });

  account.add({
    name: 'set-trade-password',
    description: '首次设置交易密码（高风险，需要 --yes）',
    options: [opt('--password <pwd>', '6 位纯数字', { required: true })],
    highRisk: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/set-trade-password', ctx.merge({ password: c.encrypt(o.password) }))),
  });

  account.add({
    name: 'update-trade-password',
    description: '修改交易密码（高风险，需要 --yes）',
    options: [opt('--old-password <pwd>', '旧交易密码', { required: true }), opt('--password <pwd>', '新交易密码（6 位纯数字）', { required: true })],
    highRisk: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/update-trade-password', ctx.merge({ oldPassword: c.encrypt(o.oldPassword), password: c.encrypt(o.password) }))),
  });

  account.add({
    name: 'reset-trade-password',
    description: '通过短信验证码重置交易密码（高风险，需要 --yes；先 usmart auth send-captcha --type 102）',
    options: [opt('--password <pwd>', '新交易密码（6 位纯数字）', { required: true }), opt('--captcha <code>', '短信验证码', { required: true })],
    highRisk: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/reset-trade-password', ctx.merge({ password: c.encrypt(o.password), phoneCaptcha: o.captcha }))),
  });

  account.add({
    name: 'update-login-password',
    description: '修改登录密码（高风险，需要 --yes；成功后记得同步更新配置文件）',
    options: [opt('--old-password <pwd>', '旧登录密码', { required: true }), opt('--password <pwd>', '新登录密码（8~24 位数字/字母/符号组合）', { required: true })],
    highRisk: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/update-login-password', ctx.merge({ oldPassword: c.encrypt(o.oldPassword), password: c.encrypt(o.password) }))),
  });

  account.add({
    name: 'reset-login-password',
    description: '通过短信验证码重置登录密码（高风险，需要 --yes；不需要登录态；先 send-captcha --type 102）',
    options: [opt('--password <pwd>', '新登录密码', { required: true }), opt('--captcha <code>', '短信验证码', { required: true })],
    highRisk: true,
    action: (s, o, ctx) => s.call((c) => c.postTrade('/user-server/open-api/reset-login-password', ctx.merge({
      phoneNumber: c.encrypt(ctx.config.account.phoneNumber), areaCode: ctx.config.account.areaCode,
      password: c.encrypt(o.password), phoneCaptcha: o.captcha,
    }), { auth: false }), { auth: false }),
  });

  return account;
}
