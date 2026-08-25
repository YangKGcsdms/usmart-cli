import crypto from 'crypto';

/**
 * 官方文档要求 X-Request-Id 为「长度 19 位数字，必须唯一」（推荐雪花算法）。
 * 下单 serialNo 同样是「最长 19 位、确保唯一」的 int64。
 *
 * 生成规则：13 位毫秒时间戳 + 6 位序号（随机起点、单进程内递增）= 19 位，
 * 数值 < 9.22e18，可安全作为 int64。
 */
let counter = crypto.randomInt(0, 900000);

export function nextRequestId() {
  counter = (counter + 1) % 1000000;
  return `${Date.now()}${String(counter).padStart(6, '0')}`;
}

/** 下单流水号（int64 字符串，19 位）。 */
export function nextSerialNo() {
  return nextRequestId();
}

/** 期权接口 requestId：10~36 位字符串。 */
export function nextOptionRequestId() {
  return `opt${nextRequestId()}`;
}
