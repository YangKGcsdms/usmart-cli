/**
 * uSMART 官方文档中的数据字典（api-doc.usmart8.com，账户交易 API §5 + 基础行情 API + 推送协议）。
 * 供 `usmart dict` 命令查询，也供智能体在组装参数 / 解读返回值时查表。
 */
export const DICTS = {
  'order-status': {
    title: '订单状态（status）',
    values: { '-1': '失败', 0: '全部成交', 1: '等待提交', 2: '待成交', 3: '部分成交', 4: '等待撤单', 5: '等待改单', 6: '已撤单', 7: '部成撤单', 8: '废单', 11: '等待提交', 61: '收市撤单' },
  },
  'exchange-type': {
    title: '市场类型（exchangeType）',
    values: { 0: '港股', 1: '上海A', 2: '上海B', 3: '深圳A', 4: '深圳B', 5: '美股', 6: '沪港通', 7: '深港通', 67: 'A股（仅查询）', 100: '全部（部分查询接口接受，非官方字典值）' },
  },
  'money-type': {
    title: '币种（moneyType）',
    values: { 0: '人民币 CNY', 1: '美元 USD', 2: '港币 HKD' },
  },
  'asset-prop': {
    title: '账户类型（assetProp）',
    values: { 0: '现金账户', M: '融资账户' },
  },
  'device-type': {
    title: '设备类别（X-Dt）',
    values: { t1: '安卓', t2: 'iOS', t3: '其它', t4: 'Windows', t5: 'Mac' },
  },
  'entrust-type': {
    title: '委托类别（entrustType）',
    values: { 0: '买', 1: '卖' },
  },
  'entrust-prop': {
    title: '委托属性（entrustProp）',
    values: {
      '0': '限价单（美股/港股/A股）；港股暗盘委托',
      d: '竞价单（港股，价格传 0）',
      e: '增强限价单（港股）',
      g: '竞价限价单（港股）',
      w: '市价单（港股/美股）',
      u: '碎股单（仅 trade-quantity / margin-quantity 查询）',
    },
  },
  'session-type': {
    title: '交易阶段（sessionType）',
    values: { 0: '正常交易（默认）', 1: '盘前', 2: '盘后', 3: '暗盘', 12: '盘前盘后' },
  },
  'action-type': {
    title: '改撤单操作（actionType）',
    values: { 0: '撤单', 1: '改单' },
  },
  'date-flag': {
    title: '历史订单时间范围（dateFlag）',
    values: { 1: '近一周', 2: '近一个月', 3: '近三个月', 4: '近一年', 5: '今年', 6: '自选时间（配合 entrustBeginDate/entrustEndDate）', 7: '全部' },
  },
  'flow-date-type': {
    title: '资金流水时间范围（dateType）',
    values: { '-1': '全部', 0: '近一个月', 1: '近三个月', 2: '近一年', 3: '今年', 9: '自定义（配合 startTime/endTime）' },
  },
  'flow-type': {
    title: '资金流水类型（type）',
    values: { 0: '入金', 1: '出金', 2: '货币兑换' },
  },
  'ipo-status': {
    title: 'IPO 新股状态（status）',
    values: { 0: '待认购', 1: '认购中', 2: '待扣款', 3: '已扣款待确认', 4: '已确认待公布', 5: '已公布待上市', 6: '已上市', 7: '取消上市', 8: '暂缓上市', 9: '延迟上市', 11: '已删除' },
  },
  'ipo-apply-status': {
    title: 'IPO 认购状态（status）',
    values: { 0: '已提交', 1: '已认购', 2: '等待改单', 3: '等待撤销', 4: '已撤销', 5: '已扣款', 6: '待公布中签', 7: '全部中签', 8: '部分中签', 9: '未中签', 10: '认购失败', 11: '已中签', 12: '待系统确认', 20: '申请额度中' },
  },
  'ipo-apply-type': {
    title: 'IPO 认购类型（applyType）',
    values: { 1: '现金', 2: '融资' },
  },
  'ipo-list-status': {
    title: 'IPO 列表 Tab（status）',
    values: { 0: '认购中', 1: '待上市' },
  },
  'captcha-type': {
    title: '验证码类型（type）',
    values: { 101: '注册', 102: '重置密码', 103: '更换手机号', 104: '绑定手机号', 105: '新设备登录校验', 106: '短信登录' },
  },
  'area-code': {
    title: '区号（areaCode）',
    values: { 86: '中国大陆', 852: '香港', 853: '澳门', 886: '台湾', 65: '新加坡' },
  },
  market: {
    title: '行情市场标识（market）',
    values: { hk: '香港', us: '美国', sh: '上海', sz: '深圳' },
  },
  'kline-type': {
    title: 'K 线类型（type）',
    values: { 0: '不返回数据', 1: '1 分钟', 2: '5 分钟', 3: '10 分钟', 4: '15 分钟', 5: '30 分钟', 6: '60 分钟', 7: '日 K', 8: '周 K', 9: '月 K', 10: '3 月 K', 11: '6 月 K', 12: '年 K' },
  },
  'kline-right': {
    title: '复权类型（right）',
    values: { 0: '不复权', 1: '前复权', 2: '后复权' },
  },
  'timeline-type': {
    title: '分时类型（type）',
    values: { 0: '一日分时', 1: '五日分时' },
  },
  'market-status': {
    title: '市场状态（status）',
    values: {
      0: '未知', 1: '启动、开市前', 2: '开盘集合竞价 9:15-9:25', 3: '暂停 9:25-9:30（港股 09:28-09:30）', 4: '连续竞价', 5: '午间休市', 6: '收盘集合竞价（深交所 14:57-15:00）', 7: '已收盘',
      20: '输入买卖盘 09:00-09:15（港股）', 21: '对盘前 09:15-09:20（港股）', 22: '对盘 09:20-09:28（港股）', 23: '参考定价（港股收盘竞价）', 24: '输入买卖盘（港股收盘竞价）', 25: '不可取消（港股收盘竞价）',
    },
  },
  'trading-day-type': {
    title: '交易日类型（tradingDayType）',
    values: { 0: '非交易日', 1: '全天交易', 2: '上半日市', 3: '下半日市' },
  },
  'secu-status': {
    title: '证券状态（trdStatus）',
    values: { 0: '未知', 1: '停牌', 2: '港股波动中断', 3: '未上市', 4: '暂停上市（A股）', 5: '退市', 6: '交易中' },
  },
  'secu-type': {
    title: '证券类型（type1）',
    values: { 0: '未知', 1: '股票', 2: '基金', 3: '期货', 4: '债券', 5: '衍生证券', 6: '指数', 7: '外汇', 8: '其他', 9: '板块' },
  },
  'tick-direction': {
    title: '逐笔买卖方向（direction）',
    values: { 0: '默认', 1: '买', 2: '卖' },
  },
  'tick-trd-type': {
    title: '港股逐笔类型（trdType）',
    values: { 4: 'P', 22: 'M', 100: 'Y', 101: 'X', 102: 'D', 103: 'U' },
  },
  'push-topic-type': {
    title: '推送行情类型（topic 前缀）',
    values: { rt: '实时行情 realtime', tk: '逐笔成交 tick', ob: '买卖盘 orderbook' },
  },
  'ma-order-type': {
    title: 'MA 订单类型（orderType）',
    values: { 1: '限价单', 2: '增强限价单', 3: '市价单', 4: '竞价单', 5: '竞价现价单', 6: '条件单（限价）' },
  },
  'option-side': {
    title: '期权买卖方向（side）',
    values: { 1: '买', 2: '卖' },
  },
  'option-order-type': {
    title: '期权订单类别（orderType）',
    values: { 1: '市价单', 2: '限价单' },
  },
  'option-business-type': {
    title: '期权业务类型（businessType）',
    values: { O: '期权（默认）', OS: '期权沽空' },
  },
  'option-market': {
    title: '期权市场（market）',
    values: { 51: '美股期权' },
  },
  'rate-limit': {
    title: '官方限流（次/分钟）',
    values: {
      'realtime/timeline/kline/tick/marketstate/orderbook': 120,
      basicinfo: 20,
      'push 订阅': '最多 10 个 topic，每秒最多订阅/取消 10 个',
      '（文档未列）行情网关突发': 'REST 侧短时间连打会被 openresty 直接返回 HTTP 403 并封一段时间，无 Retry-After；WebSocket 推送不受影响',
    },
  },
  'kline-quota': {
    title: '历史 K 线标的额度（官方「功能介绍」§6）',
    values: {
      '普通账户': '最近 30 天内 200 个标的',
      'PRO/智慧账户': '最近 30 天内 500 个标的',
      计数规则: '每请求 1 只股票的历史 K 线占用 1 个额度；30 天内重复请求同一只不重复累计',
    },
  },
  'account-tier': {
    title: '账户类型权限（官方「OPEN API 介绍」）',
    values: {
      普通账户: '美股/港股/A股交易，部分股票支持融资融券，支持期权；仅交易时段可下单',
      PRO账户: '美股/港股/A股交易，任意时段下单，享打新与顾投特权',
    },
  },
};

export function listDicts() {
  return Object.entries(DICTS).map(([name, d]) => ({ name, title: d.title, count: Object.keys(d.values).length }));
}

export function getDict(name) {
  return DICTS[name] || null;
}

export function lookup(name, code) {
  const d = DICTS[name];
  if (!d) return null;
  const v = d.values[String(code)];
  return v === undefined ? null : { code: String(code), name: v };
}
