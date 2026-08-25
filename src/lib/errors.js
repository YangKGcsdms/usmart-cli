/**
 * 统一错误模型与退出码。
 *
 * 退出码约定（对智能体友好，所有错误同时以 JSON 形式打印到 stdout）：
 *   0  成功（HTTP 2xx 且 code == 0）
 *   1  一般错误：配置缺失/损坏、网络错误、内部异常
 *   2  API 错误：HTTP 非 2xx，或响应 code != 0
 *   3  参数错误：缺少必填参数、类型/枚举不合法
 *   10 高风险写操作需要 --yes 确认
 */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  API_ERROR: 2,
  INVALID_ARGS: 3,
  CONFIRM_REQUIRED: 10,
};

export class CliError extends Error {
  /**
   * @param {string} type      错误类型（snake_case，稳定可匹配）
   * @param {string} message   人类可读信息
   * @param {object} [extra]
   * @param {number} [extra.exitCode]
   * @param {string} [extra.hint]     下一步建议
   * @param {string|number} [extra.code]  uSMART 业务码
   * @param {object} [extra.details]
   * @param {boolean} [extra.retryable]
   */
  constructor(type, message, extra = {}) {
    super(message);
    this.name = 'CliError';
    this.type = type;
    this.exitCode = extra.exitCode ?? EXIT.ERROR;
    this.hint = extra.hint;
    this.code = extra.code;
    this.details = extra.details;
    this.retryable = extra.retryable;
    this.httpStatus = extra.httpStatus;
    this.raw = extra.raw;
  }

  toJSON() {
    const error = { type: this.type, message: this.message };
    if (this.code !== undefined) error.code = String(this.code);
    if (this.httpStatus !== undefined) error.http_status = this.httpStatus;
    if (this.hint) error.hint = this.hint;
    if (this.retryable !== undefined) error.retryable = this.retryable;
    if (this.details !== undefined) error.details = this.details;
    return { ok: false, error, ...(this.raw !== undefined ? { raw: this.raw } : {}) };
  }
}

/**
 * uSMART 官方文档（api-doc.usmart8.com）与实测中出现过的业务错误码。
 * hint 面向智能体：拿到该码后应采取的动作。
 */
export const ERROR_CODES = {
  // ---- 通用 / 登录（账户交易 API）----
  '300100': { msg: '非法请求', hint: '检查请求体字段与签名（X-Sign 需用渠道私钥对 body 做 MD5withRSA）' },
  '300101': { msg: '非法 TOKEN / token 过期', hint: 'CLI 会自动重登；交易类命令请重新发起' },
  '300304': { msg: '验证次数过多，请稍后重试', hint: '等待后再试' },
  '300305': { msg: '验证码已过期', hint: '重新执行 usmart auth send-captcha' },
  '300701': { msg: '该手机号没有注册', hint: '检查配置 account.phoneNumber / areaCode' },
  '300707': { msg: '已通过客户经理预注册，需短信验证码登录激活', hint: '使用 usmart auth send-captcha + login-captcha' },
  '300800': { msg: '短信验证码不正确', hint: '重新获取验证码' },
  '300801': { msg: '密码长度不能小于 8 位', hint: '' },
  '300802': { msg: '密码长度不能大于 24 位', hint: '' },
  '300803': { msg: '密码不能为纯数字/字母/符号', hint: '' },
  '300804': { msg: '请设置 8~24 位数字/字母/符号组合密码', hint: '' },
  '301001': { msg: '交易密码需为 6 位纯数字', hint: '检查 account.tradePassword' },
  '301002': { msg: '错误次数过多，交易密码已锁定', hint: '等待解锁或找回交易密码，不要重试' },
  '301004': { msg: '交易服务异常', hint: '稍后重试' },
  '305016': { msg: '参数不正确', hint: '对照 usmart <domain> <cmd> --help 或官方文档检查必填字段' },
  '310104': { msg: '交易密码错误', hint: '检查 account.tradePassword；连续错误会锁定' },
  '310106': { msg: '未设置交易密码', hint: '先执行 usmart account set-trade-password' },
  '107004': { msg: '服务不可用', hint: '接口路径不存在或服务下线，检查 path' },
  '409933': { msg: '未查询到记录', hint: '检查 entrustId / serialNo 是否正确' },
  '409984': { msg: '交易未解锁 / 解锁已过期', hint: 'CLI 会自动重新解锁并重试' },
  // ---- 基础行情 API ----
  '806000': { msg: '行情：参数错误', hint: '检查 secuId（市场+代码，如 usAAPL / hk00700）与必填字段' },
  '806100': { msg: '行情：未知错误', hint: '稍后重试' },
  '806109': { msg: '行情：权限错误', hint: '该渠道未开通此行情权限，联系 uSMART' },
  '806110': { msg: '行情：内部服务错误', hint: '稍后重试' },
  '806111': { msg: '行情：非法的证券代码或者市场', hint: '市场标识仅支持 hk/us/sh/sz，代码需带前导零（hk00700）' },
  // ---- 行情推送（WebSocket）----
  '800001': { msg: '推送：鉴权失败', hint: 'token 失效，重新登录后再订阅' },
  '800002': { msg: '推送：参数错误', hint: '' },
  '800003': { msg: '推送：内部错误', hint: '' },
  '800004': { msg: '推送：订阅/取消订阅 topic 超限', hint: '最多同时订阅 10 个 topic，每秒最多 10 个' },
  '800005': { msg: '推送：非法请求', hint: '' },
  '800006': { msg: '推送：token 正在使用中', hint: '同一 token 只能有一条连接，关闭其他订阅进程' },
  '800007': { msg: '推送：topic 格式错误', hint: '格式 $type.$market.$code，如 rt.hk.00700' },
  '800008': { msg: '推送：token 被占用', hint: '关闭其他使用该 token 的连接' },
};

export function describeCode(code) {
  return ERROR_CODES[String(code)] || null;
}

/** 把任意异常规整为 CliError。 */
export function toCliError(err) {
  if (err instanceof CliError) return err;
  if (err && err.name === 'SyntaxError') {
    return new CliError('invalid_json', err.message, { exitCode: EXIT.INVALID_ARGS, hint: '--data 需为合法 JSON 字符串或 @文件路径' });
  }
  if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new CliError('timeout', '请求超时', { exitCode: EXIT.ERROR, hint: '检查网络或调大 USMART_TIMEOUT_MS', retryable: true });
  }
  if (err && (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.cause?.code)) {
    const c = err.code || err.cause?.code;
    return new CliError('network_error', `网络错误：${c}`, { exitCode: EXIT.ERROR, hint: '检查 env.tradeHost / env.quoteHost 与网络连通性', retryable: true });
  }
  return new CliError('internal_error', err?.message || String(err), { exitCode: EXIT.ERROR, details: process.env.USMART_DEBUG ? err?.stack : undefined });
}
